import { describe, it, expect } from "vitest";
import type { BaseUnitResult, ElectionDefinition, Scenario } from "@votatlas/contracts";
import {
  addCandidate, appendAction, simulateElection, simulateCohortPartition,
  createScenarioProjectV3, restoreScenarioProject, serializeScenarioProject, parseScenarioProject,
  SimulationError, fitSyntheticElectorateFromComposition, fingerprintPopulationMarginals,
  createEqualWeightCompositionAssumptions, compositionPartitionId,
  COMPOSITION_HYPOTHESIS_WARNING
} from "./index.js";
import type { CohortAction } from "./cohorts.js";
import type {
  CountyPopulationMarginal, CompositionSourceProvenance, CompositionModelAssumptions,
  CompositionDimension
} from "./composition.js";

// ALL vote totals and population counts in these tests are invented. The format
// imitates E3's future sourced Census contract; no historical demographic data.
function fixture(candidateCount = 3, countyCount = 95) {
  const ids = Array.from({ length: candidateCount }, (_, i) => `person-${i}`);
  const election: ElectionDefinition = {
    id: "fictional-tn-acs-test", title: "ENTIRELY FICTIONAL", office: "made-up",
    geographyVintage: "2020", dataStatus: "synthetic",
    candidates: ids.map((id, i) => ({ id, name: `Fictional ${id}`, color: "#124578", ballotOrder: i }))
  };
  const rows: BaseUnitResult[] = Array.from({ length: countyCount }, (_, i) => {
    const votes = Object.fromEntries(ids.map((id, j) => [id, i % 13 === 0 ? 0 : 12 + (i * 23 + j * 7) % 90]));
    const otherBallots = i % 7 === 0 ? 0 : i % 9;
    const total = Object.values(votes).reduce((a, b) => a + b, otherBallots);
    return { geoId: `47${String(2 * i + 1).padStart(3, "0")}`, stateId: "47", eligibleVoters: total + 150,
      votes, otherBallots };
  });
  return { election, rows, ids };
}
function testPopulation(rows: readonly BaseUnitResult[], dimension: CompositionDimension = "age") {
  const age = dimension === "age";
  const keys = age ? ["age18-24", "age25-34", "age35-44", "age45-54", "age55-64", "age65plus"] :
    ["less-hs", "hs", "college", "bachelor", "graduate"];
  const universe = age ? "population_18_plus" as const : "population_25_plus" as const;
  const table = age ? "B01001" as const : "B15003" as const;
  const population: CountyPopulationMarginal[] = rows.map((row, i) => {
    const categories = keys.map((id, j) => ({
      id, label: `SYNTHETIC reference ${id}`, estimate: j === 0 && i === 1 ? 0 : 130 + j * 21 + i,
      moe90: j % 2 === 0 ? null : 12,
      sourceEstimateVariables: [`${table}_${String(j + (age ? 7 : 2)).padStart(3, "0")}E`],
      sourceMoeVariables: [`${table}_${String(j + (age ? 7 : 2)).padStart(3, "0")}M`]
    }));
    return { geoId: row.geoId, countyName: `Synthetic County ${i}`, dimension, tableId: table,
      universe, universeEstimate: categories.reduce((s, cat) => s + cat.estimate, 0),
      universeMoe90: null, categories };
  });
  const provenance: CompositionSourceProvenance = {
    publisher: "US Census Bureau", survey: "ACS", surveyYear: 2024, period: "5-year",
    geographyVintage: "2020", sourceUrl: "https://api.census.gov/data/2024/acs/acs5",
    // Test-only invented digest — NOT a claim that any Census response was fetched.
    sourceDigest: `sha256:${"a".repeat(64)}`, releaseStatus: "verified", dimension, tableId: table
  };
  const assumptions = createEqualWeightCompositionAssumptions(population);
  return { population, provenance, assumptions, keys };
}
function expectError(fn: () => unknown, code: string) {
  try { fn(); throw new Error(`Expected ${code}`); }
  catch (error) {
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).code).toBe(code);
  }
}
function checkCells(baseline: readonly BaseUnitResult[], partition: ReturnType<typeof fitSyntheticElectorateFromComposition>["partition"], ids: string[]) {
  for (let i = 0; i < baseline.length; i++) {
    const county = partition.counties[i]!;
    const original = baseline[i]!;
    expect(county.geoId).toBe(original.geoId);
    for (const id of ids) expect(county.cells.reduce((s, cell) => s + cell.votes[id]!, 0)).toBe(original.votes[id]);
    expect(county.cells.reduce((s, cell) => s + cell.otherBallots, 0)).toBe(original.otherBallots);
    expect(county.cells.reduce((s, cell) => s + cell.eligibleVoters!, 0)).toBe(original.eligibleVoters);
    expect(county.cells.every(c => Object.values(c.votes).reduce((s, x) => s + x, c.otherBallots) <= c.eligibleVoters!)).toBe(true);
  }
}
const transfer = (id: string, ids: string[], countyIds = ["47001", "47003"]): CohortAction => ({
  type: "COHORT_TRANSFER_PP", id, scope: { kind: "county", countyIds },
  cohortIds: ["age25-34"], fromCandidateId: ids[0]!, toCandidateId: ids[1]!, points: 1
});

