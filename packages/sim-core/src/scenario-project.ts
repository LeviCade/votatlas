import type {
  BaseUnitResult, Candidate, DataStatus, ElectionDefinition, Scenario, SimulationResult
} from "@votatlas/contracts";
import { addCandidate, validateCandidateMetadata, validateRegistry } from "./candidate-registry.js";
import { parseScenario, serializeScenario, simulateElection, SimulationError } from "./engine.js";
import { sha256Hex } from "./sha256.js";
import { simulateCohortPartition } from "./cohorts.js";
import type { CohortAction, CohortSimulationResult, SyntheticCohortPartition } from "./cohorts.js";
import { createSyntheticDemoModel, fictionalDemoPartitionId, FICTIONAL_COHORT_MODEL_VERSION } from "./demo-cohorts.js";
import { COMPOSITION_MODEL_ID, COMPOSITION_MODEL_VERSION, compositionPartitionId } from "./composition.js";

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
/** Canonical v3 extends v2's source, registry, and ordered classic scenario fields. */
export interface CohortModelProvenance {
  kind: "synthetic";
  modelId: string;
  modelVersion: string;
  seed: string;
  description: string;
}
export interface ScenarioProjectV3 extends Omit<ScenarioProjectV2, "schemaVersion"> {
  schemaVersion: 3;
  cohort: {
    model: CohortModelProvenance;
    /** Must reconcile with the result AFTER ordinary scenario replay. */
    partition: SyntheticCohortPartition;
    /** Ordered; separate from canonical v1 classic actions. */
    actions: CohortAction[];
    /** Source/registry/classic-history/result fingerprint binding. */
    boundTo: string;
  };
}
export type ParsedScenarioProject = ScenarioProjectV3 | ScenarioProjectV2 | Scenario;
export interface RestoredScenarioProjectV3 extends RestoredScenarioProject {
  project: ScenarioProjectV3;
  intermediate: SimulationResult;
  cohortResult: CohortSimulationResult;
  cohortPartition: SyntheticCohortPartition;
  cohortActions: CohortAction[];
  model: CohortModelProvenance;
}

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
  if (value.schemaVersion === 3) return validateV3Structure(value);
  return validateProjectStructure(value);
}

