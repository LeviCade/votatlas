import { describe, expect, it } from "vitest";
import type { Adjustment, BaseUnitResult, ElectionDefinition, Scenario, SimulationResult } from "@votatlas/contracts";
import {
  SimulationError, appendAction, parseScenario, serializeScenario, simulateElection, undoLastAction
} from "./index.js";

const idsFor = (n: number): string[] => Array.from({ length: n }, (_, i) => `candidate-${String.fromCharCode(65 + i)}`);
const makeElection = (ids: readonly string[]): ElectionDefinition => ({
  id: "synthetic-2026", title: "Fictional election", office: "Test", geographyVintage: "2026",
  dataStatus: "synthetic", candidates: ids.map((id, i) => ({ id, name: id, color: "#999999", ballotOrder: i }))
});
const makeRows = (ids: readonly string[]): BaseUnitResult[] => [
  { geoId: "47003", stateId: "47", eligibleVoters: null,
    votes: Object.fromEntries(ids.map((id, i) => [id, (i + 1) * 10 + 3])), otherBallots: 3 },
  { geoId: "01001", stateId: "01", eligibleVoters: null,
    votes: Object.fromEntries(ids.map((id, i) => [id, (i + 1) * 12 + 5])), otherBallots: 7 },
  { geoId: "47001", stateId: "47", eligibleVoters: null,
    votes: Object.fromEntries(ids.map((id, i) => [id, (i + 1) * 15 + 7])), otherBallots: 2 }
];
const empty = (): Scenario => ({ schemaVersion: 1, electionId: "synthetic-2026", actions: [] });
const transfer = (fromCandidateId: string, toCandidateId: string, points: number,
  scope: Adjustment["scope"] = { kind: "national" }, id = "transfer"): Adjustment => ({
  type: "TRANSFER_PP", id, scope, fromCandidateId, toCandidateId, points
});
const share = (candidateId: string, targetPercent: number, redistribution: Extract<Adjustment, { type: "SET_SHARE" }>["redistribution"],
  scope: Adjustment["scope"] = { kind: "national" }, id = "share"): Adjustment => ({
  type: "SET_SHARE", id, scope, candidateId, targetPercent, redistribution
});
const turnout = (factor: number, scope: Adjustment["scope"] = { kind: "national" }, id = "turnout"): Adjustment => ({
  type: "TURNOUT_SCALE", id, scope, factor, allocation: "proportional-candidates"
});
const withActions = (...actions: Adjustment[]): Scenario => ({ ...empty(), actions });
const totalCandidates = (result: SimulationResult): number =>
  Object.values(result.national.votes).reduce((sum, value) => sum + value, 0);

function verifyInvariants(result: SimulationResult, ids: readonly string[]): void {
  const states = new Map<string, { ballots: number; other: number; votes: Record<string, number> }>();
  for (const row of result.units) {
    expect(Number.isSafeInteger(row.ballots)).toBe(true);
    expect(row.ballots).toBeGreaterThanOrEqual(0);
    expect(row.ballots).toBe(row.otherBallots + ids.reduce((sum, id) => sum + row.votes[id]!, 0));
    expect(Object.keys(row.votes).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(Number.isSafeInteger(row.votes[id])).toBe(true);
      expect(row.votes[id]).toBeGreaterThanOrEqual(0);
    }
    const state = states.get(row.stateId) ?? {
      ballots: 0, other: 0, votes: Object.fromEntries(ids.map(id => [id, 0]))
    };
    state.ballots += row.ballots;
    state.other += row.otherBallots;
    for (const id of ids) state.votes[id]! += row.votes[id]!;
    states.set(row.stateId, state);
  }
  for (const [id, expected] of states) {
    expect(result.byState[id]?.ballots).toBe(expected.ballots);
    expect(result.byState[id]?.otherBallots).toBe(expected.other);
    expect(result.byState[id]?.votes).toEqual(expected.votes);
  }
  expect(result.national.ballots).toBe(result.units.reduce((sum, row) => sum + row.ballots, 0));
  expect(result.national.otherBallots).toBe(result.units.reduce((sum, row) => sum + row.otherBallots, 0));
  expect(result.national.ballots).toBe(totalCandidates(result) + result.national.otherBallots);
}

function errorCode(run: () => unknown, code: string): void {
  try { run(); throw new Error(`Expected ${code}`); }
  catch (error) {
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).code).toBe(code);
  }
}

