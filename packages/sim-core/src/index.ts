export {
  createScenarioProject, serializeScenarioProject, parseScenarioProject,
  restoreScenarioProject, fingerprintSourceElection, MAX_SCENARIO_PROJECT_BYTES
} from "./scenario-project.js";
export type { ScenarioProjectV2, ParsedScenarioProject, RestoredScenarioProject } from "./scenario-project.js";
export { addCandidate, renameCandidate, removeZeroVoteCandidate } from "./candidate-registry.js";
export type { CandidateAddition, CandidateRegistryExtension } from "./candidate-registry.js";
export { SimulationError, simulateElection, undoLastAction, appendAction, serializeScenario, parseScenario } from "./engine.js";
export type { SimulationErrorCode } from "./engine.js";
export type {
  Adjustment, BaseUnitResult, Candidate, CandidateId, DataStatus, ElectionDefinition,
  GeoId, GeoScope, Redistribution, ResultTotals, Scenario, SimulationResult, UnitResult
} from "@votatlas/contracts";
export { simulateCohortPartition } from "./cohorts.js";
export type { CohortAction, CohortCell, CohortCounty, CohortCellDelta, CohortDefinition,
  CohortSimulationResult, SyntheticCohortPartition } from "./cohorts.js";
