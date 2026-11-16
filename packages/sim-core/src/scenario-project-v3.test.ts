import { describe, expect, it } from "vitest";
import type { Adjustment, BaseUnitResult, ElectionDefinition, Scenario } from "@votatlas/contracts";
import {
  addCandidate, appendAction, createScenarioProject, createScenarioProjectV3,
  createSyntheticDemoPartition, createSyntheticDemoModel, parseScenarioProject, restoreScenarioProject,
  serializeScenarioProject, serializeScenario, simulateCohortPartition,
  simulateElection, SimulationError, FICTIONAL_COHORT_MODEL_DESCRIPTION
} from "./index.js";
import type { CohortAction } from "./cohorts.js";
import type { ScenarioProjectV3 } from "./scenario-project.js";

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `id-${i}`);
const locators = Array.from({ length: 95 }, (_, i) => `47${String(2 * i + 1).padStart(3, "0")}`);
function fixture(n: number) {
  const candidateIds = ids(n);
  const election: ElectionDefinition = {
    id: "test-tn-synthetic", title: "Entirely invented county data", office: "fictional",
    geographyVintage: "2020", dataStatus: "synthetic",
    candidates: candidateIds.map((id, i) => ({ id, name: `Fictional ${id}`, color: "#112233", ballotOrder: i }))
  };
  const baseUnits: BaseUnitResult[] = locators.map((geoId, i) => {
    const votes = Object.fromEntries(candidateIds.map((id, j) => [id, 130 + ((i * 17 + j * 23) % 50)]));
    return { geoId, stateId: "47", eligibleVoters: Object.values(votes).reduce((a, b) => a + b, 0) + 900,
      votes, otherBallots: i % 11 };
  });
  const scenario: Scenario = { schemaVersion: 1, electionId: election.id, actions: [] };
  return { election, baseUnits, scenario };
}
const classicShare = (id: string, actionId: string, targetPercent = 25): Adjustment => ({
  id: actionId, type: "SET_SHARE", scope: { kind: "state", stateId: "47" },
  candidateId: id, targetPercent, redistribution: { kind: "proportional-other" }
});
const change = (id: string, from: string, to: string, points: number, geoIds = ["47001", "47037"]): CohortAction => ({
  type: "COHORT_TRANSFER_PP", id, scope: { kind: "county", countyIds: geoIds },
  cohortIds: ["fictional-age-18-34"], fromCandidateId: from, toCandidateId: to, points
});
const turnout = (id: string, factor: number, cohortIds = ["fictional-age-35-54"]): CohortAction => ({
  type: "COHORT_TURNOUT_SCALE", id, scope: { kind: "state", stateId: "47" }, cohortIds, factor
});
function prepared(n: number, seed = "votatlas-r5-test") {
  const source = fixture(n);
  const history = appendAction(source.scenario, classicShare("id-0", "pre-addition"));
  const extension = addCandidate(source.election, source.baseUnits,
    { id: "custom-x", name: "Custom fictional X", color: "#abcdef", partyLabel: "Made up" }, history);
  const election = extension.election;
  const baseUnits = extension.baseUnits;
  const scenario = appendAction(extension.scenario!, classicShare("custom-x", "after-addition", 10));
  const intermediate = simulateElection(election, baseUnits, scenario);
  const partition = createSyntheticDemoPartition(election, intermediate.units, seed);
  const actions: CohortAction[] = [change("county-transfer", "id-0", "custom-x", 1.25), turnout("state-turnout", 0.98)];
  return { source, election, baseUnits, scenario, intermediate, partition, actions };
}
function code(fn: () => unknown, expected: string): void {
  try { fn(); throw new Error(`Expected ${expected}`); }
  catch (e) {
    expect(e).toBeInstanceOf(SimulationError);
    expect((e as SimulationError).code).toBe(expected);
  }
}
function project(n: number): { state: ReturnType<typeof prepared>; value: ScenarioProjectV3 } {
  const state = prepared(n);
  const value = createScenarioProjectV3(state.source.election, state.source.baseUnits,
    state.election, state.baseUnits, state.scenario, state.partition, state.actions, createSyntheticDemoModel("votatlas-r5-test"));
  return { state, value };
}

