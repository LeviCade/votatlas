export {
  createScenarioProject, serializeScenarioProject, parseScenarioProject,
  restoreScenarioProject, createScenarioProjectV3, fingerprintSourceElection, MAX_SCENARIO_PROJECT_BYTES
} from "./scenario-project.js";
export type { ScenarioProjectV2, ScenarioProjectV3, CohortModelProvenance, ParsedScenarioProject, RestoredScenarioProject, RestoredScenarioProjectV3 } from "./scenario-project.js";
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

export { createSyntheticDemoPartition, createSyntheticDemoModel, FICTIONAL_COHORT_MODEL_DESCRIPTION, FICTIONAL_COHORT_MODEL_VERSION, DEFAULT_FICTIONAL_COHORT_SEED } from "./demo-cohorts.js";