/** Canonically serialize v2 without altering v1's existing serializer. */
export function serializeScenarioProject(project: ScenarioProjectV2 | ScenarioProjectV3): string {
  return toJson(project.schemaVersion === 3 ? validateV3Structure(project) : validateProjectStructure(project));
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
  projectOrJson: ScenarioProjectV3,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProjectV3;
export function restoreScenarioProject(
  projectOrJson: string | ParsedScenarioProject,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProject | RestoredScenarioProjectV3;
export function restoreScenarioProject(
  projectOrJson: string | ParsedScenarioProject,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProject {
  const parsed = typeof projectOrJson === "string" ? parseScenarioProject(projectOrJson) :
    parseScenarioProject(toJson(projectOrJson));
  if (parsed.schemaVersion === 3) return hydrateV3(parsed, sourceElection, sourceBaseUnits);
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


// ---------------------------------------------------------------------------
// CANONICAL V3: v2 candidate registry/ordinary history, plus one bound cohort layer
// ---------------------------------------------------------------------------
const MAX_COHORTS = 64;
const MAX_COHORT_COUNTIES = 4000;
const MAX_COHORT_ACTIONS = 2500;
const validDigest = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
const lex = (a: string, b: string): number => a === b ? 0 : a < b ? -1 : 1;
function safeCount(raw: unknown, field: string): number {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) invalid(`Invalid nonnegative integer ${field}`);
  return raw;
}
function normalizePartition(raw: unknown): SyntheticCohortPartition {
  if (!plain(raw)) invalid("Cohort partition must be a JSON object");
  onlyKeys(raw, ["schemaVersion", "dataStatus", "partitionId", "kind", "dimensionIds", "universe", "cohorts", "counties"], ["jointCountsSource"]);
  if (raw.schemaVersion !== 1 || raw.dataStatus !== "synthetic" || raw.universe !== "modeled-ballots" ||
      (raw.kind !== "single" && raw.kind !== "joint")) invalid("Unsupported cohort schema, data status, kind or universe");
  const dimensionIds = checkedArray(raw.dimensionIds, "dimensionIds", 16)
    .map(v => requiredString(v, "dimension ID"));
  if (!dimensionIds.length || new Set(dimensionIds).size !== dimensionIds.length) invalid("Empty or duplicate dimensions");
  if ((raw.kind === "single" && (dimensionIds.length !== 1 || raw.jointCountsSource !== undefined)) ||
      (raw.kind === "joint" && (dimensionIds.length < 2 || raw.jointCountsSource !== "explicit-synthetic-cross-tabulation"))) {
    invalid("Overlapping dimensions require one explicit synthetic joint cross-tabulation");
  }
  const cohortDefs = checkedArray(raw.cohorts, "cohorts", MAX_COHORTS);
  if (!cohortDefs.length) invalid("At least one cohort is required");
  const cohorts = cohortDefs.map(value => {
    if (!plain(value)) invalid("Invalid cohort definition");
    onlyKeys(value, ["id", "label", "dimensions"]);
    if (!plain(value.dimensions) || Object.keys(value.dimensions).length !== dimensionIds.length) invalid("Incomplete cohort dimension tuple");
    const dimensions = Object.fromEntries(dimensionIds.map(dim => [dim,
      requiredString((value.dimensions as Record<string, unknown>)[dim], `cohort dimension ${dim}`)
    ])) as Record<string, string>;
    return { id: requiredString(value.id, "cohort ID"), label: requiredString(value.label, "cohort label"), dimensions };
  });
  if (new Set(cohorts.map(c => c.id)).size !== cohorts.length ||
      new Set(cohorts.map(c => JSON.stringify(dimensionIds.map(dim => c.dimensions[dim])))).size !== cohorts.length) {
    invalid("Duplicate cohort ID or overlapping demographic tuple");
  }
  const countyDefs = checkedArray(raw.counties, "cohort counties", MAX_COHORT_COUNTIES);
  if (!countyDefs.length) invalid("Cohort partition requires county rows");
  const counties = countyDefs.map(value => {
    if (!plain(value)) invalid("Invalid cohort county");
    onlyKeys(value, ["geoId", "cells"]);
    const geoId = requiredString(value.geoId, "cohort county GEOID");
    const cells = checkedArray(value.cells, "cohort cells", MAX_COHORTS).map(cell => {
      if (!plain(cell)) invalid("Invalid cohort cell");
      onlyKeys(cell, ["cohortId", "eligibleVoters", "votes", "otherBallots"]);
      if (!plain(cell.votes)) invalid("Cohort cell votes must be an object");
      const votes = Object.fromEntries(Object.keys(cell.votes).sort(lex).map(id => [
        requiredString(id, "candidate ID"), safeCount((cell.votes as Record<string, unknown>)[id], `votes.${id}`)
      ])) as Record<string, number>;
      return {
        cohortId: requiredString(cell.cohortId, "cohort cell ID"),
        eligibleVoters: cell.eligibleVoters === null ? null : safeCount(cell.eligibleVoters, "eligibleVoters"),
        votes, otherBallots: safeCount(cell.otherBallots, "otherBallots")
      };
    }).sort((a, b) => lex(a.cohortId, b.cohortId));
    if (cells.length !== cohorts.length || new Set(cells.map(c => c.cohortId)).size !== cells.length ||
        cells.some(c => !cohorts.some(g => g.id === c.cohortId))) invalid(`Incomplete or duplicate cohort cells in ${geoId}`);
    return { geoId, cells };
  }).sort((a, b) => lex(a.geoId, b.geoId));
  if (new Set(counties.map(c => c.geoId)).size !== counties.length) invalid("Duplicate cohort county GEOID");
  const result: SyntheticCohortPartition = {
    schemaVersion: 1, dataStatus: "synthetic", partitionId: requiredString(raw.partitionId, "partition ID"),
    kind: raw.kind, dimensionIds, universe: "modeled-ballots",
    cohorts: cohorts.sort((a, b) => lex(a.id, b.id)), counties
  };
  if (raw.kind === "joint") result.jointCountsSource = "explicit-synthetic-cross-tabulation";
  return result;
}
function normalizeCohortScope(raw: unknown): CohortAction["scope"] {
  if (!plain(raw)) invalid("Cohort action scope is invalid");
  switch (raw.kind) {
    case "national": onlyKeys(raw, ["kind"]); return { kind: "national" };
    case "state": onlyKeys(raw, ["kind", "stateId"]);
      return { kind: "state", stateId: requiredString(raw.stateId, "state ID") };
    case "county": {
      onlyKeys(raw, ["kind", "countyIds"]);
      const countyIds = checkedArray(raw.countyIds, "scope.countyIds", MAX_COHORT_COUNTIES)
        .map(id => requiredString(id, "county ID"));
      if (!countyIds.length || new Set(countyIds).size !== countyIds.length) invalid("Invalid county scope");
      return { kind: "county", countyIds: countyIds.sort(lex) };
    }
    case "district": case "precinct":
      throw new SimulationError("UNSUPPORTED_SCOPE", "Cohort project needs county atoms; district/precinct unsupported");
    default: invalid("Unsupported cohort action scope");
  }
}
function normalizeCohortActions(raw: unknown): CohortAction[] {
  const actions = checkedArray(raw, "cohort.actions", MAX_COHORT_ACTIONS);
  const ids = new Set<string>();
  return actions.map(value => {
    if (!plain(value)) invalid("Invalid cohort action");
    const id = requiredString(value.id, "cohort action ID");
    if (ids.has(id)) invalid(`Duplicate cohort action ID ${id}`);
    ids.add(id);
    const scope = normalizeCohortScope(value.scope);
    const cohortIds = checkedArray(value.cohortIds, "cohortIds", MAX_COHORTS)
      .map(x => requiredString(x, "cohort action selection"));
    if (new Set(cohortIds).size !== cohortIds.length) invalid("Duplicate cohort selection");
    cohortIds.sort(lex);
    if (value.type === "COHORT_TRANSFER_PP") {
      onlyKeys(value, ["type", "id", "scope", "cohortIds", "fromCandidateId", "toCandidateId", "points"]);
      if (typeof value.points !== "number" || !Number.isFinite(value.points) || value.points < 0 || value.points > 100) {
        invalid("Cohort transfer percentage must be from 0 to 100");
      }
      const fromCandidateId = requiredString(value.fromCandidateId, "donor candidate");
      const toCandidateId = requiredString(value.toCandidateId, "recipient candidate");
      if (fromCandidateId === toCandidateId) invalid("Cohort transfer requires distinct candidates");
      return { type: "COHORT_TRANSFER_PP" as const, id, scope, cohortIds,
        fromCandidateId, toCandidateId, points: value.points };
    }
    if (value.type === "COHORT_TURNOUT_SCALE") {
      onlyKeys(value, ["type", "id", "scope", "cohortIds", "factor"]);
      if (typeof value.factor !== "number" || !Number.isFinite(value.factor) || value.factor < 0) invalid("Cohort turnout factor must be finite and nonnegative");
      return { type: "COHORT_TURNOUT_SCALE" as const, id, scope, cohortIds, factor: value.factor };
    }
    invalid("Unsupported cohort action type");
  });
}
function normalizeModel(raw: unknown): CohortModelProvenance {
  if (!plain(raw)) invalid("Missing synthetic model provenance");
  onlyKeys(raw, ["kind", "modelId", "modelVersion", "seed", "description"]);
  if (raw.kind !== "synthetic") invalid("Historical/observed demographic models are prohibited");
  return {
    kind: "synthetic",
    modelId: requiredString(raw.modelId, "model ID"),
    modelVersion: requiredString(raw.modelVersion, "model version"),
    seed: requiredString(raw.seed, "model seed"),
    description: requiredString(raw.description, "model description")
  };
}
function validateV3Structure(raw: unknown): ScenarioProjectV3 {
  if (!plain(raw)) invalid("V3 project must be an object");
  if (raw.schemaVersion !== 3) throw new SimulationError("UNSUPPORTED_PROJECT_VERSION", "Project v3 required");
  onlyKeys(raw, ["schemaVersion", "format", "source", "registry", "scenario", "cohort"]);
  const v2 = validateProjectStructure({
    schemaVersion: 2, format: raw.format, source: raw.source, registry: raw.registry, scenario: raw.scenario
  });
  if (v2.source.dataStatus !== "synthetic") invalid("Cohort projects require synthetic source data");
  if (!plain(raw.cohort)) invalid("Missing cohort project layer");
  onlyKeys(raw.cohort, ["model", "partition", "actions", "boundTo"]);
  const boundTo = raw.cohort.boundTo;
  if (!validDigest(boundTo)) invalid("Invalid cohort ordinary-history binding digest");
  return {
    ...v2, schemaVersion: 3,
    cohort: {
      model: normalizeModel(raw.cohort.model),
      partition: normalizePartition(raw.cohort.partition),
      actions: normalizeCohortActions(raw.cohort.actions),
      boundTo
    }
  };
}
function cohortBinding(v2: ScenarioProjectV2, election: ElectionDefinition, intermediate: SimulationResult): string {
  const baseDigest = fingerprintSourceElection(election, intermediate.units);
  // Includes source identity, full v2 registry and action order, even when two
  // different ordered logs happen to produce the same intermediate vote totals.
  return `sha256:${sha256Hex(JSON.stringify({ project: serializeScenarioProject(v2), intermediate: baseDigest }))}`;
}
function hydrateV3(
  project: ScenarioProjectV3,
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[]
): RestoredScenarioProjectV3 {
  const v2: ScenarioProjectV2 = {
    schemaVersion: 2, format: FORMAT, source: project.source, registry: project.registry, scenario: project.scenario
  };
  const hydrated = hydrateV2(v2, sourceElection, sourceBaseUnits);
  const binding = cohortBinding(v2, hydrated.election, hydrated.result);
  if (project.cohort.boundTo !== binding) {
    throw new SimulationError("SOURCE_MISMATCH", "Cohort partition is stale: source, candidate registry or ordered classic history changed. Rebuild it explicitly.");
  }
  if (project.cohort.model.modelId === "fictional-cohort-demo" &&
      (project.cohort.model.modelVersion !== FICTIONAL_COHORT_MODEL_VERSION ||
       project.cohort.partition.partitionId !== fictionalDemoPartitionId(project.cohort.model.seed))) {
    invalid("Fictional demo seed/version and saved partition do not match");
  }
  if (project.cohort.model.modelId === COMPOSITION_MODEL_ID &&
      (project.cohort.model.modelVersion !== COMPOSITION_MODEL_VERSION ||
       project.cohort.partition.partitionId !== compositionPartitionId(project.cohort.model.seed))) {
    invalid("Source-labeled hypothetical composition hash/version does not match partition");
  }
  const cohortResult = simulateCohortPartition(hydrated.election, hydrated.result.units,
    project.cohort.partition, project.cohort.actions);
  return {
    ...hydrated, project, intermediate: hydrated.result, result: cohortResult.result, cohortResult,
    cohortPartition: structuredClone(project.cohort.partition),
    cohortActions: structuredClone(project.cohort.actions), model: { ...project.cohort.model }
  };
}

/**
 * Create the *one* canonical v3 project. The trusted source never contains invented
 * demographic rows; partition cells are explicit, validated synthetic modeled state.
 * Standard adjustments always execute before cohort edits.
 */
export function createScenarioProjectV3(
  sourceElection: ElectionDefinition,
  sourceBaseUnits: readonly BaseUnitResult[],
  election: ElectionDefinition,
  baseUnits: readonly BaseUnitResult[],
  scenario: Scenario,
  cohortPartition: SyntheticCohortPartition,
  cohortActions: readonly CohortAction[],
  model?: CohortModelProvenance
): ScenarioProjectV3 {
  if (!model && cohortPartition.partitionId !== fictionalDemoPartitionId(createSyntheticDemoModel().seed)) {
    invalid("Non-default synthetic partitions must supply explicit model provenance, including seed and version");
  }
  const provenance = model ?? createSyntheticDemoModel();
  if (provenance.modelId === "fictional-cohort-demo" &&
      cohortPartition.partitionId !== fictionalDemoPartitionId(provenance.seed)) {
    invalid("Fictional model seed/version does not match the cohort partition identifier");
  }
  if (provenance.modelId === COMPOSITION_MODEL_ID &&
      (provenance.modelVersion !== COMPOSITION_MODEL_VERSION ||
       cohortPartition.partitionId !== compositionPartitionId(provenance.seed))) {
    invalid("Source-labeled hypothetical composition provenance does not match partition");
  }
  const v2 = createScenarioProject(sourceElection, sourceBaseUnits, election, baseUnits, scenario);
  const intermediate = hydrateV2(v2, sourceElection, sourceBaseUnits);
  const candidate = validateV3Structure({
    ...v2, schemaVersion: 3,
    cohort: { model: provenance, partition: cohortPartition, actions: cohortActions,
      boundTo: cohortBinding(v2, intermediate.election, intermediate.result) }
  });
  // Validate all modeled ballots, capacities, replay and bundle size before returning.
  toJson(candidate);
  hydrateV3(candidate, sourceElection, sourceBaseUnits);
  return candidate;
}
