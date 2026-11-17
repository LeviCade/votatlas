import type { BaseUnitResult, CandidateId, ElectionDefinition } from "@votatlas/contracts";
import type { SyntheticCohortPartition } from "./cohorts.js";
import { simulateCohortPartition } from "./cohorts.js";
import { SimulationError, simulateElection } from "./engine.js";
import { sha256Hex } from "./sha256.js";
import type { CohortModelProvenance } from "./scenario-project.js";

/**
 * Census marginal POPULATION estimates, NOT registered voters, electorate,
 * candidate support, or observed subgroup turnout. Mirrors E3's source API.
 */
export type CompositionDimension = "age" | "education";
export type CompositionUniverse = "population_18_plus" | "population_25_plus";
export interface PopulationCategory {
  id: string;
  label: string;
  estimate: number;
  moe90: number | null;
  sourceEstimateVariables: readonly string[];
  sourceMoeVariables: readonly string[];
}
export interface CountyPopulationMarginal {
  geoId: string;
  countyName: string;
  dimension: CompositionDimension;
  tableId: "B01001" | "B15003";
  universe: CompositionUniverse;
  universeEstimate: number;
  universeMoe90: number | null;
  categories: readonly PopulationCategory[];
}
/** Source-authentication and source-file SHA are E3's responsibility. */
export interface CompositionSourceProvenance {
  publisher: "US Census Bureau";
  survey: "ACS";
  surveyYear: 2024;
  period: "5-year";
  geographyVintage: "2020";
  sourceUrl: string;
  /** SHA-256 of the trusted upstream source payload/manifest, verified by E3. */
  sourceDigest: string;
  releaseStatus: "verified";
  dimension: CompositionDimension;
  tableId: "B01001" | "B15003";
  /** Optional independently generated digest of normalized county estimates. */
  profileDigest?: string;
}
export type CandidatePreferenceAssumption =
  | { kind: "county-neutral" }
  | { kind: "explicit-relative-weights"; byCategory: Record<string, Record<CandidateId, number>> };
/** Explicit hypothetical assumptions; neither Census nor an election dataset supplies these. */
export interface CompositionModelAssumptions {
  kind: "explicit-hypothetical-weights";
  universe: CompositionUniverse;
  turnoutWeightByCategory: Record<string, number>;
  candidatePreference: CandidatePreferenceAssumption;
  eligibleAllocation: "ballots-plus-population-weighted-slack";
}
export interface CompositionCountyAudit {
  geoId: string;
  populationUniverse: number;
  universeMoe90: number | null;
  categories: Array<{ id: string; populationEstimate: number; moe90: number | null }>;
  modeledBallots: number;
  modeledCandidateBallots: number;
  modeledOtherBallots: number;
  modeledEligibleVoters: number | null;
}
export interface CompositionFitResult {
  partition: SyntheticCohortPartition;
  /** Pass directly to the existing canonical v3 project codec. */
  modelProvenance: CohortModelProvenance;
  audit: {
    dataStatus: "synthetic";
    dimension: CompositionDimension;
    universe: CompositionUniverse;
    transferDenominator: "modeled-candidate-ballots";
    populationDenominator: "ACS-county-universe-estimate";
    allocation: "deterministic-largest-remainder";
    warning: string;
    source: CompositionSourceProvenance;
    profileDigest: string;
    assumptionsDigest: string;
    counties: CompositionCountyAudit[];
  };
}

export const COMPOSITION_MODEL_ID = "acs-population-composition-hypothesis";
export const COMPOSITION_MODEL_VERSION = "1";
export const COMPOSITION_HYPOTHESIS_WARNING =
  "Census age/education population estimates are NOT observed voter turnout, eligibility, or candidate support. " +
  "All loaded county ballots are hypothetically reweighted using the selected population universe; " +
  "education 25+ modeling does not identify actual 18-24 voters. No observed demographic voting is inferred.";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const SCALE = 1_000_000n; // explicitly limited to six decimal places
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor", "toString", "toLocaleString",
  "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"]);
