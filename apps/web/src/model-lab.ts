import type { BaseUnitResult, ElectionDefinition } from "@votatlas/contracts";
import * as sim from "@votatlas/sim-core";
import type { CohortAction, CohortSimulationResult, SyntheticCohortPartition } from "@votatlas/sim-core";
import type { RegistrySandboxSession } from "./sandbox";
import { hydrateRegistrySandbox } from "./sandbox";

/** One opt-in, source-bound synthetic disjoint partition. No fabricated county demographics. */
export interface SyntheticModelSession {
  partition: SyntheticCohortPartition;
  actions: CohortAction[];
  output: CohortSimulationResult;
  seed: string;
}
/** Compare numeric county invariants, not JavaScript object key insertion order. */
function sameCountyVotes(a: readonly BaseUnitResult[], b: readonly BaseUnitResult[]): boolean {
  if (a.length !== b.length) return false;
  const expected = new Map(b.map(row => [row.geoId, row]));
  for (const row of a) {
    const other = expected.get(row.geoId);
    if (!other || row.stateId !== other.stateId ||
        row.otherBallots !== other.otherBallots ||
        row.eligibleVoters !== other.eligibleVoters) return false;
    const keys = Object.keys(row.votes);
    if (keys.length !== Object.keys(other.votes).length ||
        keys.some(id => row.votes[id] !== other.votes[id])) return false;
  }
  return true;
}
interface CanonicalModelApi {
  createSyntheticDemoPartition?: (election: ElectionDefinition, ordinaryResultUnits: readonly BaseUnitResult[], seed?: string) => SyntheticCohortPartition;
  createScenarioProjectV3?: (sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
    workingElection: ElectionDefinition, workingUnits: readonly BaseUnitResult[],
    scenario: RegistrySandboxSession["scenario"], partition: SyntheticCohortPartition,
    actions: readonly CohortAction[], model?: ReturnType<typeof sim.createSyntheticDemoModel>) => unknown;
}
const api = sim as typeof sim & CanonicalModelApi;
export const modelGeneratorReady = typeof api.createSyntheticDemoPartition === "function";
export const canonicalV3Ready = typeof api.createScenarioProjectV3 === "function";
function unsupported(): never {
  throw new Error("Canonical synthetic model support is not yet integrated. Cohort editing and project persistence are unavailable.");
}
function build(ordinary: RegistrySandboxSession, partition: SyntheticCohortPartition,
  actions: readonly CohortAction[], seed: string): SyntheticModelSession {
  const output = sim.simulateCohortPartition(ordinary.election, ordinary.result.units, partition, actions);
  if (actions.length === 0) {
    // Every county candidate count AND other ballots must be exactly reconstructed.
    if (!sameCountyVotes(output.result.units, ordinary.result.units)) {
      throw new Error("Synthetic partition must exactly reconstruct the current standard election before applying model actions.");
    }
  }
  return { partition, actions: [...actions], output, seed };
}
export function beginSyntheticModel(ordinary: RegistrySandboxSession, seed = "votatlas-fictional-2026"): SyntheticModelSession {
  if (!api.createSyntheticDemoPartition) return unsupported();
  const partition = api.createSyntheticDemoPartition(ordinary.election, ordinary.result.units, seed);
  return build(ordinary, partition, [], seed);
}
export function appendModelAction(ordinary: RegistrySandboxSession, current: SyntheticModelSession, action: CohortAction): SyntheticModelSession {
  if (current.actions.some(existing => existing.id === action.id)) throw new Error("Duplicate synthetic model action ID.");
  return build(ordinary, current.partition, [...current.actions, action], current.seed);
}
export function undoModelAction(ordinary: RegistrySandboxSession, current: SyntheticModelSession): SyntheticModelSession {
  return build(ordinary, current.partition, current.actions.slice(0, -1), current.seed);
}
/** Replaying the same partition without cohort actions preserves the ordinary scenario. */
export function resetModelActions(ordinary: RegistrySandboxSession, current: SyntheticModelSession): SyntheticModelSession {
  return build(ordinary, current.partition, [], current.seed);
}
export function exportProjectWithModel(
  ordinary: RegistrySandboxSession, model: SyntheticModelSession,
  trustedElection: ElectionDefinition, trustedUnits: readonly BaseUnitResult[],
): string {
  if (!api.createScenarioProjectV3) return unsupported();
  const project = api.createScenarioProjectV3(
    trustedElection, trustedUnits, ordinary.election, ordinary.baseUnits,
    ordinary.scenario, model.partition, model.actions,
    sim.createSyntheticDemoModel(model.seed)
  );
  return (sim.serializeScenarioProject as (value: unknown) => string)(project);
}
interface RestoredWithModel {
  election: ElectionDefinition;
  baseUnits: BaseUnitResult[];
  scenario: RegistrySandboxSession["scenario"];
  cohortPartition: SyntheticCohortPartition;
  cohortActions: CohortAction[];
  cohortResult: CohortSimulationResult;
  intermediate?: { units: BaseUnitResult[] };
  model?: { seed?: string };
}
function hasModel(value: object): value is RestoredWithModel {
  return "cohortResult" in value && "cohortPartition" in value && "cohortActions" in value;
}
export function importCanonicalProject(
  json: string, trustedElection: ElectionDefinition, trustedUnits: readonly BaseUnitResult[],
): { ordinary: RegistrySandboxSession; model: SyntheticModelSession | null } {
  const restored = sim.restoreScenarioProject(json, trustedElection, trustedUnits);
  const ordinary = hydrateRegistrySandbox(restored.election, restored.baseUnits, restored.scenario);
  if (!hasModel(restored)) return { ordinary, model: null };
  if (!canonicalV3Ready) return unsupported();
  if (restored.intermediate && !sameCountyVotes(restored.intermediate.units, ordinary.result.units))
    throw new Error("Canonical imported pre-model election does not match the trusted replay.");
  const model = build(ordinary, restored.cohortPartition, restored.cohortActions,
    restored.model?.seed ?? restored.cohortPartition.partitionId);
  if (!sameCountyVotes(model.output.result.units, restored.cohortResult.result.units))
    throw new Error("Canonical project cohort output failed deterministic validation.");
  return { ordinary, model };
}
