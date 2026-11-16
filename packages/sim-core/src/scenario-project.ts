import type {
  BaseUnitResult, Candidate, DataStatus, ElectionDefinition, Scenario, SimulationResult
} from "@votatlas/contracts";
import { addCandidate, validateCandidateMetadata, validateRegistry } from "./candidate-registry.js";
import { parseScenario, serializeScenario, simulateElection, SimulationError } from "./engine.js";
import { sha256Hex } from "./sha256.js";

/** Portable v2 contains NO replacement baseline votes. A verified source must be supplied to restore. */
export interface ScenarioProjectV2 {
  schemaVersion: 2;
  format: "votatlas-scenario-project";
  source: {
    electionId: string;
    geographyVintage: string;
    dataStatus: DataStatus;
    digest: string;
  };
  registry: {
    /** Full metadata of fictional candidates added to the source candidate registry. */
    additions: Candidate[];
    /** Full metadata for edited source candidates. IDs and ballot orders may not change. */
    overrides: Candidate[];
    /** Preserves the UI ordering independent of candidate labels, parties, and ballot orders. */
    candidateOrder: string[];
  };
  /** The same ordered, fully normalized v1 Adjustment history. */
  scenario: Scenario;
}
export type ParsedScenarioProject = ScenarioProjectV2 | Scenario;
export interface RestoredScenarioProject {
  election: ElectionDefinition;
  baseUnits: BaseUnitResult[];
  scenario: Scenario;
  result: SimulationResult;
}

export const MAX_SCENARIO_PROJECT_BYTES = 1_048_576;
const MAX_CANDIDATES = 128;
const MAX_ACTIONS = 2500;
const FORMAT = "votatlas-scenario-project";
const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function invalid(detail: string): never { throw new SimulationError("INVALID_PROJECT", detail); }
function onlyKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(`Missing field: ${key}`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) invalid(`Unexpected field: ${key}`);
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) {
    invalid(`Invalid ${label}`);
  }
  return value;
}
function checkedArray(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) invalid(`Invalid or oversized ${label}`);
  return value;
}
function byteLimit(json: string): void {
  if (json.length > MAX_SCENARIO_PROJECT_BYTES ||
      new TextEncoder().encode(json).byteLength > MAX_SCENARIO_PROJECT_BYTES) {
    throw new SimulationError("PROJECT_TOO_LARGE", "Scenario project exceeds the 1 MiB limit");
  }
}
function toJson(value: unknown): string {
  let json: string | undefined;
  try { json = JSON.stringify(value); }
  catch { invalid("Scenario project cannot be encoded to JSON"); }
  if (typeof json !== "string") invalid("Scenario project must be JSON serializable");
  byteLimit(json);
  return json;
}
function candidateShape(raw: unknown, sourceCandidate = false): Candidate {
  if (!plain(raw)) invalid("Candidate metadata must be an object");
  onlyKeys(raw, ["id", "name", "color", "ballotOrder"], ["partyLabel"]);
  const candidate: Candidate = {
    id: raw.id as string,
    name: raw.name as string,
    color: raw.color as string,
    ballotOrder: raw.ballotOrder as number,
    ...(raw.partyLabel === undefined ? {} : { partyLabel: raw.partyLabel as string })
  };
  validateCandidateMetadata(candidate, sourceCandidate);
  return candidate;
}
function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.id === b.id && a.name === b.name && a.color === b.color &&
    a.ballotOrder === b.ballotOrder && a.partyLabel === b.partyLabel;
}
function freshRows(rows: readonly BaseUnitResult[]): BaseUnitResult[] {
  return rows.map(row => ({
    geoId: row.geoId, stateId: row.stateId, eligibleVoters: row.eligibleVoters,
    votes: Object.fromEntries(Object.entries(row.votes)), otherBallots: row.otherBallots
  }));
}

/**
 * Fingerprints the complete trusted source election registry, metadata, and every
 * county vote/eligible/other category. Input order is not part of the fingerprint.
 * Any new source fixture revision requires a newly exported scenario project.
 */
export function fingerprintSourceElection(
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): string {
  validateRegistry(sourceElection);
  if (typeof sourceElection.title !== "string" || typeof sourceElection.office !== "string" ||
      !sourceElection.title.trim() || !sourceElection.office.trim() ||
      (sourceElection.year !== undefined && !Number.isSafeInteger(sourceElection.year))) {
    invalid("Source election metadata is invalid");
  }
  const baseline = simulateElection(sourceElection, sourceBaseUnits, {
    schemaVersion: 1, electionId: sourceElection.id, actions: []
  });
  const candidates = [...sourceElection.candidates].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const ids = candidates.map(candidate => candidate.id);
  const content = JSON.stringify({
    election: {
      id: sourceElection.id, title: sourceElection.title, office: sourceElection.office,
      year: sourceElection.year ?? null, vintage: sourceElection.geographyVintage,
      dataStatus: sourceElection.dataStatus,
      candidates: candidates.map(({ id, name, partyLabel, color, ballotOrder }) =>
        [id, name, partyLabel ?? null, color, ballotOrder])
    },
    units: baseline.units.map(unit => [
      unit.geoId, unit.stateId, unit.eligibleVoters,
      ids.map(id => unit.votes[id]!), unit.otherBallots
    ])
  });
  return `sha256:${sha256Hex(content)}`;
}