const lex = (a: string, b: string): number => a === b ? 0 : a < b ? -1 : 1;
const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
const plain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function bad(detail: string): never { throw new SimulationError("INVALID_BASE_UNIT", `ACS composition: ${detail}`); }
function badAssumption(detail: string): never { throw new SimulationError("INVALID_ACTION", `Hypothetical composition assumption: ${detail}`); }
function id(raw: unknown, label: string): string {
  if (typeof raw !== "string" || !raw || raw.trim() !== raw || raw.length > 128 ||
      /[\x00-\x1f\x7f]/.test(raw) || FORBIDDEN.has(raw)) bad(`${label} invalid/reserved`);
  return raw;
}
function nonnegative(raw: unknown, label: string): number {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) bad(`${label} is not a nonnegative safe integer or is suppressed`);
  return raw;
}
function maybeMoe(raw: unknown, label: string): number | null {
  return raw === null ? null : nonnegative(raw, label);
}
function safeSum(values: readonly number[], label: string): number {
  const result = values.reduce((s, n) => s + BigInt(n), 0n);
  if (result > MAX_SAFE) throw new SimulationError("INTEGER_OVERFLOW", `${label} exceeds safe integer range`);
  return Number(result);
}
function strictKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!plain(value)) badAssumption(`${label} must be an object`);
  const actual = Object.keys(value).sort(lex);
  const expected = [...keys].sort(lex);
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    badAssumption(`${label} keys must match declared categories/candidates exactly`);
  }
  return value;
}
function positiveDecimalWeight(raw: unknown, label: string): bigint {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 1000) {
    badAssumption(`${label} must be finite within [0,1000]`);
  }
  const notation = raw.toString().toLowerCase();
  const [mantissa = "", exponentText = "0"] = notation.split("e");
  const exponent = Number(exponentText);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 16) badAssumption(`${label} has unsupported precision`);
  const [whole = "", fraction = ""] = mantissa.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) badAssumption(`${label} has invalid notation`);
  const digits = BigInt(whole + fraction);
  const decimalPlaces = fraction.length - exponent;
  const shift = 6 - decimalPlaces;
  if (shift >= 0) return digits * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  if (digits % divisor !== 0n) badAssumption(`${label} must have at most six decimal places`);
  return digits / divisor;
}
function allocate(total: number, weights: readonly bigint[], label: string): number[] {
  if (!Number.isSafeInteger(total) || total < 0) bad(`Invalid integer allocation total: ${label}`);
  if (weights.length === 0) bad(`No categories for ${label}`);
  const sum = weights.reduce((acc, n) => acc + n, 0n);
  if (sum === 0n) {
    if (total) badAssumption(`No positive modeled weights for ${label} despite ${total} ballots`);
    return weights.map(() => 0);
  }
  const numerators = weights.map(weight => weight * BigInt(total));
  const result = numerators.map(n => Number(n / sum));
  let left = total - safeSum(result, "Allocation floor");
  const ranks = numerators.map((n, i) => ({ i, remainder: n % sum }))
    .sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  for (const { i } of ranks) {
    if (left-- <= 0) break;
    result[i]!++;
  }
  return result;
}
const universeFor = (dimension: CompositionDimension): CompositionUniverse =>
  dimension === "age" ? "population_18_plus" : "population_25_plus";
const tableFor = (dimension: CompositionDimension): "B01001" | "B15003" =>
  dimension === "age" ? "B01001" : "B15003";