describe("Round Five canonical v3 source-bound synthetic project", () => {
  for (const n of [2, 3, 5, 10]) {
    it(`round-trips 95 counties with ${n} original candidates + a new custom candidate, precisely`, () => {
      const { state, value } = project(n);
      const frozen = JSON.stringify(state);
      expect(value.schemaVersion).toBe(3);
      expect(value.source.digest.slice(0, 7)).toBe("sha256:");
      expect(value.registry.additions).toHaveLength(1);
      expect(value.cohort.partition.counties).toHaveLength(95);
      expect(value.cohort.model.kind).toBe("synthetic");
      const raw = serializeScenarioProject(value);
      const parsed = parseScenarioProject(raw);
      expect(serializeScenarioProject(parsed as ScenarioProjectV3)).toBe(raw);
      const a = restoreScenarioProject(raw, state.source.election, state.source.baseUnits);
      const b = restoreScenarioProject(parsed, state.source.election, state.source.baseUnits);
      expect(a).toEqual(b);
      if (!("cohortResult" in a)) throw new Error("expected v3 restored cohort result");
      expect(a.election).toEqual(state.election);
      expect(a.scenario).toEqual(state.scenario);
      expect(a.intermediate).toEqual(state.intermediate);
      expect(a.result).toEqual(simulateCohortPartition(state.election, state.intermediate.units,
        state.partition, state.actions).result);
      expect(a.result.national.ballots).toBe(a.result.units.reduce((s, u) => s + u.ballots, 0));
      expect(a.result.national.ballots).toBe(a.result.byState["47"]!.ballots);
      expect(a.result.national.ballots).toBe(a.result.national.otherBallots +
        Object.values(a.result.national.votes).reduce((s, x) => s + x, 0));
      expect(JSON.stringify(state)).toBe(frozen);
    });
  }
  it("fake age groups are explicitly labeled fictional, seed-versioned and candidate-order invariant", () => {
    const state = prepared(5);
    const one = createSyntheticDemoPartition(state.election, state.intermediate.units, "seed-fixed");
    const two = createSyntheticDemoPartition({ ...state.election, candidates: [...state.election.candidates].reverse() },
      [...state.intermediate.units].reverse(), "seed-fixed");
    expect(one).toEqual(two);
    expect(JSON.stringify(one).includes("FICTIONAL")).toBe(true);
    expect(FICTIONAL_COHORT_MODEL_DESCRIPTION.includes("not observed demographics")).toBe(true);
    expect(createSyntheticDemoPartition(state.election, state.intermediate.units, "seed-other")).not.toEqual(one);
    for (const county of one.counties) {
      const baseline = state.intermediate.units.find(u => u.geoId === county.geoId)!;
      for (const id of state.election.candidates.map(c => c.id))
        expect(county.cells.reduce((s, c) => s + c.votes[id]!, 0)).toBe(baseline.votes[id]);
      expect(county.cells.reduce((s, c) => s + c.otherBallots, 0)).toBe(baseline.otherBallots);
      expect(county.cells.reduce((s, c) => s + c.eligibleVoters!, 0)).toBe(baseline.eligibleVoters);
    }
  });
  it("legacy v1 and v2 project parsing and restoration stay functional", () => {
    const source = fixture(3);
    const history = appendAction(source.scenario, classicShare("id-0", "old"));
    const old = serializeScenario(history);
    const loaded = restoreScenarioProject(old, source.election, source.baseUnits);
    expect(loaded.result).toEqual(simulateElection(source.election, source.baseUnits, history));
    const v2 = createScenarioProject(source.election, source.baseUnits, source.election, source.baseUnits, history);
    expect(serializeScenarioProject(parseScenarioProject(serializeScenarioProject(v2)) as typeof v2))
      .toBe(serializeScenarioProject(v2));
    expect(restoreScenarioProject(v2, source.election, source.baseUnits).result).toEqual(loaded.result);
  });
  it("changing classic history, even by an otherwise zero-impact edit, invalidates the bound partition", () => {
    const { state, value } = project(3);
    const forged = structuredClone(value);
    forged.scenario.actions.push({ id: "new-noop", type: "TRANSFER_PP", scope: { kind: "county", countyIds: ["47001"] },
      fromCandidateId: "id-0", toCandidateId: "custom-x", points: 0 });
    code(() => restoreScenarioProject(forged, state.source.election, state.source.baseUnits), "SOURCE_MISMATCH");
    const altered = structuredClone(value);
    altered.registry.additions[0]!.name = "Changed current hypothetical candidate";
    code(() => restoreScenarioProject(altered, state.source.election, state.source.baseUnits), "SOURCE_MISMATCH");
  });
  it("rejects mismatched source votes, source identity and modified partition counts", () => {
    const { state, value } = project(3);
    const other = structuredClone(state.source.baseUnits);
    other[0]!.votes["id-0"]!++;
    code(() => restoreScenarioProject(value, state.source.election, other), "SOURCE_MISMATCH");
    const tamperedSeed = structuredClone(value);
    tamperedSeed.cohort.model.seed = "a-different-seed";
    code(() => restoreScenarioProject(tamperedSeed, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
    const source = structuredClone(value);
    source.source.digest = `sha256:${"0".repeat(64)}`;
    code(() => restoreScenarioProject(source, state.source.election, state.source.baseUnits), "SOURCE_MISMATCH");
    const bad = structuredClone(value);
    bad.cohort.partition.counties[0]!.cells[0]!.votes["id-0"]!++;
    code(() => restoreScenarioProject(bad, state.source.election, state.source.baseUnits), "INVALID_BASE_UNIT");
  });
  it("rejects overlapping tuples, missing counties, duplicate cohorts and dangerous JSON keys", () => {
    const { state, value } = project(3);
    const overlapping = structuredClone(value);
    overlapping.cohort.partition.cohorts[1]!.dimensions = { ...overlapping.cohort.partition.cohorts[0]!.dimensions };
    code(() => restoreScenarioProject(overlapping, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
    const missing = structuredClone(value);
    missing.cohort.partition.counties.pop();
    code(() => restoreScenarioProject(missing, state.source.election, state.source.baseUnits), "INVALID_BASE_UNIT");
    const duplicate = structuredClone(value);
    duplicate.cohort.partition.cohorts[1]!.id = duplicate.cohort.partition.cohorts[0]!.id;
    code(() => restoreScenarioProject(duplicate, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
    const dangerous = JSON.parse(serializeScenarioProject(value)) as unknown as Record<string, unknown>;
    (dangerous.cohort as Record<string, unknown>).__proto__ = { suspicious: true };
    // A JSON-owned dangerous key is rejected, rather than changing Object.prototype.
    const raw = serializeScenarioProject(value).replace('"cohort":{', '"cohort":{"__proto__":{"polluted":true},');
    code(() => restoreScenarioProject(raw, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
    expect(({} as Record<string, unknown>).polluted).toBe(undefined);
  });
  it("rejects unsupported versions, malformed percentages, invalid donor capacity and excessive turnout", () => {
    const { state, value } = project(3);
    const version = structuredClone(value) as unknown as Record<string, unknown>;
    version.schemaVersion = 4;
    code(() => restoreScenarioProject(JSON.stringify(version), state.source.election, state.source.baseUnits), "UNSUPPORTED_PROJECT_VERSION");
    const badTransfer = structuredClone(value);
    badTransfer.cohort.actions = [change("bad", "id-0", "custom-x", 100)];
    code(() => restoreScenarioProject(badTransfer, state.source.election, state.source.baseUnits), "INSUFFICIENT_SUPPORT");
    const badTurnout = structuredClone(value);
    badTurnout.cohort.actions = [turnout("excess", 100)];
    code(() => restoreScenarioProject(badTurnout, state.source.election, state.source.baseUnits), "TURNOUT_EXCEEDS_ELIGIBLE");
    const percentage = structuredClone(value);
    percentage.cohort.actions[0] = { ...percentage.cohort.actions[0]!, points: -1 } as CohortAction;
    code(() => restoreScenarioProject(percentage, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
    const dup = structuredClone(value);
    dup.cohort.actions[1]!.id = dup.cohort.actions[0]!.id;
    code(() => restoreScenarioProject(dup, state.source.election, state.source.baseUnits), "INVALID_PROJECT");
  });
  it("multi-county and statewide edits preserve locality, integer counts and ordered undo", () => {
    const { state, value } = project(5);
    const loaded = restoreScenarioProject(value, state.source.election, state.source.baseUnits);
    if (!("cohortResult" in loaded)) throw new Error("Expected cohort output");
    const baseline = state.intermediate.units;
    const two = state.actions.slice(0, 1);
    const onlyTwo = simulateCohortPartition(state.election, baseline, state.partition, two);
    expect(onlyTwo.baseUnits.filter(row => row.geoId !== "47001" && row.geoId !== "47037"))
      .toEqual(baseline.filter(row => row.geoId !== "47001" && row.geoId !== "47037").map(({ ballots: _ballots, ...rest }) => rest));
    const undone = createScenarioProjectV3(state.source.election, state.source.baseUnits,
      state.election, state.baseUnits, state.scenario, state.partition, two, createSyntheticDemoModel("votatlas-r5-test"));
    expect(restoreScenarioProject(undone, state.source.election, state.source.baseUnits).result).toEqual(onlyTwo.result);
    expect(loaded.result.national.ballots).toBe(loaded.result.byState["47"]!.ballots);
  });
  it("95 counties and 210 alternating cohort actions replay identically with seed and action-order preserved", () => {
    const state = prepared(10);
    const actions: CohortAction[] = [];
    for (let i = 0; i < 210; i++) {
      const group = ["fictional-age-18-34", "fictional-age-35-54", "fictional-age-55-plus"][i % 3]!;
      if (i % 7 === 0) actions.push({
        type: "COHORT_TURNOUT_SCALE", id: `turnout-${i}`, cohortIds: [group],
        scope: { kind: "state", stateId: "47" }, factor: 0.9999
      });
      else actions.push({
        type: "COHORT_TRANSFER_PP", id: `transfer-${i}`, cohortIds: [group],
        scope: i % 4 === 0 ? { kind: "county", countyIds: ["47001", "47003"] } : { kind: "state", stateId: "47" },
        fromCandidateId: `id-${i % 10}`, toCandidateId: `id-${(i + 1) % 10}`, points: 0.005
      });
    }
    const start = JSON.stringify({ state, actions });
    const proj = createScenarioProjectV3(state.source.election, state.source.baseUnits,
      state.election, state.baseUnits, state.scenario, state.partition, actions, createSyntheticDemoModel("votatlas-r5-test"));
    const encoded = serializeScenarioProject(proj);
    const loaded = restoreScenarioProject(encoded, state.source.election, state.source.baseUnits);
    expect(serializeScenarioProject(parseScenarioProject(encoded) as ScenarioProjectV3)).toBe(encoded);
    expect(loaded.result).toEqual(restoreScenarioProject(encoded, state.source.election, state.source.baseUnits).result);
    expect(loaded.result.national.ballots).toBe(loaded.result.byState["47"]!.ballots);
    for (const unit of loaded.result.units) {
      const total = Object.values(unit.votes).reduce((s, count) => s + count, unit.otherBallots);
      expect(unit.ballots).toBe(total);
      expect(unit.eligibleVoters! >= total).toBe(true);
      expect(Object.values(unit.votes).every(count => Number.isSafeInteger(count) && count >= 0)).toBe(true);
    }
    expect(JSON.stringify({ state, actions })).toBe(start);
  });
  it("zero-candidate-ballot fixture partitions without invention and refuses observed data", () => {
    const source = fixture(2);
    for (const unit of source.baseUnits) {
      unit.votes["id-0"] = 0; unit.votes["id-1"] = 0; unit.otherBallots = 0;
    }
    const partition = createSyntheticDemoPartition(source.election, source.baseUnits);
    const result = simulateCohortPartition(source.election, source.baseUnits, partition, [
      change("zero", "id-0", "id-1", 100), turnout("still-zero", 2)
    ]);
    expect(result.national.ballots).toBe(0);
    code(() => createSyntheticDemoPartition({ ...source.election, dataStatus: "official" }, source.baseUnits), "INVALID_PROJECT");
  });
});