describe("v0.1 candidate-neutral numerical engine", () => {
  for (const count of [2, 3, 5, 10]) {
    it(`${count} candidates: exact baseline, permutation neutrality and aggregation`, () => {
      const ids = idsFor(count);
      const rows = makeRows(ids);
      const originalRows = JSON.stringify(rows);
      const result = simulateElection(makeElection(ids), rows, empty());
      expect(result.units.map(row => row.geoId)).toEqual(["01001", "47001", "47003"]);
      for (const row of result.units) {
        const base = rows.find(input => input.geoId === row.geoId)!;
        expect(row.votes).toEqual(base.votes);
        expect(row.otherBallots).toBe(base.otherBallots);
      }
      verifyInvariants(result, ids);
      expect(JSON.stringify(rows)).toBe(originalRows);
      const reverseOrder = [...ids].reverse();
      const reorderedRows = rows.map(row => ({
        ...row, votes: Object.fromEntries(reverseOrder.map(id => [id, row.votes[id]!]))
      })).reverse();
      const permuted = simulateElection(makeElection(reverseOrder), reorderedRows, empty());
      expect(permuted).toEqual(result);
    });

    it(`${count} candidates: ordered action replay, conservation and serialization`, () => {
      const ids = idsFor(count);
      const first = ids[0]!;
      const last = ids[ids.length - 1]!;
      const election = makeElection(ids);
      const rows = makeRows(ids);
      const history = withActions(
        transfer(last, first, 2.5, { kind: "county", countyIds: ["47003", "47001"] }),
        share(first, 31, { kind: "proportional-other" }, { kind: "state", stateId: "47" }),
        turnout(1.15, { kind: "national" })
      );
      const snapshot = JSON.stringify(history);
      const firstRun = simulateElection(election, rows, history);
      const secondRun = simulateElection(election, rows, history);
      const loaded = simulateElection(election, rows, parseScenario(serializeScenario(history)));
      expect(JSON.stringify(firstRun)).toBe(JSON.stringify(secondRun));
      expect(loaded).toEqual(firstRun);
      expect(JSON.stringify(history)).toBe(snapshot);
      verifyInvariants(firstRun, ids);
      const partial = undoLastAction(history);
      expect(partial.actions).toHaveLength(2);
      expect(history.actions).toHaveLength(3);
      const restored = appendAction(partial, history.actions[2]!);
      expect(simulateElection(election, rows, restored)).toEqual(firstRun);
      expect(simulateElection(election, rows, empty())).toEqual(simulateElection(election, rows, undoLastAction(withActions(transfer(last, first, 1)))));
    });
  }

  it("TRANSFER_PP moves a percent-point slice of aggregate candidate ballots, only within selected counties", () => {
    const ids = idsFor(3);
    const original = simulateElection(makeElection(ids), makeRows(ids), empty());
    const action = transfer(ids[2]!, ids[0]!, 5, { kind: "county", countyIds: ["47003"] });
    const adjusted = simulateElection(makeElection(ids), makeRows(ids), withActions(action));
    const before = original.units.find(row => row.geoId === "47003")!;
    const after = adjusted.units.find(row => row.geoId === "47003")!;
    const candidateBallots = ids.reduce((sum, id) => sum + before.votes[id]!, 0);
    const moved = Math.round(candidateBallots * 0.05);
    expect(after.votes[ids[2]!]).toBe(before.votes[ids[2]!]! - moved);
    expect(after.votes[ids[0]!]).toBe(before.votes[ids[0]!]! + moved);
    expect(after.votes[ids[1]!]).toBe(before.votes[ids[1]!]);
    expect(after.ballots).toBe(before.ballots);
    expect(adjusted.units.filter(row => row.geoId !== "47003")).toEqual(original.units.filter(row => row.geoId !== "47003"));
    expect(totalCandidates(adjusted)).toBe(totalCandidates(original));
  });

  it("largest remainder breaks identical county ties by GEOID and half-up rounds 0.5 ballots", () => {
    const ids = ["B", "A"];
    const election = makeElection(ids);
    const rows: BaseUnitResult[] = [
      { geoId: "47003", stateId: "47", eligibleVoters: null, votes: { B: 1, A: 1 }, otherBallots: 0 },
      { geoId: "47001", stateId: "47", eligibleVoters: null, votes: { B: 1, A: 1 }, otherBallots: 0 }
    ];
    const result = simulateElection(election, rows, withActions(transfer("B", "A", 25)));
    expect(result.units[0]?.votes).toEqual({ A: 2, B: 0 });
    expect(result.units[1]?.votes).toEqual({ A: 1, B: 1 });
    const half = simulateElection(election, [rows[0]!], withActions(transfer("B", "A", 25)));
    expect(half.national.votes).toEqual({ A: 2, B: 0 });
    verifyInvariants(result, ids);
  });

  it("0% is exact identity, and 100% only succeeds with sufficient source support", () => {
    const election = makeElection(["a", "b"]);
    const rows: BaseUnitResult[] = [
      { geoId: "47001", stateId: "47", eligibleVoters: null, votes: { a: 8, b: 0 }, otherBallots: 2 }
    ];
    const baseline = simulateElection(election, rows, empty());
    expect(simulateElection(election, rows, withActions(transfer("a", "b", 0)))).toEqual(baseline);
    const swept = simulateElection(election, rows, withActions(transfer("a", "b", 100)));
    expect(swept.national.votes).toEqual({ a: 0, b: 8 });
    expect(swept.national.otherBallots).toBe(2);
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { a: 7, b: 1 } }], withActions(transfer("a", "b", 100))), "INSUFFICIENT_SUPPORT");
  });

  it("SET_SHARE requires explicit donor policy, sets exact aggregate percentage and never uses otherBallots", () => {
    const ids = ["A", "B", "C"];
    const election = makeElection(ids);
    const rows: BaseUnitResult[] = [{
      geoId: "47001", stateId: "47", eligibleVoters: null,
      votes: { A: 30, B: 50, C: 20 }, otherBallots: 25
    }];
    const higher = simulateElection(election, rows, withActions(share("A", 60, { kind: "explicit-donors", candidateIds: ["B"] })));
    expect(higher.national.votes).toEqual({ A: 60, B: 20, C: 20 });
    expect(higher.national.otherBallots).toBe(25);
    const lower = simulateElection(election, rows, withActions(share("A", 10, { kind: "proportional-other" })));
    expect(lower.national.votes).toEqual({ A: 10, B: 64, C: 26 });
    expect(lower.national.ballots).toBe(125);
    verifyInvariants(lower, ids);
    errorCode(() => simulateElection(election, rows, withActions(share("A", 90, { kind: "explicit-donors", candidateIds: ["C"] }))), "INSUFFICIENT_SUPPORT");
  });

  it("SET_SHARE allocates reduced target ballots to zero-support recipients without losing ballots", () => {
    const election = makeElection(["A", "B", "C"]);
    const rows: BaseUnitResult[] = [{
      geoId: "47001", stateId: "47", eligibleVoters: null, votes: { A: 5, B: 0, C: 0 }, otherBallots: 0
    }];
    const result = simulateElection(election, rows, withActions(share("A", 0, { kind: "proportional-other" })));
    expect(result.national.votes).toEqual({ A: 0, B: 3, C: 2 });
  });

  it("turnout changes the whole ballot denominator including otherBallots, and zero remains zero", () => {
    const election = makeElection(["A", "B"]);
    const rows: BaseUnitResult[] = [
      { geoId: "47001", stateId: "47", eligibleVoters: 20, votes: { A: 3, B: 2 }, otherBallots: 1 },
      { geoId: "47003", stateId: "47", eligibleVoters: 0, votes: { A: 0, B: 0 }, otherBallots: 0 }
    ];
    const result = simulateElection(election, rows, withActions(turnout(1.5)));
    expect(result.units[0]?.ballots).toBe(9);
    expect(result.units[0]?.votes).toEqual({ A: 5, B: 3 });
    expect(result.units[0]?.otherBallots).toBe(1);
    expect(result.units[1]?.ballots).toBe(0);
    const zero = simulateElection(election, rows, withActions(turnout(0)));
    expect(zero.national.ballots).toBe(0);
    expect(zero.national.winnerCandidateId).toBeNull();
    expect(zero.national.tie).toBe(false);
    errorCode(() => simulateElection(election, rows, withActions(turnout(4))), "TURNOUT_EXCEEDS_ELIGIBLE");
  });

  it("ties and all-zero candidate totals report no unique winner", () => {
    const election = makeElection(["A", "B", "C"]);
    const base = { geoId: "47001", stateId: "47", eligibleVoters: null, otherBallots: 8 };
    const tied = simulateElection(election, [{ ...base, votes: { A: 7, B: 7, C: 2 } }], empty());
    expect(tied.national.winnerCandidateId).toBeNull();
    expect(tied.national.tie).toBe(true);
    const zero = simulateElection(election, [{ ...base, votes: { A: 0, B: 0, C: 0 } }], empty());
    expect(zero.national.winnerCandidateId).toBeNull();
    expect(zero.national.tie).toBe(false);
    const winner = simulateElection(election, [{ ...base, votes: { A: 7, B: 7, C: 8 } }], empty());
    expect(winner.national.winnerCandidateId).toBe("C");
    expect(winner.national.tie).toBe(false);
  });

  it("validates historical input: unknown/duplicate IDs, unsafe vote numbers, and malformed scope", () => {
    const ids = ["A", "B"];
    const election = makeElection(ids);
    const rows = makeRows(ids);
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "absent", 0))), "UNKNOWN_CANDIDATE");
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", 5, { kind: "state", stateId: "88" }))), "UNKNOWN_GEO");
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", 5, { kind: "county", countyIds: ["47199"] }))), "UNKNOWN_GEO");
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", 5, { kind: "district", districtIds: ["1"], vintage: "2022" }))), "UNSUPPORTED_SCOPE");
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", 5, { kind: "precinct", precinctIds: ["x"], vintage: "2022" }))), "UNSUPPORTED_SCOPE");
    errorCode(() => simulateElection(election, [...rows, { ...rows[0]! }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, geoId: "4701" }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { A: 10, B: Number.NaN } }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { A: 10, B: Number.POSITIVE_INFINITY } }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { A: -1, B: 3 } }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { A: 1.5, B: 3 } }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, [{ ...rows[0]!, votes: { A: 1, B: 3, C: 4 } }], empty()), "INVALID_BASE_UNIT");
    errorCode(() => simulateElection(election, rows, { ...empty(), electionId: "other" }), "INVALID_SCENARIO");
    errorCode(() => simulateElection({ ...election, candidates: [election.candidates[0]!, election.candidates[0]!] }, rows, empty()), "INVALID_ELECTION");
  });

  it("rejects invalid adjustments/JSON, duplicate action IDs and unsafe aggregate overflow", () => {
    const election = makeElection(["A", "B"]);
    const rows = makeRows(["A", "B"]);
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", -1))), "INVALID_ACTION");
    errorCode(() => simulateElection(election, rows, withActions(transfer("A", "B", Number.NaN))), "INVALID_ACTION");
    errorCode(() => simulateElection(election, rows, withActions(share("A", 25, { kind: "explicit-donors", candidateIds: ["B", "B"] }))), "INVALID_ACTION");
    errorCode(() => simulateElection(election, rows, withActions(share("A", 25, { kind: "explicit-donors", candidateIds: ["absent"] }))), "UNKNOWN_CANDIDATE");
    errorCode(() => simulateElection(election, rows, withActions(share("A", 25, { kind: "explicit-donors", candidateIds: ["A"] }))), "INVALID_ACTION");
    errorCode(() => simulateElection(election, rows, withActions(turnout(-1))), "INVALID_ACTION");
    errorCode(() => simulateElection(election, rows, withActions(turnout(Number.POSITIVE_INFINITY))), "INVALID_ACTION");
    errorCode(() => appendAction(withActions(transfer("A", "B", 0)), transfer("A", "B", 1)), "INVALID_ACTION");
    errorCode(() => parseScenario("{"), "INVALID_SCENARIO");
    errorCode(() => parseScenario('{"schemaVersion":2,"electionId":"synthetic-2026","actions":[]}'), "INVALID_SCENARIO");
    errorCode(() => simulateElection(election, [
      { geoId: "47001", stateId: "47", eligibleVoters: null, votes: { A: Number.MAX_SAFE_INTEGER, B: 0 }, otherBallots: 0 },
      { geoId: "47003", stateId: "47", eligibleVoters: null, votes: { A: 1, B: 0 }, otherBallots: 0 }
    ], empty()), "INTEGER_OVERFLOW");
  });

  it("state controls affect only member counties, whereas national controls affect every county", () => {
    const ids = idsFor(3);
    const election = makeElection(ids);
    const rows = makeRows(ids);
    const baseline = simulateElection(election, rows, empty());
    const scoped = simulateElection(election, rows, withActions(turnout(1.25, { kind: "state", stateId: "47" })));
    expect(scoped.units.find(row => row.geoId === "01001")).toEqual(baseline.units.find(row => row.geoId === "01001"));
    expect(scoped.units.find(row => row.geoId === "47001")?.ballots).toBeGreaterThanOrEqual(baseline.units.find(row => row.geoId === "47001")!.ballots);
    verifyInvariants(scoped, ids);
    const nation = simulateElection(election, rows, withActions(turnout(1.25)));
    expect(nation.units.find(row => row.geoId === "01001")?.ballots).toBeGreaterThanOrEqual(scoped.units.find(row => row.geoId === "01001")!.ballots);
    verifyInvariants(nation, ids);
  });

  it("nontrivial multi-candidate arithmetic is invariant under candidate registry permutation and prototype-like IDs", () => {
    const ids = ["z", "__proto__", "constructor", "a", "10"];
    const election = makeElection(ids);
    const rows: BaseUnitResult[] = [
      { geoId: "47001", stateId: "47", eligibleVoters: null,
        votes: Object.fromEntries(ids.map((id, index) => [id, (index + 1) * 25])), otherBallots: 3 },
      { geoId: "47003", stateId: "47", eligibleVoters: null,
        votes: Object.fromEntries(ids.map((id, index) => [id, (index + 1) * 13])), otherBallots: 5 }
    ];
    const actions = withActions(
      transfer("z", "constructor", 3.25),
      share("__proto__", 29, { kind: "explicit-donors", candidateIds: ["a", "10", "constructor"] })
    );
    const expected = simulateElection(election, rows, actions);
    const reverse = [...ids].reverse();
    const revisedRows = rows.map(row => ({
      ...row, votes: Object.fromEntries(reverse.map(id => [id, row.votes[id]!]))
    })).reverse();
    expect(simulateElection(makeElection(reverse), revisedRows, actions)).toEqual(expected);
    verifyInvariants(expected, ids);
  });

  it("decimal-exponent percentages are stable and county sorted rounding is identical across repeated replays", () => {
    const election = makeElection(["A", "B"]);
    const rows: BaseUnitResult[] = [{ geoId: "47001", stateId: "47", eligibleVoters: null, votes: { A: 99, B: 1 }, otherBallots: 0 }];
    const actions = withActions(transfer("A", "B", 1e-7), turnout(0.01));
    const first = simulateElection(election, rows, actions);
    for (let i = 0; i < 30; i++) expect(simulateElection(election, rows, actions)).toEqual(first);
  });

  it("deterministic randomized invariant matrix (2/3/5/10 candidate sets, 60 seeds each)", () => {
    let seed = 719061;
    const random = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (const count of [2, 3, 5, 10]) {
      const ids = idsFor(count);
      const election = makeElection(ids);
      for (let repeat = 0; repeat < 60; repeat++) {
        const rows: BaseUnitResult[] = ["47001", "47003", "01001"].map(geoId => ({
          geoId, stateId: geoId.slice(0, 2), eligibleVoters: null, otherBallots: Math.floor(random() * 16),
          votes: Object.fromEntries(ids.map(id => [id, Math.floor(random() * 100)]))
        }));
        const target = ids[0]!;
        const source = ids[ids.length - 1]!;
        const baseline = simulateElection(election, rows, empty());
        const prior = rows.reduce((sum, row) => sum + row.votes[source]!, 0);
        const points = totalCandidates(baseline) > 0 ? Math.min(5, prior * 100 / totalCandidates(baseline)) : 0;
        // Avoid floating-decimal rounding crossing donor capacity when donor count is tiny.
        const adjusted = simulateElection(election, rows, withActions(transfer(source, target, points * 0.9)));
        expect(totalCandidates(adjusted)).toBe(totalCandidates(baseline));
        verifyInvariants(adjusted, ids);
        const shareAdjusted = simulateElection(election, rows, withActions(share(target, Math.floor(random() * 101), { kind: "proportional-other" })));
        expect(totalCandidates(shareAdjusted)).toBe(totalCandidates(baseline));
        verifyInvariants(shareAdjusted, ids);
        const scaled = simulateElection(election, rows, withActions(turnout([0, 0.5, 1, 1.25][repeat % 4]!)));
        verifyInvariants(scaled, ids);
        expect(simulateElection(election, rows, withActions(turnout([0, 0.5, 1, 1.25][repeat % 4]!)))).toEqual(scaled);
      }
    }
  });
});
