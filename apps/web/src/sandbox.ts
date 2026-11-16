import type { Adjustment, BaseUnitResult, ElectionDefinition, Scenario, SimulationResult } from "@votatlas/contracts";
import { appendAction, parseScenario, serializeScenario, simulateElection, undoLastAction } from "@votatlas/sim-core";

export interface SandboxSession { scenario: Scenario; result: SimulationResult }
export const emptyScenario = (electionId: string): Scenario => ({ schemaVersion: 1, electionId, actions: [] });
export function initializeSandbox(election: ElectionDefinition, units: readonly BaseUnitResult[]): SandboxSession {
  const scenario = emptyScenario(election.id);
  return { scenario, result: simulateElection(election, units, scenario) };
}
/** The engine validates the entire candidate action list BEFORE the caller commits a state change. */
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
  // Checks election ID, county IDs, action validity, candidate IDs and feasibility.
  return { scenario, result: simulateElection(election, units, scenario) };
}
export const exportSandboxScenario = (session: SandboxSession): string => serializeScenario(session.scenario);