function digest(value: unknown): string { return `sha256:${sha256Hex(JSON.stringify(value))}`; }
function sourceCheck(p: CompositionSourceProvenance): void {
  if (!plain(p) || p.publisher !== "US Census Bureau" || p.survey !== "ACS" || p.surveyYear !== 2024 ||
      p.period !== "5-year" || p.geographyVintage !== "2020" || p.releaseStatus !== "verified" ||
      (p.dimension !== "age" && p.dimension !== "education") || p.tableId !== tableFor(p.dimension)) {
    bad("Missing or invalid verified ACS 2024 5-year source metadata");
  }
  if (typeof p.sourceUrl !== "string" || p.sourceUrl.length > 512 || !/^https:\/\/[^\s]+$/i.test(p.sourceUrl)) {
    bad("Source URL must be an explicit HTTPS URL");
  }
  try {
    const url = new URL(p.sourceUrl);
    if (!(url.hostname === "census.gov" || url.hostname.endsWith(".census.gov"))) bad("Source must be an official Census domain");
  } catch { bad("Invalid Census source URL"); }
  if (!/^sha256:[0-9a-f]{64}$/.test(p.sourceDigest)) bad("Invalid source-payload SHA-256");
  if (p.profileDigest !== undefined && !/^sha256:[0-9a-f]{64}$/.test(p.profileDigest)) bad("Invalid county-profile digest");
}
function validateProfiles(marginals: readonly CountyPopulationMarginal[], provenance: CompositionSourceProvenance): {
  sorted: CountyPopulationMarginal[]; categories: PopulationCategory[]; profileDigest: string
} {
  sourceCheck(provenance);
  if (!Array.isArray(marginals) || !marginals.length || marginals.length > 4000) bad("Missing/oversized county marginal dataset");
  const seenCounties = new Set<string>();
  const categories = new Map<string, PopulationCategory>();
  const variables = new Set<string>();
  const sorted = [...marginals].sort((a, b) => lex(a.geoId, b.geoId));
  for (const county of sorted) {
    if (county === null || typeof county !== "object" || Array.isArray(county) || !/^\d{5}$/.test(county.geoId) || seenCounties.has(county.geoId)) bad("Invalid or duplicate county GEOID");
    seenCounties.add(county.geoId);
    if (county.dimension !== provenance.dimension || county.tableId !== provenance.tableId ||
        county.universe !== universeFor(provenance.dimension)) bad("Mixed age 18+ / education 25+ universes or overlapping marginal dimensions");
    id(county.countyName, `county ${county.geoId} name`);
    nonnegative(county.universeEstimate, `${county.geoId} source population universe`);
    maybeMoe(county.universeMoe90, `${county.geoId} universe MOE`);
    if (!Array.isArray(county.categories) || county.categories.length === 0 || county.categories.length > 64) bad("Invalid county category set");
    const local = new Set<string>();
    const popCounts: number[] = [];
    for (const cat of county.categories) {
      if (cat === null || typeof cat !== "object" || Array.isArray(cat)) bad("Malformed Census category");
      const categoryId = id(cat.id, "category ID");
      id(cat.label, "category label");
      if (local.has(categoryId)) bad("Duplicate county category (possible overlap)");
      local.add(categoryId);
      popCounts.push(nonnegative(cat.estimate, `${county.geoId}:${categoryId} population`));
      maybeMoe(cat.moe90, `MOE ${categoryId}`);
      if (!Array.isArray(cat.sourceEstimateVariables) || !cat.sourceEstimateVariables.length ||
          !Array.isArray(cat.sourceMoeVariables) ||
          cat.sourceMoeVariables.length !== cat.sourceEstimateVariables.length) bad("Missing source variable lists");
      const estimateVars = [...cat.sourceEstimateVariables].sort(lex);
      const moeVars = [...cat.sourceMoeVariables].sort(lex);
      const expectedMoeVars = estimateVars.map(v => v.replace(/E$/, "M")).sort(lex);
      if (estimateVars.some(v => {
            if (typeof v !== "string" || !new RegExp(`^${provenance.tableId}_[0-9]{3}E$`).test(v)) return true;
            const num = Number(v.slice(provenance.tableId.length + 1, -1));
            // Only adult B01001 male/female cells, never the total or under-18
            // categories; only B15003 adult-25+ attainment cells, not table total.
            return provenance.dimension === "age" ? !((num >= 7 && num <= 25) || (num >= 31 && num <= 49)) :
              !(num >= 2 && num <= 25);
          }) ||
          moeVars.some((v, i) => v !== expectedMoeVars[i]) ||
          new Set(estimateVars).size !== estimateVars.length) bad("Unknown/ineligible ACS variables or missing estimate/MOE linkage");
      if (categories.size === 0 || !categories.has(categoryId)) {
        if (seenCounties.size > 1) bad("Different category IDs across counties");
        categories.set(categoryId, cat);
        for (const name of estimateVars) {
          if (variables.has(name)) bad("Overlapping source population variables across categories");
          variables.add(name);
        }
      } else {
        const ref = categories.get(categoryId)!;
        if (ref.label !== cat.label ||
            JSON.stringify([...ref.sourceEstimateVariables].sort(lex)) !== JSON.stringify(estimateVars) ||
            JSON.stringify([...ref.sourceMoeVariables].sort(lex)) !== JSON.stringify(moeVars)) {
          bad(`Category source variable definition changed in ${county.geoId}`);
        }
      }
    }
    if (local.size !== categories.size) bad(`Incomplete or overlapping population category set in ${county.geoId}`);
    if (safeSum(popCounts, `${county.geoId} population category sum`) !== county.universeEstimate) {
      bad(`Population categories must sum exactly to ${county.geoId}'s ${county.universe} universe`);
    }
  }
  const refs = [...categories.values()].sort((a, b) => lex(a.id, b.id));
  const representation = {
    source: { publisher: provenance.publisher, survey: provenance.survey, surveyYear: provenance.surveyYear,
      period: provenance.period, geographyVintage: provenance.geographyVintage, sourceUrl: provenance.sourceUrl,
      sourceDigest: provenance.sourceDigest, dimension: provenance.dimension, tableId: provenance.tableId },
    categories: refs.map(c => [c.id, c.label, [...c.sourceEstimateVariables].sort(lex), [...c.sourceMoeVariables].sort(lex)]),
    counties: sorted.map(c => [c.geoId, c.countyName, c.universeEstimate, c.universeMoe90,
      [...c.categories].sort((a, b) => lex(a.id, b.id)).map(cat => [cat.id, cat.estimate, cat.moe90])])
  };
  const profileDigest = digest(representation);
  if (provenance.profileDigest !== undefined && provenance.profileDigest !== profileDigest) bad("County-profile SHA-256 mismatch");
  return { sorted, categories: refs, profileDigest };
}
/** Fingerprint full canonical E3 marginal input (counts, MOEs, variables and source identity). */
export function fingerprintPopulationMarginals(
  marginals: readonly CountyPopulationMarginal[], provenance: CompositionSourceProvenance
): string { return validateProfiles(marginals, provenance).profileDigest; }