function validateProjectStructure(raw: unknown): ScenarioProjectV2 {
  if (!plain(raw)) invalid("Scenario project must be an object");
  if (raw.schemaVersion !== 2) {
    throw new SimulationError("UNSUPPORTED_PROJECT_VERSION", `Unsupported project schema: ${String(raw.schemaVersion)}`);
  }
  onlyKeys(raw, ["schemaVersion", "format", "source", "registry", "scenario"]);
  if (raw.format !== FORMAT) invalid("Unknown scenario project format");
  if (!plain(raw.source)) invalid("Missing source identity");
  onlyKeys(raw.source, ["electionId", "geographyVintage", "dataStatus", "digest"]);
  const source = {
    electionId: requiredString(raw.source.electionId, "source.electionId"),
    geographyVintage: requiredString(raw.source.geographyVintage, "source.geographyVintage"),
    dataStatus: raw.source.dataStatus,
    digest: raw.source.digest as string
  };
  if (source.dataStatus !== "official" && source.dataStatus !== "synthetic" && source.dataStatus !== "estimated") {
    invalid("Unknown source dataStatus");
  }
  if (typeof source.digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(source.digest)) {
    invalid("Invalid source digest");
  }
  if (!plain(raw.registry)) invalid("Missing candidate registry changes");
  onlyKeys(raw.registry, ["additions", "overrides", "candidateOrder"]);
  const additions = checkedArray(raw.registry.additions, "registry.additions", MAX_CANDIDATES).map(value => candidateShape(value));
  const overrides = checkedArray(raw.registry.overrides, "registry.overrides", MAX_CANDIDATES).map(value => candidateShape(value, true));
  const candidateOrder = checkedArray(raw.registry.candidateOrder, "registry.candidateOrder", MAX_CANDIDATES)
    .map(id => requiredString(id, "registry.candidateOrder[]"));
  const unique = (items: readonly string[]): boolean => new Set(items).size === items.length;
  if (!unique(additions.map(candidate => candidate.id)) || !unique(overrides.map(candidate => candidate.id)) ||
      !unique(candidateOrder) || candidateOrder.length === 0) invalid("Duplicate or empty candidate registry IDs");
  const scenario = parseScenario(toJson(raw.scenario));
  if (scenario.electionId !== source.electionId) invalid("Scenario and source election IDs differ");
  if (scenario.actions.length > MAX_ACTIONS) invalid("Too many scenario actions");
  return {
    schemaVersion: 2,
    format: FORMAT,
    source: { ...source, dataStatus: source.dataStatus },
    registry: {
      additions, overrides: overrides.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), candidateOrder
    },
    scenario
  };
}

/** Read both v1 adjustment-only JSON and version-two portable project JSON. */
export function parseScenarioProject(json: string): ParsedScenarioProject {
  if (typeof json !== "string") invalid("Scenario project JSON must be a string");
  byteLimit(json);
  let value: unknown;
  try { value = JSON.parse(json); } catch { invalid("Malformed scenario project JSON"); }
  if (!plain(value)) invalid("Scenario project must be a JSON object");
  if (value.schemaVersion === 1) return parseScenario(json);
  return validateProjectStructure(value);
}

/** Canonically serialize v2 without altering v1's existing serializer. */
export function serializeScenarioProject(project: ScenarioProjectV2): string {
  return toJson(validateProjectStructure(project));
}

function trustedSourceIdentity(sourceElection: ElectionDefinition, sourceBaseUnits: readonly BaseUnitResult[]) {
  return {
    electionId: sourceElection.id,
    geographyVintage: sourceElection.geographyVintage,
    dataStatus: sourceElection.dataStatus,
    digest: fingerprintSourceElection(sourceElection, sourceBaseUnits)
  };
}

