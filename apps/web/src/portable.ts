import type { BaseUnitResult, Candidate, ElectionDefinition, Scenario, SimulationResult } from "@votatlas/contracts";
import { getTennesseeProvenance } from "@votatlas/data";
import * as simCore from "@votatlas/sim-core";
import type { RegistrySandboxSession } from "./sandbox";
import { addRegistryCandidate, hydrateRegistrySandbox, importLegacyRegistryScenario, initializeRegistrySandbox, renameRegistryCandidate } from "./sandbox";

/**
 * E2 Round Three will own the canonical v2 codec in @votatlas/sim-core.
 * This adapter prefers that codec as soon as the E2 PR is merged. The isolated
 * compatibility encoder keeps this E1 branch usable and testable beforehand.
 * It NEVER accepts imported baseline votes or executable payloads.
 */
interface RestoredProject {
  election: ElectionDefinition;
  baseUnits: BaseUnitResult[];
  scenario: Scenario;
  result: SimulationResult;
}
interface E2PortableApi {
  createScenarioProject?: (sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
    election: ElectionDefinition, units: readonly BaseUnitResult[], scenario: Scenario) => unknown;
  serializeScenarioProject?: (project: unknown) => string;
  restoreScenarioProject?: (project: string, sourceElection: ElectionDefinition,
    sourceUnits: readonly BaseUnitResult[]) => RestoredProject;
}
const core = simCore as unknown as E2PortableApi;
const MAX_JSON_BYTES = 1024 * 1024;
const ORIGINAL_SOURCE_DIGEST = getTennesseeProvenance().payloadSha256;

interface BridgeProjectV2 {
  schemaVersion: 2;
  kind: "votatlas-scenario-project";
  source: { electionId: string; geographyVintage: string; dataStatus: string; digest: string };
  addedCandidates: Candidate[];
  renamedCandidates: Array<{ id: string; name: string }>;
  scenario: Scenario;
}
function fail(message: string): never { throw new Error(message); }
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function validateRawSize(raw: string): void {
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) fail("Scenario project exceeds the 1 MB maximum.");
}
function serializableBridgeProject(
  session: RegistrySandboxSession, sourceElection: ElectionDefinition,
): BridgeProjectV2 {
  const originals = new Map(sourceElection.candidates.map(c => [c.id, c]));
  for (const id of originals.keys())
    if (!session.election.candidates.some(candidate => candidate.id === id))
      fail("Source candidate registry cannot be removed.");
  return {
    schemaVersion: 2, kind: "votatlas-scenario-project",
    source: {
      electionId: sourceElection.id, geographyVintage: sourceElection.geographyVintage,
      dataStatus: sourceElection.dataStatus, digest: ORIGINAL_SOURCE_DIGEST,
    },
    addedCandidates: session.election.candidates.filter(c => !originals.has(c.id)),
    renamedCandidates: session.election.candidates
      .filter(c => originals.has(c.id) && originals.get(c.id)?.name !== c.name)
      .map(c => ({ id: c.id, name: c.name })),
    scenario: simCore.parseScenario(simCore.serializeScenario(session.scenario)),
  };
}
function hydrateBridgeProject(raw: string, sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[]): RegistrySandboxSession {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return fail("Malformed scenario project JSON."); }
  if (!isRecord(parsed)) fail("Scenario project must be an object.");
  if (parsed.schemaVersion === 1) return importLegacyRegistryScenario(sourceElection, sourceUnits, raw);
  if (parsed.schemaVersion !== 2) fail("Unsupported scenario project schema version.");
  if (parsed.kind !== "votatlas-scenario-project" || !isRecord(parsed.source))
    fail("Unsupported scenario project format.");
  if (parsed.source.electionId !== sourceElection.id ||
      parsed.source.geographyVintage !== sourceElection.geographyVintage ||
      parsed.source.dataStatus !== sourceElection.dataStatus ||
      parsed.source.digest !== ORIGINAL_SOURCE_DIGEST)
    fail("Scenario project was saved against a different trusted source fixture or source digest.");
  if (!Array.isArray(parsed.addedCandidates) || !Array.isArray(parsed.renamedCandidates) ||
      !isRecord(parsed.scenario) || parsed.addedCandidates.length > 100 || parsed.renamedCandidates.length > 100)
    fail("Malformed candidate metadata in scenario project.");
  let state = initializeRegistrySandbox(sourceElection, sourceUnits);
  for (const rawCandidate of parsed.addedCandidates) {
    if (!isRecord(rawCandidate)) fail("Invalid added candidate.");
    // The engine enforces six-digit hex colors, reserved IDs, trim rules,
    // registry uniqueness, ballotOrder and exact zero-vote baseline extension.
    state = addRegistryCandidate(state, rawCandidate as unknown as Candidate);
  }
  for (const rename of parsed.renamedCandidates) {
    if (!isRecord(rename) || typeof rename.id !== "string" || typeof rename.name !== "string")
      fail("Invalid candidate rename.");
    state = renameRegistryCandidate(state, rename.id, rename.name);
  }
  const scenario = simCore.parseScenario(JSON.stringify(parsed.scenario));
  return hydrateRegistrySandbox(state.election, state.baseUnits, scenario);
}

export function exportPortableProject(
  session: RegistrySandboxSession, sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
): string {
  const json = core.createScenarioProject && core.serializeScenarioProject
    ? core.serializeScenarioProject(core.createScenarioProject(
        sourceElection, sourceUnits, session.election, session.baseUnits, session.scenario
      ))
    : JSON.stringify(serializableBridgeProject(session, sourceElection));
  validateRawSize(json);
  return json;
}

export function importPortableProject(
  raw: string, sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
): RegistrySandboxSession {
  validateRawSize(raw);
  if (core.restoreScenarioProject) {
    const restored = core.restoreScenarioProject(raw, sourceElection, sourceUnits);
    return hydrateRegistrySandbox(restored.election, restored.baseUnits, restored.scenario);
  }
  return hydrateBridgeProject(raw, sourceElection, sourceUnits);
}
