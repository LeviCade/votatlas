import type { Adjustment, BaseUnitResult, Candidate, CandidateId, ElectionDefinition, Scenario } from "@votatlas/contracts";
import { SimulationError, parseScenario, serializeScenario, simulateElection } from "./engine.js";

/** All functions return owned copies; no baseline vote counts are ever synthesized or lost. */
export interface CandidateRegistryExtension {
  election: ElectionDefinition;
  baseUnits: BaseUnitResult[];
  /** Existing proportional-other actions are frozen to the original registry for drift-free replay. */
  scenario?: Scenario;
}
export type CandidateAddition = Omit<Candidate, "ballotOrder"> & { ballotOrder?: number };

// These names can collide with JS object infrastructure in downstream consumers.
// Existing historical candidate IDs remain accepted; only newly minted IDs are restricted.
const RESERVED_IDS = new Set([
  "__proto__", "prototype", "constructor", "toString", "toLocaleString",
  "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"
]);

function invalid(message: string): never { throw new SimulationError("INVALID_CANDIDATE", message); }
function validateName(name: unknown): asserts name is string {
  if (typeof name !== "string" || name.length > 128 || name.trim().length === 0 || name !== name.trim()) {
    invalid("Candidate name must be a nonempty trimmed string of at most 128 characters");
  }
}
export function validateCandidateMetadata(candidate: Candidate, existing = false): void {
  if (typeof candidate !== "object" || candidate === null) invalid("Candidate must be an object");
  if (typeof candidate.id !== "string" || !candidate.id || candidate.id.length > 128 ||
      candidate.id !== candidate.id.trim() || /[\x00-\x1f\x7f]/.test(candidate.id)) {
    invalid("Candidate ID must be a stable nonempty string without whitespace at edges or controls");
  }
  if (!existing && RESERVED_IDS.has(candidate.id)) {
    throw new SimulationError("RESERVED_CANDIDATE_ID", `Reserved candidate ID: ${candidate.id}`);
  }
  if (!existing && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate.id)) {
    invalid("New candidate IDs must be 1-128 ASCII letters, digits, dots, underscores, colons or hyphens, beginning with a letter or digit");
  }
  validateName(candidate.name);
  if (typeof candidate.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(candidate.color)) {
    invalid("Candidate color must be a six-digit hexadecimal CSS color");
  }
  if (candidate.partyLabel !== undefined && (typeof candidate.partyLabel !== "string" ||
      !candidate.partyLabel.trim() || candidate.partyLabel !== candidate.partyLabel.trim() || candidate.partyLabel.length > 128)) {
    invalid("partyLabel must be a nonempty trimmed string of at most 128 characters when supplied");
  }
  if (!Number.isSafeInteger(candidate.ballotOrder) || candidate.ballotOrder < 0) {
    invalid("ballotOrder must be a nonnegative safe integer");
  }
}

export function validateRegistry(election: ElectionDefinition): void {
  if (typeof election !== "object" || election === null || !Array.isArray(election.candidates) || election.candidates.length === 0) {
    invalid("Election requires a nonempty candidate registry");
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const candidate of election.candidates) {
    validateCandidateMetadata(candidate, true);
    if (ids.has(candidate.id)) throw new SimulationError("DUPLICATE_CANDIDATE", `Duplicate candidate ID: ${candidate.id}`);
    if (orders.has(candidate.ballotOrder)) invalid(`Duplicate ballotOrder: ${candidate.ballotOrder}`);
    ids.add(candidate.id);
    orders.add(candidate.ballotOrder);
  }
}

function validateBaseline(election: ElectionDefinition, baseUnits: readonly BaseUnitResult[]): void {
  validateRegistry(election);
  // Reuse the engine's complete GEOID, count, eligibility, overflow and registry validation.
  simulateElection(election, baseUnits, { schemaVersion: 1, electionId: election.id, actions: [] });
}

function copyElection(election: ElectionDefinition): ElectionDefinition {
  return { ...election, candidates: election.candidates.map(candidate => ({ ...candidate })) };
}
function copyRows(rows: readonly BaseUnitResult[]): BaseUnitResult[] {
  return rows.map(row => ({ ...row, votes: { ...row.votes } }));
}