function validateAssumptions(
  assumptions: CompositionModelAssumptions, universe: CompositionUniverse,
  categories: readonly PopulationCategory[], candidateIds: readonly string[]
): { turnout: bigint[]; preference: bigint[][]; normalized: unknown } {
  if (!plain(assumptions) || assumptions.kind !== "explicit-hypothetical-weights" ||
      assumptions.universe !== universe || assumptions.eligibleAllocation !== "ballots-plus-population-weighted-slack") {
    badAssumption("Explicit matching population universe and ballot/eligible allocation policy are required");
  }
  const catIds = categories.map(c => c.id);
  const turnoutRaw = strictKeys(assumptions.turnoutWeightByCategory, catIds, "turnoutWeightByCategory");
  const turnout = catIds.map(cat => positiveDecimalWeight(turnoutRaw[cat], `${cat} turnout propensity`));
  const pref = assumptions.candidatePreference;
  if (!plain(pref) || (pref.kind !== "county-neutral" && pref.kind !== "explicit-relative-weights")) {
    badAssumption("Explicit county-neutral or candidate-relative preference policy required");
  }
  let preference: bigint[][];
  let normalizedPreference: unknown;
  if (pref.kind === "county-neutral") {
    if (Object.keys(pref).length !== 1) badAssumption("Unexpected county-neutral preference fields");
    preference = catIds.map(() => candidateIds.map(() => SCALE));
    normalizedPreference = { kind: "county-neutral" };
  } else {
    const rows = strictKeys(pref.byCategory, catIds, "candidatePreference.byCategory");
    preference = catIds.map(cat => {
      const values = strictKeys(rows[cat], candidateIds, `preference ${cat}`);
      return candidateIds.map(id => positiveDecimalWeight(values[id], `${cat}.${id} preference`));
    });
    normalizedPreference = { kind: "explicit-relative-weights",
      byCategory: Object.fromEntries(catIds.map((cat, i) => [cat,
        Object.fromEntries(candidateIds.map((id, j) => [id, preference[i]![j]!.toString()]))])) };
  }
  return {
    turnout, preference,
    normalized: { kind: assumptions.kind, universe: assumptions.universe,
      eligibleAllocation: assumptions.eligibleAllocation,
      turnoutWeightByCategory: Object.fromEntries(catIds.map((cat, i) => [cat, turnout[i]!.toString()])),
      candidatePreference: normalizedPreference }
  };
}
/** Build an explicit equal-relative-turnout hypothesis for a deliberate UI choice. */
export function createEqualWeightCompositionAssumptions(
  marginals: readonly CountyPopulationMarginal[]
): CompositionModelAssumptions {
  if (!marginals.length || !Array.isArray(marginals[0]?.categories)) bad("No population categories for neutral assumption");
  const dimension = marginals[0]!.dimension;
  if (dimension !== "age" && dimension !== "education") bad("Unknown population dimension");
  const ids = marginals[0]!.categories.map(c => id(c.id, "category ID"));
  return {
    kind: "explicit-hypothetical-weights", universe: universeFor(dimension),
    turnoutWeightByCategory: Object.fromEntries(ids.map(key => [key, 1])),
    candidatePreference: { kind: "county-neutral" },
    eligibleAllocation: "ballots-plus-population-weighted-slack"
  };
}
/** Stable v3 binding: model seed contains population-profile and assumption digests. */
export function compositionPartitionId(seed: string): string {
  if (typeof seed !== "string" || !/^sha256:[0-9a-f]{64}\.sha256:[0-9a-f]{64}$/.test(seed)) {
    throw new SimulationError("INVALID_PROJECT", "Invalid synthetic ACS composition binding seed");
  }
  return `acs-composition-v1-${sha256Hex(seed).slice(0, 24)}`;
}

