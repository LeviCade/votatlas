import { describe, expect, it } from "vitest";
import type { BaseUnitResult, ElectionDefinition, GeoScope } from "@votatlas/contracts";
import { SimulationError, simulateElection } from "./engine.js";
import { simulateCohortPartition } from "./cohorts.js";
import type { CohortAction, SyntheticCohortPartition } from "./cohorts.js";

const geos = Array.from({ length: 95 }, (_, n) => `47${String(2 * n + 1).padStart(3, "0")}`);
const candidateIds = (count: number): string[] => Array.from({ length: count }, (_, i) => `c-${String(i).padStart(2, "0")}`);
function sample(count = 3, counties = 95): { election: ElectionDefinition; baseline: BaseUnitResult[]; partition: SyntheticCohortPartition } {
  const ids = candidateIds(count);
  const election: ElectionDefinition = { id: "cohort-test-synthetic", title: "Explicitly fictional", office: "test", geographyVintage: "2020", dataStatus: "synthetic",
    candidates: ids.map((id, i) => ({ id, name: `Fictional ${i}`, partyLabel: `not a real party ${i}`, color: "#123abc", ballotOrder: i })) };
  const partition: SyntheticCohortPartition = { schemaVersion: 1, dataStatus: "synthetic", partitionId: "synthetic-cohort-v1",
    universe: "modeled-ballots", kind: "single", dimensionIds: ["synthetic-age"],
    cohorts: ["young", "middle", "older"].map(id => ({ id, label: `Fictional ${id}`, dimensions: { "synthetic-age": id } })), counties: [] };
  const baseline: BaseUnitResult[] = [];
  for (const [j, geoId] of geos.slice(0, counties).entries()) {
    const cells = partition.cohorts.map((cohort, index) => {
      const votes = Object.fromEntries(ids.map((id, i) => [id, 55 + (i * 13 + index * 7 + j) % 29]));
      const otherBallots = (j + index) % 7;
      const sum = Object.values(votes).reduce((a, b) => a + b, 0) + otherBallots;
      return { cohortId: cohort.id, eligibleVoters: sum + 500, votes, otherBallots };
    });
    partition.counties.push({ geoId, cells });
    baseline.push({ geoId, stateId: "47", eligibleVoters: cells.reduce((a, c) => a + c.eligibleVoters, 0),
      votes: Object.fromEntries(ids.map(id => [id, cells.reduce((a, c) => a + c.votes[id]!, 0)])),
      otherBallots: cells.reduce((a, c) => a + c.otherBallots, 0) });
  }
  return { election, baseline, partition };
}
const scope = { kind: "national" as const };
const transfer = (id: string, from: string, to: string, points: number, cohorts = ["young"], selectedScope: GeoScope = scope): CohortAction =>
  ({ id, type: "COHORT_TRANSFER_PP", scope: selectedScope, cohortIds: cohorts, fromCandidateId: from, toCandidateId: to, points });
const turnout = (id: string, factor: number, cohorts = ["young"], selectedScope: GeoScope = scope): CohortAction =>
  ({ id, type: "COHORT_TURNOUT_SCALE", scope: selectedScope, cohortIds: cohorts, factor });
function code(fn: () => unknown, expected: string) {
  try { fn(); throw new Error("Expected SimulationError"); }
  catch (e) { expect(e).toBeInstanceOf(SimulationError); expect((e as SimulationError).code).toBe(expected); }
}
function expectedVotes(rows: readonly BaseUnitResult[], ids: string[]): number {
  return rows.reduce((acc, r) => acc + ids.reduce((n, id) => n + r.votes[id]!, 0), 0);
}
function conservation(result: ReturnType<typeof simulateCohortPartition>, before: BaseUnitResult[], ids: string[]) {
  expect(result.result.units).toEqual(simulateElection({ id: "cohort-test-synthetic", title: "Explicitly fictional", office: "test", geographyVintage: "2020", dataStatus: "synthetic", candidates: ids.map((id, i) => ({ id, name: `Fictional ${i}`, partyLabel: `not a real party ${i}`, color: "#123abc", ballotOrder: i })) }, result.baseUnits, { schemaVersion: 1, electionId: "cohort-test-synthetic", actions: [] }).units);
  expect(result.national.ballots).toBe(result.result.units.reduce((sum, row) => sum + row.ballots, 0));
  expect(result.byState["47"]!.ballots).toBe(result.national.ballots);
  expect(result.national.ballots).toBe(result.national.otherBallots + ids.reduce((sum, id) => sum + result.national.votes[id]!, 0));
  expect(result.baseUnits).toHaveLength(before.length);
  for (const c of result.cells) {
    expect(c.ballots).toBe(c.otherBallots + ids.reduce((sum, id) => sum + c.votes[id]!, 0));
    for (const id of ids) expect(Number.isSafeInteger(c.votes[id]) && c.votes[id]! >= 0).toBe(true);
  }
}

