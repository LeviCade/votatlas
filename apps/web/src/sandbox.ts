import type { Adjustment, BaseUnitResult, Candidate, ElectionDefinition, Scenario, SimulationResult } from "@votatlas/contracts";
import {
  addCandidate, appendAction, parseScenario, removeZeroVoteCandidate, renameCandidate,
  serializeScenario, simulateElection, SimulationError, undoLastAction,
} from "@votatlas/sim-core";
import type { CandidateAddition } from "@votatlas/sim-core";

export interface SandboxSession { scenario: Scenario; result: SimulationResult }
export const emptyScenario = (electionId: string): Scenario => ({ schemaVersion: 1, electionId, actions: [] });
export function initializeSandbox(election: ElectionDefinition, units: readonly BaseUnitResult[]): SandboxSession {
  const scenario = emptyScenario(election.id);
  return { scenario, result: simulateElection(election, units, scenario) };
}
export function applySandboxAction(election: ElectionDefinition, units: readonly BaseUnitResult[], current: SandboxSession, action: Adjustment): SandboxSession {
  const scenario = appendAction(current.scenario, action);
  return { scenario, result: simulateElection(election, units, scenario) };
}
export function undoSandboxAction(election: ElectionDefinition, units: readonly BaseUnitResult[], current: SandboxSession): SandboxSession {
  const scenario = undoLastAction(current.scenario);
  return { scenario, result: simulateElection(election, units, scenario) };
}
export function importSandboxScenario(election: ElectionDefinition, units: readonly BaseUnitResult[], raw: string): SandboxSession {
  const scenario = parseScenario(raw);
  return { scenario, result: simulateElection(election, units, scenario) };
}
export const exportSandboxScenario = (session: SandboxSession): string => serializeScenario(session.scenario);

/**
 * The editor owns one coherent immutable snapshot. There is no second voting
 * engine, and the original trusted fixture is NEVER mutated. Its additions
 * contain exactly zero BASELINE ballots in each original county.
 */
export interface RegistrySandboxSession extends SandboxSession {
  election: ElectionDefinition;
  baseUnits: BaseUnitResult[];
  baseline: SimulationResult;
}

function createSession(election: ElectionDefinition, baseUnits: readonly BaseUnitResult[], scenario: Scenario): RegistrySandboxSession {
  // Simulate both before committing. Any invalid/imported action prevents the whole transition.
  const baseline = simulateElection(election, baseUnits, emptyScenario(election.id));
  const result = simulateElection(election, baseUnits, scenario);
  return { election, baseUnits: [...baseUnits], scenario, result, baseline };
}

export function initializeRegistrySandbox(election: ElectionDefinition, baseUnits: readonly BaseUnitResult[]): RegistrySandboxSession {
  return createSession(election, baseUnits, emptyScenario(election.id));
}

export function applyRegistryAction(current: RegistrySandboxSession, action: Adjustment): RegistrySandboxSession {
  const scenario = appendAction(current.scenario, action);
  return createSession(current.election, current.baseUnits, scenario);
}

export function undoRegistryAction(current: RegistrySandboxSession): RegistrySandboxSession {
  return createSession(current.election, current.baseUnits, undoLastAction(current.scenario));
}

/** Preserve old proportional-other donors so adding a zero-vote candidate cannot change previous actions. */
export function addRegistryCandidate(current: RegistrySandboxSession, candidate: CandidateAddition): RegistrySandboxSession {
  const extension = addCandidate(current.election, current.baseUnits, candidate, current.scenario);
  return createSession(extension.election, extension.baseUnits, extension.scenario ?? current.scenario);
}

export function renameRegistryCandidate(current: RegistrySandboxSession, candidateId: string, name: string): RegistrySandboxSession {
  const election = renameCandidate(current.election, candidateId, name);
  return createSession(election, current.baseUnits, current.scenario);
}

export function actionReferencesCandidate(action: Adjustment, id: string): boolean {
  if (action.type === "TRANSFER_PP") return action.fromCandidateId === id || action.toCandidateId === id;
  if (action.type === "SET_SHARE") return action.candidateId === id ||
    (action.redistribution.kind === "explicit-donors" && action.redistribution.candidateIds.includes(id));
  return false;
}

/**
 * A zero BASELINE is not sufficient for safe removal: refuse active actions,
 * nonzero simulated votes, and any change to surviving results from replay.
 */
export function removeRegistryCandidate(
  current: RegistrySandboxSession, candidateId: string, trustedSource: ElectionDefinition,
): RegistrySandboxSession {
  if (trustedSource.candidates.some(candidate => candidate.id === candidateId)) {
    throw new SimulationError("CANDIDATE_HAS_VOTES", "The original fixture candidate cannot be removed; its source votes are protected.");
  }
  if (current.scenario.actions.some(action => actionReferencesCandidate(action, candidateId))) {
    throw new SimulationError("CANDIDATE_HAS_VOTES", "This candidate appears in the action history. Undo or reset dependent actions before removing.");
  }
  if (current.result.units.some(unit => (unit.votes[candidateId] ?? 0) !== 0)) {
    throw new SimulationError("CANDIDATE_HAS_VOTES", "This candidate currently has simulated votes. Undo or reset their adjustments first.");
  }
  const reduced = removeZeroVoteCandidate(current.election, current.baseUnits, candidateId);
  const next = createSession(reduced.election, reduced.baseUnits, current.scenario);
  for (const before of current.result.units) {
    const after = next.result.units.find(row => row.geoId === before.geoId);
    if (!after || before.ballots !== after.ballots || before.otherBallots !== after.otherBallots ||
        reduced.election.candidates.some(c => before.votes[c.id] !== after.votes[c.id])) {
      throw new SimulationError("INVALID_CANDIDATE", "Removing this candidate would change previous election results.");
    }
  }
  return next;
}

/** v1 remains backward compatible only when source registry is unchanged. */
export function importLegacyRegistryScenario(
  trustedElection: ElectionDefinition, trustedUnits: readonly BaseUnitResult[], raw: string,
): RegistrySandboxSession {
  const scenario = parseScenario(raw);
  return createSession(trustedElection, trustedUnits, scenario);
}

/** Useful for recognizing derived entrants without treating ballot order as a party index. */
export function isHypotheticalCandidate(candidate: Candidate, trustedSource: ElectionDefinition): boolean {
  return !trustedSource.candidates.some(original => original.id === candidate.id);
}
