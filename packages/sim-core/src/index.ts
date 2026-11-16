export { addCandidate, renameCandidate, removeZeroVoteCandidate } from "./candidate-registry.js";
export type { CandidateAddition, CandidateRegistryExtension } from "./candidate-registry.js";
export { SimulationError, simulateElection, undoLastAction, appendAction, serializeScenario, parseScenario } from "./engine.js";
export type { SimulationErrorCode } from "./engine.js";
export type {
  Adjustment, BaseUnitResult, Candidate, CandidateId, DataStatus, ElectionDefinition,
  GeoId, GeoScope, Redistribution, ResultTotals, Scenario, SimulationResult, UnitResult
} from "@votatlas/contracts";