function hydrateV2(
  project: ScenarioProjectV2,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProject {
  const identity = trustedSourceIdentity(sourceElection, sourceBaseUnits);
  if (Object.keys(identity).some(key =>
    identity[key as keyof typeof identity] !== project.source[key as keyof typeof identity])) {
    throw new SimulationError("SOURCE_MISMATCH", "The trusted source election/fixture does not match this project digest and identity");
  }
  const sourceCandidates = new Map(sourceElection.candidates.map(candidate => [candidate.id, candidate]));
  const overrideIds = new Set<string>();
  for (const override of project.registry.overrides) {
    const original = sourceCandidates.get(override.id);
    if (!original || original.ballotOrder !== override.ballotOrder || sameCandidate(original, override) ||
        overrideIds.has(override.id)) invalid(`Invalid source-candidate metadata override: ${override.id}`);
    overrideIds.add(override.id);
  }
  let election: ElectionDefinition = {
    ...sourceElection, candidates: sourceElection.candidates.map(candidate => ({ ...candidate }))
  };
  let baseUnits = freshRows(sourceBaseUnits);
  for (const added of project.registry.additions) {
    if (sourceCandidates.has(added.id)) invalid(`Cannot redefine source candidate: ${added.id}`);
    const expanded = addCandidate(election, baseUnits, added);
    election = expanded.election;
    baseUnits = expanded.baseUnits;
  }
  election.candidates = election.candidates.map(candidate => {
    const override = project.registry.overrides.find(entry => entry.id === candidate.id);
    return override ? { ...override } : candidate;
  });
  validateRegistry(election);
  const electionIds = election.candidates.map(candidate => candidate.id);
  if (electionIds.length !== project.registry.candidateOrder.length ||
      electionIds.some(id => !project.registry.candidateOrder.includes(id))) {
    invalid("Candidate order does not match source candidates plus project additions");
  }
  election.candidates.sort((a, b) =>
    project.registry.candidateOrder.indexOf(a.id) - project.registry.candidateOrder.indexOf(b.id));
  const scenario = parseScenario(serializeScenario(project.scenario));
  const result = simulateElection(election, baseUnits, scenario);
  return { election, baseUnits, scenario, result };
}

/**
 * Export from source (unchanged trusted fixture) and working state (possibly expanded
 * registry + zero-vote rows). Reject altered source votes or source candidate IDs.
 */
export function createScenarioProject(
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[],
  election: ElectionDefinition,
  baseUnits: readonly BaseUnitResult[],
  scenario: Scenario
): ScenarioProjectV2 {
  validateRegistry(election);
  const source = trustedSourceIdentity(sourceElection, sourceBaseUnits);
  const sourceCandidates = new Map(sourceElection.candidates.map(candidate => [candidate.id, candidate]));
  const workingCandidates = new Map(election.candidates.map(candidate => [candidate.id, candidate]));
  if (workingCandidates.size !== election.candidates.length ||
      [...sourceCandidates.keys()].some(id => !workingCandidates.has(id))) invalid("Original source candidate registry cannot be removed or replaced");
  const overrides: Candidate[] = [];
  const additions: Candidate[] = [];
  for (const candidate of election.candidates) {
    validateCandidateMetadata(candidate, sourceCandidates.has(candidate.id));
    const original = sourceCandidates.get(candidate.id);
    if (original) {
      if (candidate.ballotOrder !== original.ballotOrder) invalid(`Cannot change original ballot order: ${candidate.id}`);
      if (!sameCandidate(original, candidate)) overrides.push({ ...candidate });
    } else additions.push({ ...candidate });
  }
  const project = validateProjectStructure({
    schemaVersion: 2, format: FORMAT, source,
    registry: { additions, overrides, candidateOrder: election.candidates.map(candidate => candidate.id) },
    scenario
  });
  const hydrated = hydrateV2(project, sourceElection, sourceBaseUnits);
  // Reject arbitrary replacement baseline rows, even when final actions mask the drift.
  const actualBase = simulateElection(election, baseUnits, {
    schemaVersion: 1, electionId: election.id, actions: []
  });
  const expectedBase = simulateElection(hydrated.election, hydrated.baseUnits, {
    schemaVersion: 1, electionId: hydrated.election.id, actions: []
  });
  if (JSON.stringify(actualBase.units) !== JSON.stringify(expectedBase.units)) {
    throw new SimulationError("SOURCE_MISMATCH", "Working baseline has been modified; only zero-vote additions are portable");
  }
  return project;
}

/** Requires the authoritative fixture to restore either v1 or v2; never trusts embedded vote rows. */
export function restoreScenarioProject(
  projectOrJson: string | ParsedScenarioProject,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProject {
  const parsed = typeof projectOrJson === "string" ? parseScenarioProject(projectOrJson) :
    parseScenarioProject(toJson(projectOrJson));
  if (parsed.schemaVersion === 2) return hydrateV2(parsed, sourceElection, sourceBaseUnits);
  // V1 has no digest/registry; it is usable only against the trusted supplied source.
  if (parsed.electionId !== sourceElection.id) {
    throw new SimulationError("SOURCE_MISMATCH", "V1 scenario electionId differs from the supplied source");
  }
  const baseUnits = freshRows(sourceBaseUnits);
  const election = { ...sourceElection, candidates: sourceElection.candidates.map(candidate => ({ ...candidate })) };
  const result = simulateElection(election, baseUnits, parsed);
  return { election, baseUnits, scenario: parsed, result };
}
