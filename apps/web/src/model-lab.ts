import type { BaseUnitResult, ElectionDefinition } from "@votatlas/contracts";
import * as sim from "@votatlas/sim-core";
import type { CohortAction, CohortSimulationResult, SyntheticCohortPartition } from "@votatlas/sim-core";
import type { RegistrySandboxSession } from "./sandbox";
import type { AcsDimension, AcsCountyMarginal, AvailableAcsSource } from "./acs-source";
import type { CohortModelProvenance } from "@votatlas/sim-core";
import { hydrateRegistrySandbox } from "./sandbox";

/** One opt-in, source-bound synthetic disjoint partition. No fabricated county demographics. */
export interface SyntheticModelSession {
  partition: SyntheticCohortPartition;
  actions: CohortAction[];
  output: CohortSimulationResult;
  seed: string;
  /** A Census composition is source data; its modeled ballot partition is always hypothetical. */
  dimension?: "fictional" | AcsDimension;
  provenance?: CohortModelProvenance;
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
export interface CompositionSourceProvenance {
  publisher: "US Census Bureau";
  survey: "ACS";
  surveyYear: 2024;
  period: "5-year";
  geographyVintage: "2020";
  sourceUrl: string;
  sourceDigest: string;
  releaseStatus: "verified";
  dimension: AcsDimension;
  tableId: "B01001" | "B15003";
  profileDigest?: string;
}
export interface CompositionModelAssumptions {
  kind: "explicit-hypothetical-weights";
  universe: "population_18_plus" | "population_25_plus";
  turnoutWeightByCategory: Record<string, number>;
  candidatePreference: {kind:"county-neutral"};
  eligibleAllocation: "ballots-plus-population-weighted-slack";
}
export interface CompositionFit {
  partition: SyntheticCohortPartition;
  modelProvenance: CohortModelProvenance;
  audit: { dimension?: AcsDimension; sourceDigest?: string; profileDigest?: string };
}
interface CanonicalModelApi {
  fitSyntheticElectorateFromComposition?: (
    election: ElectionDefinition, postClassicUnits: readonly BaseUnitResult[],
    marginal: readonly AcsCountyMarginal[], provenance: CompositionSourceProvenance,
    assumptions: CompositionModelAssumptions
  ) => CompositionFit;
  createSyntheticDemoPartition?: (election: ElectionDefinition, ordinaryResultUnits: readonly BaseUnitResult[], seed?: string) => SyntheticCohortPartition;
  createScenarioProjectV3?: (sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
    workingElection: ElectionDefinition, workingUnits: readonly BaseUnitResult[],
    scenario: RegistrySandboxSession["scenario"], partition: SyntheticCohortPartition,
    actions: readonly CohortAction[], model?: ReturnType<typeof sim.createSyntheticDemoModel>) => unknown;
}
const api = sim as typeof sim & CanonicalModelApi;
export const modelGeneratorReady = typeof api.createSyntheticDemoPartition === "function";
export const canonicalV3Ready = typeof api.createScenarioProjectV3 === "function";
export const compositionFitReady = typeof api.fitSyntheticElectorateFromComposition === "function";
function unsupported(): never {
  throw new Error("Canonical synthetic model support is not yet integrated. Cohort editing and project persistence are unavailable.");
}
function build(ordinary: RegistrySandboxSession, partition: SyntheticCohortPartition,
  actions: readonly CohortAction[], seed: string,
  provenance?: CohortModelProvenance, dimension: "fictional" | AcsDimension = "fictional"): SyntheticModelSession {
  const output = sim.simulateCohortPartition(ordinary.election, ordinary.result.units, partition, actions);
  if (actions.length === 0) {
    // Every county candidate count AND other ballots must be exactly reconstructed.
    if (!sameCountyVotes(output.result.units, ordinary.result.units)) {
      throw new Error("Synthetic partition must exactly reconstruct the current standard election before applying model actions.");
    }
  }
  return { partition, actions: [...actions], output, seed, dimension, provenance };
}
export function beginSyntheticModel(ordinary: RegistrySandboxSession, seed = "votatlas-fictional-2026"): SyntheticModelSession {
  if (!api.createSyntheticDemoPartition) return unsupported();
  const partition = api.createSyntheticDemoPartition(ordinary.election, ordinary.result.units, seed);
  return build(ordinary, partition, [], seed);
}
export function appendModelAction(ordinary: RegistrySandboxSession, current: SyntheticModelSession, action: CohortAction): SyntheticModelSession {
  if (current.actions.some(existing => existing.id === action.id)) throw new Error("Duplicate synthetic model action ID.");
  return build(ordinary, current.partition, [...current.actions, action], current.seed,
    current.provenance, current.dimension);
}
export function undoModelAction(ordinary: RegistrySandboxSession, current: SyntheticModelSession): SyntheticModelSession {
  return build(ordinary, current.partition, current.actions.slice(0, -1), current.seed,
    current.provenance, current.dimension);
}
/** Replaying the same partition without cohort actions preserves the ordinary scenario. */
export function resetModelActions(ordinary: RegistrySandboxSession, current: SyntheticModelSession): SyntheticModelSession {
  return build(ordinary, current.partition, [], current.seed,
    current.provenance, current.dimension);
}
export function exportProjectWithModel(
  ordinary: RegistrySandboxSession, model: SyntheticModelSession,
  trustedElection: ElectionDefinition, trustedUnits: readonly BaseUnitResult[],
): string {
  if (!api.createScenarioProjectV3) return unsupported();
  const project = api.createScenarioProjectV3(
    trustedElection, trustedUnits, ordinary.election, ordinary.baseUnits,
    ordinary.scenario, model.partition, model.actions,
    model.provenance ?? sim.createSyntheticDemoModel(model.seed)
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
  const dim=restored.model?.modelId === "fictional-cohort-demo" ? "fictional"
    : restored.cohortPartition.dimensionIds.some(id=>id.toLowerCase().includes("education")) ? "education"
    : restored.cohortPartition.dimensionIds.some(id=>id.toLowerCase().includes("age")) ? "age"
    : "fictional";
  const model = build(ordinary, restored.cohortPartition, restored.cohortActions,
    restored.model?.seed ?? restored.cohortPartition.partitionId, restored.model, dim);
  if (!sameCountyVotes(model.output.result.units, restored.cohortResult.result.units))
    throw new Error("Canonical project cohort output failed deterministic validation.");
  return { ordinary, model };
}

/** Checked source provenance is required before E2's fitting model can run.
 * E3 owns the underlying verified dataset; this adapter cannot invent a digest. */
export function compositionProvenance(source: AvailableAcsSource): CompositionSourceProvenance {
  const raw = source.provenance as Record<string, unknown>;
  // The E3 native source getter is required to supply usable publisher metadata.
  // Do not substitute a link or an invented SHA when the source contract differs.
  const sourceUrl = raw.sourceUrl;
  const sourceDigest = raw.sourceDigest;
  if (typeof sourceUrl !== "string" || !/^https:\/\/(api\.)?census\.gov\//.test(sourceUrl) ||
      typeof sourceDigest !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(sourceDigest))
    throw new Error("Verified Census source URL and SHA-256 provenance are required before fitting a modeled electorate.");
  return {
    publisher:"US Census Bureau",survey:"ACS",surveyYear:2024,period:"5-year",
    geographyVintage:"2020",sourceUrl,sourceDigest,releaseStatus:"verified",
    dimension:source.dimension,tableId:source.dimension==="age"?"B01001":"B15003",
    ...(typeof raw.profileDigest === "string" ? {profileDigest:raw.profileDigest} : {})
  };
}
/** E2 exclusively performs all hypothetical population-to-ballot allocations.
 * This is a strict API bridge, not an alternative UI-generated split. */
export function beginCompositionModel(
  ordinary: RegistrySandboxSession,
  source: AvailableAcsSource,
  turnoutWeightByCategory: Record<string,number>,
): SyntheticModelSession {
  if(!api.fitSyntheticElectorateFromComposition)
    throw new Error("Canonical Census-composition electorate fitting is not yet integrated.");
  const ids=source.rows[0]?.categories.map(group=>group.id)??[];
  if(!ids.length||Object.keys(turnoutWeightByCategory).length!==ids.length||
     ids.some(id=>!Object.hasOwn(turnoutWeightByCategory,id) ||
      !Number.isFinite(turnoutWeightByCategory[id]) || turnoutWeightByCategory[id]! < 0 ||
      turnoutWeightByCategory[id]! > 2))
    throw new Error("Every explicitly hypothetical category weight must be specified between 0× and 2×.");
  const assumptions:CompositionModelAssumptions={
    kind:"explicit-hypothetical-weights",
    universe:source.dimension==="age"?"population_18_plus":"population_25_plus",
    turnoutWeightByCategory,
    candidatePreference:{kind:"county-neutral"},
    eligibleAllocation:"ballots-plus-population-weighted-slack"
  };
  const fit=api.fitSyntheticElectorateFromComposition(ordinary.election,ordinary.result.units,
    source.rows,compositionProvenance(source),assumptions);
  const model=build(ordinary,fit.partition,[],fit.modelProvenance.seed,fit.modelProvenance,source.dimension);
  if(model.output.result.units.length!==95)
    throw new Error("Census-derived modeled partition must include exactly 95 Tennessee counties.");
  return model;
}