/**
 * Fit a HYPOTHETICAL electorate to *population* marginal weights only.
 * Every original county/candidate ballot and otherBallot is conserved exactly.
 * The ACS 25+ universe, when selected, is a reweighting reference for all loaded
 * ballot categories; no assertion is made that all voters were 25+.
 */
export function fitSyntheticElectorateFromComposition(
  election: ElectionDefinition,
  postClassicUnits: readonly BaseUnitResult[],
  marginals: readonly CountyPopulationMarginal[],
  provenance: CompositionSourceProvenance,
  assumptions: CompositionModelAssumptions
): CompositionFitResult {
  if (election.dataStatus !== "synthetic") bad("Hypothetical cohort adapter currently requires a synthetic election");
  const ordinary = simulateElection(election, postClassicUnits, { schemaVersion: 1, electionId: election.id, actions: [] });
  const ids = [...election.candidates.map(c => c.id)].sort(lex);
  const { sorted, categories, profileDigest } = validateProfiles(marginals, provenance);
  if (sorted.length !== ordinary.units.length || sorted.some((p, i) => p.geoId !== ordinary.units[i]!.geoId)) {
    bad("Census marginal county set must match every loaded election county exactly");
  }
  const universe = universeFor(provenance.dimension);
  const { turnout, preference, normalized } = validateAssumptions(assumptions, universe, categories, ids);
  const assumptionsDigest = digest(normalized);
  const modelSeed = `${profileDigest}.${assumptionsDigest}`;
  const partitionId = compositionPartitionId(modelSeed);
  const modelProvenance: CohortModelProvenance = {
    kind: "synthetic", modelId: COMPOSITION_MODEL_ID, modelVersion: COMPOSITION_MODEL_VERSION,
    seed: modelSeed,
    description: `HYPOTHETICAL electorate weighted using sourced 2024 ACS 5-year ${provenance.dimension} ${universe} population; NOT measured subgroup voting or actual turnout.`
  };
  const dimensionId = provenance.dimension === "age" ? "acs-age-18-plus" : "acs-education-25-plus";
  const partition: SyntheticCohortPartition = {
    schemaVersion: 1, dataStatus: "synthetic", partitionId,
    kind: "single", dimensionIds: [dimensionId], universe: "modeled-ballots",
    cohorts: categories.map(cat => ({
      id: cat.id,
      label: `HYPOTHETICAL modeled electorate — ${cat.label}`,
      dimensions: { [dimensionId]: cat.id }
    })),
    counties: ordinary.units.map((unit, rowIndex) => {
      const source = sorted[rowIndex]!;
      const byCategory = new Map(source.categories.map(cat => [cat.id, cat]));
      const population = categories.map(cat => byCategory.get(cat.id)!.estimate);
      const popWeights = population.map(BigInt);
      const categoryWeights = population.map((count, i) => BigInt(count) * turnout[i]!);
      const cells = categories.map(cat => ({
        cohortId: cat.id, eligibleVoters: unit.eligibleVoters === null ? null : 0,
        votes: Object.fromEntries(ids.map(id => [id, 0])) as Record<string, number>, otherBallots: 0
      }));
      for (let candidateIndex = 0; candidateIndex < ids.length; candidateIndex++) {
        const candidateId = ids[candidateIndex]!;
        const weights = categoryWeights.map((w, i) => w * preference[i]![candidateIndex]!);
        const amounts = allocate(unit.votes[candidateId]!, weights, `${unit.geoId}.${candidateId}`);
        amounts.forEach((value, i) => { cells[i]!.votes[candidateId] = value; });
      }
      const other = allocate(unit.otherBallots, categoryWeights, `${unit.geoId}.otherBallots`);
      other.forEach((value, i) => { cells[i]!.otherBallots = value; });
      if (unit.eligibleVoters !== null) {
        const ballots = safeSum([...ids.map(candidateId => unit.votes[candidateId]!), unit.otherBallots], "County ballots");
        const slack = allocate(unit.eligibleVoters - ballots, popWeights, `${unit.geoId}.eligibleSlack`);
        cells.forEach((cell, i) => {
          const localBallots = safeSum([...ids.map(candidateId => cell.votes[candidateId]!), cell.otherBallots], "Cohort ballots");
          cell.eligibleVoters = safeSum([localBallots, slack[i]!], "Modeled cohort eligibility");
        });
      }
      return { geoId: unit.geoId, cells };
    })
  };
  // Existing strict cohort validator independently rechecks county/candidate totals,
  // cell eligibility, disjoint dimensions and deterministic local aggregation.
  const verified = simulateCohortPartition(election, ordinary.units, partition, []);
  const audit: CompositionFitResult["audit"] = {
    dataStatus: "synthetic", dimension: provenance.dimension, universe,
    transferDenominator: "modeled-candidate-ballots", populationDenominator: "ACS-county-universe-estimate",
    allocation: "deterministic-largest-remainder", warning: COMPOSITION_HYPOTHESIS_WARNING,
    source: { ...provenance }, profileDigest, assumptionsDigest,
    counties: ordinary.units.map((row, i) => ({
      geoId: row.geoId, populationUniverse: sorted[i]!.universeEstimate,
      universeMoe90: sorted[i]!.universeMoe90,
      categories: [...sorted[i]!.categories].sort((a, b) => lex(a.id, b.id)).map(category => ({
        id: category.id, populationEstimate: category.estimate, moe90: category.moe90
      })),
      modeledBallots: verified.baseUnits[i]!.otherBallots +
        safeSum(ids.map(candidate => verified.baseUnits[i]!.votes[candidate]!), "Audited candidate ballots"),
      modeledCandidateBallots: safeSum(ids.map(candidate => verified.baseUnits[i]!.votes[candidate]!), "Audited candidate ballots"),
      modeledOtherBallots: verified.baseUnits[i]!.otherBallots,
      modeledEligibleVoters: verified.baseUnits[i]!.eligibleVoters
    }))
  };
  return { partition, modelProvenance, audit };
}