describe("Round Six Census population → explicitly HYPOTHETICAL electorate", () => {
  for (const count of [2, 3, 5, 10]) {
    for (const dimension of ["age", "education"] as const) {
      it(`reconciles every county/candidate/other/eligibility exactly (${count} candidates, ${dimension})`, () => {
        const { election, rows, ids } = fixture(count);
        const { population, provenance, assumptions } = testPopulation(rows, dimension);
        const before = JSON.stringify({ election, rows, population, provenance, assumptions });
        const a = fitSyntheticElectorateFromComposition(election, rows, population, provenance, assumptions);
        const b = fitSyntheticElectorateFromComposition({ ...election, candidates: [...election.candidates].reverse() },
          [...rows].reverse(), [...population].reverse().map(row => ({ ...row, categories: [...row.categories].reverse() })), provenance, assumptions);
        expect(a).toEqual(b);
        expect(a.partition.counties).toHaveLength(95);
        expect(a.partition.dimensionIds).toEqual([dimension === "age" ? "acs-age-18-plus" : "acs-education-25-plus"]);
        expect(a.audit.universe).toBe(dimension === "age" ? "population_18_plus" : "population_25_plus");
        expect(a.modelProvenance.kind).toBe("synthetic");
        expect(a.modelProvenance.description).toContain("NOT measured subgroup voting");
        expect(COMPOSITION_HYPOTHESIS_WARNING).toContain("NOT observed voter turnout");
        expect(a.audit.profileDigest).toBe(fingerprintPopulationMarginals(population, provenance));
        checkCells(rows, a.partition, ids);
        const modeled = simulateCohortPartition(election, rows, a.partition, []);
        expect(modeled.baseUnits).toEqual(rows);
        expect(JSON.stringify({ election, rows, population, provenance, assumptions })).toBe(before);
      });
    }
  }
  it("explicitly reweights support by category WITHOUT inferring voter preferences", () => {
    const { election, rows, ids } = fixture(3);
    const { population, provenance, assumptions, keys } = testPopulation(rows);
    const neutral = fitSyntheticElectorateFromComposition(election, rows, population, provenance, assumptions);
    const weighted: CompositionModelAssumptions = {
      ...assumptions, turnoutWeightByCategory: Object.fromEntries(keys.map((k, i) => [k, i === 0 ? 3 : 1])),
      candidatePreference: { kind: "explicit-relative-weights", byCategory: Object.fromEntries(keys.map(k => [k,
        Object.fromEntries(ids.map((id, i) => [id, k === keys[0] && i === 0 ? 7 : 1]))])) }
    };
    const adjusted = fitSyntheticElectorateFromComposition(election, rows, population, provenance, weighted);
    expect(adjusted.partition).not.toEqual(neutral.partition);
    checkCells(rows, adjusted.partition, ids);
    expect(adjusted.modelProvenance.seed).not.toBe(neutral.modelProvenance.seed);
    expect(adjusted.audit.populationDenominator).toBe("ACS-county-universe-estimate");
    const legacy = simulateElection(election, rows, { schemaVersion: 1, electionId: election.id, actions: [] });
    const modeled = simulateCohortPartition(election, rows, adjusted.partition, []);
    expect(modeled.result).toEqual(legacy);
  });
  it("persists canonical v3 cohort projects and exact hypothetical model replay", () => {
    const base = fixture(3);
    const extra = addCandidate(base.election, base.rows, { id: "newperson", name: "Fictional new", color: "#00ffcc" },
      { schemaVersion: 1, electionId: base.election.id, actions: [] });
    const scenario: Scenario = appendAction(extra.scenario!, { id: "pre", type: "SET_SHARE", scope: { kind: "national" },
      candidateId: "newperson", targetPercent: 6, redistribution: { kind: "proportional-other" } });
    const ordinary = simulateElection(extra.election, extra.baseUnits, scenario);
    const { population, provenance, assumptions, keys } = testPopulation(ordinary.units);
    const fitted = fitSyntheticElectorateFromComposition(extra.election, ordinary.units, population, provenance, assumptions);
    const actions: CohortAction[] = [{ type: "COHORT_TRANSFER_PP", id: "transfer", scope: { kind: "county", countyIds: ["47001", "47003", "47005"] },
      cohortIds: [keys[1]!], fromCandidateId: base.election.candidates[0]!.id, toCandidateId: "newperson", points: 1 }];
    const v3 = createScenarioProjectV3(base.election, base.rows, extra.election, extra.baseUnits, scenario,
      fitted.partition, actions, fitted.modelProvenance);
    expect(v3.cohort.model.seed).toContain(fitted.audit.profileDigest);
    const raw = serializeScenarioProject(v3);
    expect(serializeScenarioProject(parseScenarioProject(raw) as typeof v3)).toBe(raw);
    const restored = restoreScenarioProject(raw, base.election, base.rows);
    if (!("cohortResult" in restored)) throw new Error("Expected v3 restored model");
    expect(restored.cohortResult.result).toEqual(simulateCohortPartition(extra.election, ordinary.units, fitted.partition, actions).result);
    const corrupted = structuredClone(v3);
    corrupted.cohort.model.seed = `sha256:${"f".repeat(64)}.sha256:${"f".repeat(64)}`;
    expectError(() => restoreScenarioProject(corrupted, base.election, base.rows), "INVALID_PROJECT");
    expect(compositionPartitionId(fitted.modelProvenance.seed)).toBe(fitted.partition.partitionId);
  });
  it("exercises selected 3 counties vs untouched 92, statewide turnout, long deterministic replay", () => {
    const { election, rows, ids } = fixture(5);
    const { population, provenance, assumptions, keys } = testPopulation(rows);
    const fitted = fitSyntheticElectorateFromComposition(election, rows, population, provenance, assumptions);
    const edit: CohortAction = { type: "COHORT_TRANSFER_PP", id: "local", cohortIds: [keys[1]!],
      fromCandidateId: ids[0]!, toCandidateId: ids[1]!, points: 1,
      scope: { kind: "county", countyIds: ["47001", "47003", "47005"] } };
    const altered = simulateCohortPartition(election, rows, fitted.partition, [edit]);
    const untouched = altered.baseUnits.filter(row => !["47001", "47003", "47005"].includes(row.geoId));
    expect(untouched).toEqual(rows.filter(row => !["47001", "47003", "47005"].includes(row.geoId)));
    const statewide = simulateCohortPartition(election, rows, fitted.partition, [
      { type: "COHORT_TURNOUT_SCALE", id: "reduce", scope: { kind: "state", stateId: "47" }, cohortIds: [keys[1]!], factor: 0.9 }
    ]);
    expect(statewide.result.national).toEqual(statewide.result.byState["47"]);
    // 160 deterministic active edits: statewide turnout contractions, plus
    // alternating REAL multi-county candidate transfers (not 0-point no-ops).
    const actions: CohortAction[] = Array.from({ length: 160 }, (_, i): CohortAction => {
      if (i % 5 === 0) return {
        type: "COHORT_TURNOUT_SCALE", id: `s${i}`, scope: { kind: "state", stateId: "47" },
        cohortIds: [keys[1]!], factor: 0.95
      };
      return {
        type: "COHORT_TRANSFER_PP", id: `t${i}`, scope: { kind: "county", countyIds: ["47001", "47003", "47005"] },
        cohortIds: [keys[1]!],
        fromCandidateId: i % 2 === 0 ? ids[0]! : ids[1]!,
        toCandidateId: i % 2 === 0 ? ids[1]! : ids[0]!, points: 1.5
      };
    });
    const first = simulateCohortPartition(election, rows, fitted.partition, actions);
    const second = simulateCohortPartition(election, rows, fitted.partition, structuredClone(actions));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.baseUnits).not.toEqual(rows);
    expect(first.result.national.ballots).toBe(first.result.units.reduce((s, row) => s + row.ballots, 0));
    expect(first.result.national).toEqual(first.result.byState["47"]);
  });
  it("rejects mismatched age/education universe, missing/duplicate counties, overlapping variables, wrong sums", () => {
    const { election, rows } = fixture(3);
    const { population, provenance, assumptions } = testPopulation(rows);
    const wrong = structuredClone(population); wrong[0]!.universe = "population_25_plus";
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, wrong, provenance, assumptions), "INVALID_BASE_UNIT");
    const missing = population.slice(0, -1);
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, missing, provenance, assumptions), "INVALID_BASE_UNIT");
    const duplicates = [...population, population[0]!];
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, duplicates, provenance, assumptions), "INVALID_BASE_UNIT");
    const overlap = structuredClone(population);
    overlap[0]!.categories[1]!.sourceEstimateVariables = overlap[0]!.categories[0]!.sourceEstimateVariables;
    overlap[0]!.categories[1]!.sourceMoeVariables = overlap[0]!.categories[0]!.sourceMoeVariables;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, overlap, provenance, assumptions), "INVALID_BASE_UNIT");
    const invalid = structuredClone(population); invalid[0]!.categories[0]!.estimate++;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, invalid, provenance, assumptions), "INVALID_BASE_UNIT");
    const mismatch = structuredClone(provenance); mismatch.profileDigest = `sha256:${"f".repeat(64)}`;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, mismatch, assumptions), "INVALID_BASE_UNIT");
  });
  it("rejects suppressed estimates, negative, null, NaN, overflow, invalid weights, dangerous IDs", () => {
    const { election, rows } = fixture(2);
    const { population, provenance, assumptions, keys } = testPopulation(rows);
    for (const value of [null, -666666666, "N", NaN, Infinity, 1.5]) {
      const corrupted = structuredClone(population) as unknown as Record<string, unknown>[];
      (corrupted[0]!["categories"] as Record<string, unknown>[])[0]!["estimate"] = value;
      expectError(() => fitSyntheticElectorateFromComposition(election, rows, corrupted as unknown as CountyPopulationMarginal[], provenance, assumptions), "INVALID_BASE_UNIT");
    }
    const malicious = structuredClone(population); malicious[0]!.categories[0]!.id = "__proto__";
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, malicious, provenance, assumptions), "INVALID_BASE_UNIT");
    for (const weight of [NaN, Infinity, -1, 1001, 0.0000001]) {
      const bad = structuredClone(assumptions);
      bad.turnoutWeightByCategory[keys[0]!] = weight;
      expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, provenance, bad), "INVALID_ACTION");
    }
    const impossible = structuredClone(assumptions);
    for (const key of keys) impossible.turnoutWeightByCategory[key] = 0;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, provenance, impossible), "INVALID_ACTION");
    const withNullMoE = structuredClone(population);
    withNullMoE[0]!.universeMoe90 = null;
    expect(fitSyntheticElectorateFromComposition(election, rows, withNullMoE, provenance, assumptions).audit.counties[0]!.universeMoe90).toBeNull();
    const overflow = structuredClone(population);
    overflow[0]!.categories[0]!.estimate = Number.MAX_SAFE_INTEGER;
    overflow[0]!.universeEstimate = Number.MAX_SAFE_INTEGER;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, overflow, provenance, assumptions), "INTEGER_OVERFLOW");
  });
  it("treats null eligibility and empty population/ballots explicitly, never inventing a voter", () => {
    const { election, rows } = fixture(2, 1);
    for (const id of Object.keys(rows[0]!.votes)) rows[0]!.votes[id] = 0;
    rows[0]!.otherBallots = 0;
    rows[0]!.eligibleVoters = null;
    const { population, provenance, assumptions } = testPopulation(rows);
    for (const cat of population[0]!.categories) cat.estimate = 0;
    population[0]!.universeEstimate = 0;
    const fitted = fitSyntheticElectorateFromComposition(election, rows, population, provenance, assumptions);
    expect(fitted.partition.counties[0]!.cells.every(c => c.eligibleVoters === null &&
      Object.values(c.votes).every(value => value === 0) && c.otherBallots === 0)).toBe(true);
    expect(simulateCohortPartition(election, rows, fitted.partition, []).baseUnits).toEqual(rows);
    rows[0]!.eligibleVoters = 10;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, provenance, assumptions), "INVALID_ACTION");
  });
  it("requires actual adult ACS detailed variables, never child/total or unknown ACS fields", () => {
    const { election, rows } = fixture(2);
    const { population, provenance, assumptions } = testPopulation(rows);
    for (const code of ["B01001_001E", "B01001_006E", "B01001_030E", "B01001_050E", "B01001_999E", "B15003_002E"]) {
      const bad = structuredClone(population);
      bad[0]!.categories[0]!.sourceEstimateVariables = [code];
      bad[0]!.categories[0]!.sourceMoeVariables = [code.replace(/E$/, "M")];
      expectError(() => fitSyntheticElectorateFromComposition(election, rows, bad, provenance, assumptions), "INVALID_BASE_UNIT");
    }
    const { population: ed, provenance: ep, assumptions: ea } = testPopulation(rows, "education");
    ed[0]!.categories[0]!.sourceEstimateVariables = ["B15003_001E"];
    ed[0]!.categories[0]!.sourceMoeVariables = ["B15003_001M"];
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, ed, ep, ea), "INVALID_BASE_UNIT");
    const badMOE = structuredClone(population);
    badMOE[0]!.categories[1]!.moe90 = -1;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, badMOE, provenance, assumptions), "INVALID_BASE_UNIT");
  });
  it("fails closed for unsupported intersections, unverified provenance, and missing hypothetical assumptions", () => {
    const { election, rows } = fixture(3);
    const { population, provenance, assumptions } = testPopulation(rows);
    const mix = structuredClone(population);
    mix[0]!.dimension = "education";
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, mix, provenance, assumptions), "INVALID_BASE_UNIT");
    const unsourced = structuredClone(provenance); unsourced.releaseStatus = "unverified" as "verified";
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, unsourced, assumptions), "INVALID_BASE_UNIT");
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, population, provenance, {} as CompositionModelAssumptions), "INVALID_ACTION");
    expectError(() => fitSyntheticElectorateFromComposition({ ...election, dataStatus: "official" }, rows, population, provenance, assumptions), "INVALID_BASE_UNIT");
    const empty = structuredClone(population);
    empty[0]!.categories.forEach(cat => { cat.estimate = 0; });
    empty[0]!.universeEstimate = 0;
    expectError(() => fitSyntheticElectorateFromComposition(election, rows, empty, provenance, assumptions), "INVALID_ACTION");
  });
});