describe("R4 explicitly synthetic, disjoint cohort mathematics", () => {
  for (const size of [2, 3, 5, 10]) {
    it(`candidate-neutral ${size}-candidate exact 95-county zero-action identity and reproducible transfer`, () => {
      const { election, baseline, partition } = sample(size);
      const ids = candidateIds(size);
      const original = JSON.stringify({ election, baseline, partition });
      const base = simulateCohortPartition(election, baseline, partition);
      expect(base.baseUnits).toEqual(baseline);
      expect(base.cells).toHaveLength(285);
      expect(base.deltas.every(d => d.deltaBallots === 0 && Object.values(d.deltaVotes).every(v => v === 0))).toBe(true);
      const changed = simulateCohortPartition(election, baseline, partition, [transfer("t", ids[0]!, ids.at(-1)!, 2.5)]);
      expect(changed.national.ballots).toBe(base.national.ballots);
      expect(changed.national.otherBallots).toBe(base.national.otherBallots);
      expect(expectedVotes(changed.baseUnits, ids)).toBe(expectedVotes(baseline, ids));
      expect(changed.cells.filter(c => c.cohortId !== "young")).toEqual(base.cells.filter(c => c.cohortId !== "young"));
      expect(simulateCohortPartition(election, baseline, partition, [transfer("t", ids[0]!, ids.at(-1)!, 2.5)])).toEqual(changed);
      expect(JSON.stringify({ election, baseline, partition })).toBe(original);
      conservation(changed, baseline, ids);
    });
  }
  it("turnout applies to selected cohort's explicit full-ballot denominator; untouched cohorts/county stay unchanged", () => {
    const { election, baseline, partition } = sample(3, 3);
    const res = simulateCohortPartition(election, baseline, partition,
      [turnout("local", 0.5, ["young"], { kind: "county", countyIds: ["47001"] })]);
    const firstBefore = partition.counties[0]!.cells[0]!;
    const firstAfter = res.cells.find(c => c.geoId === "47001" && c.cohortId === "young")!;
    const beforeTotal = Object.values(firstBefore.votes).reduce((a, b) => a + b, firstBefore.otherBallots);
    expect(firstAfter.ballots).toBe(Math.floor(beforeTotal * .5 + .5));
    expect(res.baseUnits[1]).toEqual(baseline[1]);
    expect(res.baseUnits[2]).toEqual(baseline[2]);
    expect(res.deltas.filter(d => d.deltaBallots !== 0)).toHaveLength(1);
    conservation(res, baseline, candidateIds(3));
  });
  it("supports zero support and zero turnout cells without inventing voters", () => {
    const { election, baseline, partition } = sample(2, 1);
    const removed = partition.counties[0]!.cells[0]!;
    const other = partition.counties[0]!.cells[1]!;
    for (const id of candidateIds(2)) { other.votes[id]! += removed.votes[id]!; removed.votes[id] = 0; }
    other.otherBallots += removed.otherBallots;
    removed.otherBallots = 0;
    removed.eligibleVoters = 0;
    other.eligibleVoters = baseline[0]!.eligibleVoters! - partition.counties[0]!.cells[2]!.eligibleVoters!;
    const result = simulateCohortPartition(election, baseline, partition, [turnout("zero", 99, ["young"])]);
    expect(result.cells.find(c => c.cohortId === "young")!.ballots).toBe(0);
    expect(result.baseUnits).toEqual(baseline);
    expect(simulateCohortPartition(election, baseline, partition, [transfer("zero", "c-00", "c-01", 100, [])]).baseUnits).toEqual(baseline);
  });
  it("rejects donor infeasibility, unknown IDs, unsupported scopes and overflow", () => {
    const { election, baseline, partition } = sample(3, 1);
    code(() => simulateCohortPartition(election, baseline, partition, [transfer("impossible", "c-00", "c-01", 100)]), "INSUFFICIENT_SUPPORT");
    code(() => simulateCohortPartition(election, baseline, partition, [transfer("u", "fictional-unknown", "c-01", 1)]), "UNKNOWN_CANDIDATE");
    code(() => simulateCohortPartition(election, baseline, partition, [turnout("u", 2, ["not-a-cohort"])]), "UNKNOWN_GEO");
    code(() => simulateCohortPartition(election, baseline, partition, [turnout("s", 1, ["young"], {kind:"district",districtIds:["1"],vintage:"2020"})]), "UNSUPPORTED_SCOPE");
    code(() => simulateCohortPartition(election, baseline, partition, [turnout("x", 10000)]), "TURNOUT_EXCEEDS_ELIGIBLE");
    code(() => simulateCohortPartition(election, baseline, partition, [turnout("large", Number.MAX_VALUE)]), "INTEGER_OVERFLOW");
    code(() => simulateCohortPartition(election, baseline, partition, [transfer("bad", "c-00", "c-01", NaN)]), "INVALID_ACTION");
    code(() => simulateCohortPartition(election, baseline, partition, [turnout("a", 1), turnout("a", 1)]), "INVALID_ACTION");
  });
  it("strictly rejects incomplete, duplicate, overlapping and forged county partitions", () => {
    const { election, baseline, partition } = sample(3, 2);
    const copy = (): SyntheticCohortPartition => structuredClone(partition);
    const missing = copy(); missing.counties.pop();
    code(() => simulateCohortPartition(election, baseline, missing), "INVALID_BASE_UNIT");
    const absentCell = copy(); absentCell.counties[0]!.cells.pop();
    code(() => simulateCohortPartition(election, baseline, absentCell), "INVALID_BASE_UNIT");
    const extra = copy(); extra.counties[0]!.cells[0]!.votes["c-00"]!++;
    code(() => simulateCohortPartition(election, baseline, extra), "INVALID_BASE_UNIT");
    const duplicate = copy(); duplicate.cohorts[1]!.id = "young";
    code(() => simulateCohortPartition(election, baseline, duplicate), "INVALID_BASE_UNIT");
    const overlapping = copy(); overlapping.cohorts[1]!.dimensions["synthetic-age"] = "young";
    code(() => simulateCohortPartition(election, baseline, overlapping), "INVALID_BASE_UNIT");
    const forged = copy(); forged.dataStatus = "observed" as "synthetic";
    code(() => simulateCohortPartition(election, baseline, forged), "INVALID_BASE_UNIT");
    const disguised = copy(); disguised.dimensionIds = ["synthetic-age", "synthetic-income"];
    code(() => simulateCohortPartition(election, baseline, disguised), "INVALID_BASE_UNIT");
    const newCandidate = copy(); newCandidate.counties[0]!.cells[0]!.votes["unknown"] = 1;
    code(() => simulateCohortPartition(election, baseline, newCandidate), "INVALID_BASE_UNIT");
    const poisoned = copy(); poisoned.cohorts[0]!.id = "__proto__";
    code(() => simulateCohortPartition(election, baseline, poisoned), "INVALID_BASE_UNIT");
    const outOfRange = copy(); outOfRange.counties[0]!.cells[0]!.otherBallots = Infinity;
    code(() => simulateCohortPartition(election, baseline, outOfRange), "INVALID_BASE_UNIT");
  });
  it("accepts verified explicit joint counts but rejects independent marginal mixtures", () => {
    const { election, baseline, partition } = sample(3, 2);
    const joint = structuredClone(partition);
    joint.kind = "joint";
    joint.dimensionIds = ["synthetic-age", "synthetic-income"];
    joint.jointCountsSource = "explicit-synthetic-cross-tabulation";
    joint.cohorts.forEach(c => c.dimensions["synthetic-income"] = `joint-${c.id}`);
    expect(simulateCohortPartition(election, baseline, joint).baseUnits).toEqual(baseline);
    delete joint.jointCountsSource;
    code(() => simulateCohortPartition(election, baseline, joint), "INVALID_BASE_UNIT");
  });
  it("candidate registry permutations and input county/cell permutations are numerically identical", () => {
    const { election, baseline, partition } = sample(5, 8);
    const action = [transfer("t", "c-00", "c-04", 2, ["middle", "young"]), turnout("x", .85, ["young"])] satisfies CohortAction[];
    const expected = simulateCohortPartition(election, baseline, partition, action);
    const shuffled = structuredClone(partition);
    shuffled.counties.reverse(); shuffled.cohorts.reverse(); shuffled.counties.forEach(row => row.cells.reverse());
    const reordered = simulateCohortPartition({ ...election, candidates: [...election.candidates].reverse() }, [...baseline].reverse(), shuffled, action);
    expect(reordered).toEqual(expected);
  });
  it("100+ ordered steps on 95 counties preserve integer conservation and identical replay", () => {
    const { election, baseline, partition } = sample(10);
    const actions: CohortAction[] = Array.from({ length: 160 }, (_, i) =>
      i % 9 === 0 ? turnout(`turnout-${i}`, 1, ["middle"]) :
        transfer(`transfer-${i}`, i % 2 === 0 ? "c-00" : "c-09", i % 2 === 0 ? "c-09" : "c-00", .01, ["young", "older"]));
    const once = simulateCohortPartition(election, baseline, partition, actions);
    const again = simulateCohortPartition(election, baseline, partition, structuredClone(actions));
    expect(JSON.stringify(once)).toBe(JSON.stringify(again));
    expect(once.national.ballots).toBe(baseline.reduce((s, r) => s + r.otherBallots + Object.values(r.votes).reduce((a,b) => a+b,0),0));
    conservation(once, baseline, candidateIds(10));
    expect(simulateCohortPartition(election, baseline, partition, [])).toEqual(simulateCohortPartition(election, baseline, partition, []));
  });
  it("seeded mixed-scope 190-action replay is deterministic and bounded by all explicit universes", () => {
    const { election, baseline, partition } = sample(5);
    let seed = 0xC0FFEE42;
    const next = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const actions: CohortAction[] = [];
    for (let i = 0; i < 190; i++) {
      const county = geos[Math.floor(next() * 95)]!;
      const location: GeoScope = i % 4 === 0 ? { kind: "county", countyIds: [county] } : i % 5 === 0 ? { kind: "state", stateId: "47" } : scope;
      const cohorts = [["young"], ["older"], ["middle", "young"]][Math.floor(next() * 3)]!;
      if (i % 6 === 0) actions.push(turnout(`turn-${i}`, i % 12 === 0 ? 1 : .999, cohorts, location));
      else {
        const from = Math.floor(next() * 5);
        const to = (from + 1 + Math.floor(next() * 4)) % 5;
        actions.push(transfer(`transfer-${i}`, `c-${String(from).padStart(2, "0")}`, `c-${String(to).padStart(2, "0")}`, .001, cohorts, location));
      }
    }
    const original = JSON.stringify({ partition, baseline, election });
    const a = simulateCohortPartition(election, baseline, partition, actions);
    const b = simulateCohortPartition(election, baseline, partition, structuredClone(actions));
    expect(a).toEqual(b);
    expect(JSON.stringify({ partition, baseline, election })).toBe(original);
    conservation(a, baseline, candidateIds(5));
    expect(a.cells.every(c => c.eligibleVoters === null || c.ballots <= c.eligibleVoters)).toBe(true);
  });
  it("does not misrepresent synthetic preferences as observed historical data", () => {
    const { election, baseline, partition } = sample(3, 2);
    code(() => simulateCohortPartition({ ...election, dataStatus: "official" }, baseline, partition), "INVALID_BASE_UNIT");
    code(() => simulateCohortPartition({ ...election, dataStatus: "estimated" }, baseline, partition), "INVALID_BASE_UNIT");
  });
  it("action order is preserved, including turnout before vs after transfer", () => {
    const { election, baseline, partition } = sample(2, 1);
    // Minimal selected cell exposes non-commutativity under half-up integer rounding.
    const young = partition.counties[0]!.cells.find(c => c.cohortId === "young")!;
    const middle = partition.counties[0]!.cells.find(c => c.cohortId === "middle")!;
    for (const id of candidateIds(2)) { middle.votes[id]! += young.votes[id]! - 1; young.votes[id] = 1; }
    middle.otherBallots += young.otherBallots; young.otherBallots = 0;
    young.eligibleVoters = 2;
    middle.eligibleVoters = baseline[0]!.eligibleVoters! - partition.counties[0]!.cells.find(c => c.cohortId === "older")!.eligibleVoters! - 2;
    const a = transfer("t", "c-00", "c-01", 25);
    const b = turnout("s", .5);
    const before = simulateCohortPartition(election, baseline, partition, [a, b]);
    const after = simulateCohortPartition(election, baseline, partition, [b, a]);
    expect(before.baseUnits).not.toEqual(after.baseUnits);
  });
});