/** Adds a zero-vote fictional candidate. The original historical/synthetic baseline remains exact. */
export function addCandidate(
  election: ElectionDefinition,
  baseUnits: readonly BaseUnitResult[],
  addition: CandidateAddition,
  scenario?: Scenario
): CandidateRegistryExtension {
  validateBaseline(election, baseUnits);
  if (typeof addition !== "object" || addition === null) invalid("Candidate addition must be an object");
  const existing = election.candidates;
  if (existing.some(candidate => candidate.id === addition.id)) {
    throw new SimulationError("DUPLICATE_CANDIDATE", `Candidate ID already exists: ${String(addition.id)}`);
  }
  const highestOrder = existing.reduce((maximum, candidate) => Math.max(maximum, candidate.ballotOrder), 0);
  if (addition.ballotOrder === undefined && highestOrder === Number.MAX_SAFE_INTEGER) {
    throw new SimulationError("INTEGER_OVERFLOW", "Cannot choose a new ballotOrder after MAX_SAFE_INTEGER");
  }
  const ballotOrder = addition.ballotOrder ?? highestOrder + 1;
  const newCandidate: Candidate = {
    id: addition.id, name: addition.name, color: addition.color, ballotOrder,
    ...(addition.partyLabel === undefined ? {} : { partyLabel: addition.partyLabel })
  };
  validateCandidateMetadata(newCandidate);
  if (existing.some(candidate => candidate.ballotOrder === ballotOrder)) {
    invalid(`ballotOrder ${ballotOrder} already exists`);
  }
  let preservedScenario: Scenario | undefined;
  if (scenario !== undefined) {
    // Validate all prior actions against their original registry before changing candidate cardinality.
    simulateElection(election, baseUnits, scenario);
    const normalized = parseScenario(serializeScenario(scenario));
    const originalIds = existing.map(candidate => candidate.id).sort();
    const actions: Adjustment[] = normalized.actions.map(action =>
      action.type === "SET_SHARE" && action.redistribution.kind === "proportional-other"
        ? { ...action, redistribution: { kind: "explicit-donors" as const,
            candidateIds: originalIds.filter(id => id !== action.candidateId) } }
        : action
    );
    preservedScenario = { ...normalized, actions };
  }
  const next = copyElection(election);
  next.candidates.push(newCandidate);
  const units = copyRows(baseUnits);
  for (const row of units) Object.defineProperty(row.votes, newCandidate.id, { value: 0, enumerable: true, writable: true, configurable: true });
  return { election: next, baseUnits: units, ...(preservedScenario === undefined ? {} : { scenario: preservedScenario }) };
}

/** Metadata-only rename. Stable candidate ID, party and every baseline ballot remain unchanged. */
export function renameCandidate(election: ElectionDefinition, candidateId: CandidateId, name: string): ElectionDefinition {
  validateRegistry(election);
  validateName(name);
  if (!election.candidates.some(candidate => candidate.id === candidateId)) {
    throw new SimulationError("UNKNOWN_CANDIDATE", `Unknown candidate: ${candidateId}`);
  }
  const next = copyElection(election);
  for (const candidate of next.candidates) if (candidate.id === candidateId) candidate.name = name;
  return next;
}

/**
 * History-aware candidate removal. All callers MUST provide the full active scenario.
 * A zero baseline is not evidence of safety: current votes, references, and proportional
 * redistribution semantics can depend on the candidate even when final support is zero.
 */
export function removeZeroVoteCandidate(
  election: ElectionDefinition,
  baseUnits: readonly BaseUnitResult[],
  candidateId: CandidateId,
  scenario: Scenario
): CandidateRegistryExtension {
  validateBaseline(election, baseUnits);
  if (scenario === undefined || scenario === null) {
    throw new SimulationError("INVALID_SCENARIO", "Active scenario is required for safe candidate removal");
  }
  if (!election.candidates.some(candidate => candidate.id === candidateId)) {
    throw new SimulationError("UNKNOWN_CANDIDATE", `Unknown candidate: ${candidateId}`);
  }
  if (election.candidates.length === 1) invalid("Cannot remove the last candidate");
  if (baseUnits.some(row => row.votes[candidateId] !== 0)) {
    throw new SimulationError("CANDIDATE_HAS_VOTES", `Cannot remove ${candidateId}: baseline votes would be lost`);
  }
  // Simulate first.  This also validates all actions, capacities, geographic scopes,
  // and the candidate's support after the complete active history.
  const before = simulateElection(election, baseUnits, scenario);
  if (before.units.some(row => row.votes[candidateId] !== 0)) {
    throw new SimulationError("CANDIDATE_HAS_VOTES", `Cannot remove ${candidateId}: active history gives it votes`);
  }
  const normalized = parseScenario(serializeScenario(scenario));
  for (const action of normalized.actions) {
    if (action.type === "TRANSFER_PP" &&
        (action.fromCandidateId === candidateId || action.toCandidateId === candidateId)) {
      throw new SimulationError("CANDIDATE_IN_ACTIVE_HISTORY", `Cannot remove ${candidateId}: transfer ${action.id} refers to it`);
    }
    if (action.type === "SET_SHARE" && (
        action.candidateId === candidateId ||
        (action.redistribution.kind === "explicit-donors" && action.redistribution.candidateIds.includes(candidateId)) ||
        action.redistribution.kind === "proportional-other"
    )) {
      throw new SimulationError("CANDIDATE_IN_ACTIVE_HISTORY", `Cannot remove ${candidateId}: share ${action.id} depends on it`);
    }
  }
  const next = copyElection(election);
  next.candidates = next.candidates.filter(candidate => candidate.id !== candidateId);
  const units = copyRows(baseUnits);
  for (const row of units) delete row.votes[candidateId];
  const after = simulateElection(next, units, normalized);
  // Independent final numerical proof for every county/category.
  for (let index = 0; index < before.units.length; index++) {
    const beforeRow = before.units[index]!;
    const afterRow = after.units[index]!;
    if (beforeRow.geoId !== afterRow.geoId || beforeRow.ballots !== afterRow.ballots ||
        beforeRow.otherBallots !== afterRow.otherBallots ||
        Object.entries(afterRow.votes).some(([id, votes]) => votes !== beforeRow.votes[id])) {
      throw new SimulationError("CANDIDATE_IN_ACTIVE_HISTORY", `Cannot remove ${candidateId}: replay would change ballots`);
    }
  }
  return { election: next, baseUnits: units, scenario: normalized };
}
