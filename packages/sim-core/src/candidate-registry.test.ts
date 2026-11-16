import { describe, expect, it } from "vitest";
import type { Adjustment, BaseUnitResult, Candidate, ElectionDefinition, Scenario } from "@votatlas/contracts";
import {
  addCandidate, appendAction, parseScenario, removeZeroVoteCandidate,
  renameCandidate, serializeScenario, simulateElection, SimulationError, undoLastAction
} from "./index.js";

const candidate = (id: string, ballotOrder: number): Candidate =>
  ({ id, name: `Fictional ${id}`, ballotOrder, color: "#AABBCC" });
const election = (count: number): ElectionDefinition => ({
  id: "tn-fictional", title: "Synthetic", office: "Test", geographyVintage: "2020", dataStatus: "synthetic",
  candidates: Array.from({ length: count }, (_, i) => candidate(`id-${i}`, i))
});
const rows = (count: number, units = 95): BaseUnitResult[] =>
  Array.from({ length: units }, (_, i) => ({
    geoId: `47${String(2 * i + 1).padStart(3, "0")}`,
    stateId: "47", eligibleVoters: null, otherBallots: i % 9,
    votes: Object.fromEntries(Array.from({ length: count }, (_, j) => [`id-${j}`, 10 + (i * 19 + j * 7) % 97]))
  }));
const empty = (): Scenario => ({ schemaVersion: 1, electionId: "tn-fictional", actions: [] });
const share = (id: string, percent: number, actionId: string, scope: Adjustment["scope"] = { kind: "national" }): Adjustment => ({
  type: "SET_SHARE", id: actionId, candidateId: id, targetPercent: percent, scope,
  redistribution: { kind: "proportional-other" }
});
const transfer = (from: string, to: string, points: number, actionId: string, scope: Adjustment["scope"] = { kind: "national" }): Adjustment => ({
  type: "TRANSFER_PP", id: actionId, scope, fromCandidateId: from, toCandidateId: to, points
});
const turnout = (factor: number, actionId: string, scope: Adjustment["scope"] = { kind: "national" }): Adjustment => ({
  type: "TURNOUT_SCALE", id: actionId, scope, factor, allocation: "proportional-candidates"
});
function code(fn: () => unknown, expected: string): void {
  try { fn(); throw new Error(`Expected ${expected}`); }
  catch (e) { expect(e).toBeInstanceOf(SimulationError); expect((e as SimulationError).code).toBe(expected); }
}
function checkConservation(result: ReturnType<typeof simulateElection>, candidateIds: readonly string[]): void {
  let total = 0;
  for (const unit of result.units) {
    expect(Object.keys(unit.votes).sort()).toEqual([...candidateIds].sort());
    for (const id of candidateIds) {
      expect(Number.isSafeInteger(unit.votes[id])).toBe(true);
      expect(unit.votes[id]).toBeGreaterThanOrEqual(0);
    }
    const count = candidateIds.reduce((sum, id) => sum + unit.votes[id]!, unit.otherBallots);
    expect(unit.ballots).toBe(count);
    total += unit.ballots;
  }
  expect(result.national.ballots).toBe(total);
  expect(result.byState["47"]?.ballots).toBe(total);
  for (const id of candidateIds) {
    const sum = result.units.reduce((n, unit) => n + unit.votes[id]!, 0);
    expect(result.national.votes[id]).toBe(sum);
    expect(result.byState["47"]?.votes[id]).toBe(sum);
  }
}

describe("candidate-registry first-class sandbox operations", () => {
  for (const count of [2, 3, 5, 10]) {
    it(`adds candidate to ${count}-candidate registry preserving exact original baseline and all input objects`, () => {
      const before = election(count);
      const base = rows(count);
      const snapshot = JSON.stringify({ before, base });
      const original = simulateElection(before, base, empty());
      const added = addCandidate(before, base, { id: "new-future", name: "New Future", color: "#CC0055" });
      expect(JSON.stringify({ before, base })).toBe(snapshot);
      expect(added.election).not.toBe(before);
      expect(added.baseUnits).not.toBe(base);
      expect(added.election.candidates).toHaveLength(count + 1);
      expect(added.election.candidates[count]?.ballotOrder).toBe(count);
      const result = simulateElection(added.election, added.baseUnits, empty());
      for (const unit of result.units) {
        const prior = original.units.find(row => row.geoId === unit.geoId)!;
        expect(unit.votes["new-future"]).toBe(0);
        for (const c of before.candidates) expect(unit.votes[c.id]).toBe(prior.votes[c.id]);
        expect(unit.ballots).toBe(prior.ballots);
      }
      checkConservation(result, [...before.candidates.map(c => c.id), "new-future"]);
    });
  }

  it("supports 3 -> 4 -> 5 and 5 -> 10 candidate additions, then explicit transfer and share", () => {
    for (const [starting, ending] of [[3, 5], [5, 10]] as const) {
      let pair = { election: election(starting), baseUnits: rows(starting) };
      const initial = simulateElection(pair.election, pair.baseUnits, empty());
      for (let index = starting; index < ending; index++) {
        pair = addCandidate(pair.election, pair.baseUnits, {
          id: `id-${index}`, name: `Future candidate ${index}`, color: "#ABCDEF"
        });
      }
      const expanded = simulateElection(pair.election, pair.baseUnits, empty());
      expect(expanded.national.ballots).toBe(initial.national.ballots);
      const ids = pair.election.candidates.map(c => c.id);
      const scenario = { ...empty(), actions: [
        share(ids[ending - 1]!, 12, "first-share"),
        transfer(ids[0]!, ids[ending - 2]!, 1, "next-transfer")
      ] };
      const result = simulateElection(pair.election, pair.baseUnits, scenario);
      expect(result.national.votes[ids[ending - 1]!]).toBeGreaterThan(0);
      checkConservation(result, ids);
      expect(simulateElection(pair.election, pair.baseUnits, parseScenario(serializeScenario(scenario)))).toEqual(result);
    }
  });

  it("rejects duplicate and reserved IDs, malformed metadata, order collisions and overflow", () => {
    const e = election(3), b = rows(3, 2);
    code(() => addCandidate(e, b, { ...candidate("id-0", 4) }), "DUPLICATE_CANDIDATE");
    for (const id of ["__proto__", "constructor", "prototype", "toString"]) {
      code(() => addCandidate(e, b, { ...candidate(id, 4) }), "RESERVED_CANDIDATE_ID");
    }
    code(() => addCandidate(e, b, { ...candidate("id-4", 1) }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, b, { ...candidate("id-4", -1) }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, b, { ...candidate("id-4", Number.MAX_SAFE_INTEGER + 1) }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, b, { ...candidate("id-4", 4), name: " " }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, b, { ...candidate("id-4", 4), color: "url(evil)" }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, b, { ...candidate("id-4", 4), partyLabel: "" }), "INVALID_CANDIDATE");
    const max = { ...e, candidates: e.candidates.map((c, i) => ({ ...c, ballotOrder: i === 2 ? Number.MAX_SAFE_INTEGER : i })) };
    code(() => addCandidate(max, b, { id: "id-4", name: "Fiction", color: "#123456" }), "INTEGER_OVERFLOW");
    const malformed = { ...e, candidates: e.candidates.map((c, i) => ({ ...c, ballotOrder: i === 1 ? 0 : c.ballotOrder })) };
    code(() => addCandidate(malformed, b, { ...candidate("id-4", 4) }), "INVALID_CANDIDATE");
    code(() => addCandidate(e, [{ ...b[0]!, votes: { "id-0": 1 } }], { ...candidate("id-4", 4) }), "INVALID_BASE_UNIT");
  });

  it("rename retains ID and exact mathematics; removal rejects stranded votes and supports reversibility when zero", () => {
    const e = election(3), b = rows(3, 3);
    const expanded = addCandidate(e, b, { ...candidate("future", 3) });
    const renamed = renameCandidate(expanded.election, "future", "Renamed Future");
    expect(renamed.candidates.find(c => c.id === "future")?.name).toBe("Renamed Future");
    expect(expanded.election.candidates.find(c => c.id === "future")?.name).toBe("Fictional future");
    expect(simulateElection(renamed, expanded.baseUnits, empty())).toEqual(simulateElection(expanded.election, expanded.baseUnits, empty()));
    code(() => renameCandidate(expanded.election, "missing", "Test"), "UNKNOWN_CANDIDATE");
    code(() => removeZeroVoteCandidate(e, b, "id-0", empty()), "CANDIDATE_HAS_VOTES");
    const restored = removeZeroVoteCandidate(renamed, expanded.baseUnits, "future", empty());
    expect(restored.election).toEqual(e);
    expect(restored.baseUnits).toEqual(b);
    code(() => removeZeroVoteCandidate(e, b, "missing", empty()), "UNKNOWN_CANDIDATE");
    code(() => removeZeroVoteCandidate(election(1), rows(1, 1).map(r => ({ ...r, votes: { "id-0": 0 } })), "id-0", empty()), "INVALID_CANDIDATE");
  });

  it("candidate addition after non-empty scenario requires explicit replay against extended baseline", () => {
    const e = election(3), b = rows(3, 3);
    const before = { ...empty(), actions: [share("id-2", 55, "share-first")] };
    const original = simulateElection(e, b, before);
    const extended = addCandidate(e, b, { ...candidate("future", 3) });
    const replay = simulateElection(extended.election, extended.baseUnits, before);
    for (const unit of replay.units) expect(unit.votes.future).toBe(0);
    expect(replay.national.ballots).toBe(original.national.ballots);
    // A zero-vote new candidate is eligible to receive votes via SET_SHARE as a later action.
    const subsequent = appendAction(before, share("future", 18, "share-second"));
    const result = simulateElection(extended.election, extended.baseUnits, subsequent);
    expect(result.national.votes.future).toBeGreaterThan(0);
    checkConservation(result, extended.election.candidates.map(c => c.id));
    expect(simulateElection(extended.election, extended.baseUnits, undoLastAction(subsequent))).toEqual(replay);
    expect(simulateElection(extended.election, extended.baseUnits, empty()).national.ballots).toBe(original.national.ballots);
  });

  it("95-county seeded 30-step replay with candidate order/label invariance and exact reset (2/3/5/10)", () => {
    for (const count of [2, 3, 5, 10]) {
      const e = election(count), b = rows(count);
      const extension = addCandidate(e, b, { ...candidate("hypothetical", count) });
      const ids = extension.election.candidates.map(c => c.id);
      let scenario = empty();
      for (let i = 0; i < 30; i++) {
        const scope: Adjustment["scope"] = i % 3 === 0 ? { kind: "county", countyIds: ["47001", "47003", "47005"] } : { kind: "national" };
        const action = i % 5 === 0 ? turnout(1.001, `turnout-${i}`, scope) :
          share(ids[i % ids.length]!, 5 + (i * 11 % 30), `share-${i}`, scope);
        scenario = appendAction(scenario, action);
      }
      const first = simulateElection(extension.election, extension.baseUnits, scenario);
      const second = simulateElection(extension.election, extension.baseUnits, parseScenario(serializeScenario(scenario)));
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      checkConservation(first, ids);
      const reversed = {
        ...extension.election,
        candidates: [...extension.election.candidates].reverse().map(c => ({ ...c, name: `${c.name} renamed`, partyLabel: "Unaligned" }))
      };
      const reversedRows = [...extension.baseUnits].reverse().map(row => ({ ...row, votes: Object.fromEntries([...ids].reverse().map(id => [id, row.votes[id]!])) }));
      expect(simulateElection(reversed, reversedRows, scenario)).toEqual(first);
      const baseline = simulateElection(extension.election, extension.baseUnits, empty());
      expect(simulateElection(extension.election, extension.baseUnits, empty())).toEqual(baseline);
      for (const unit of baseline.units) {
        const historic = b.find(r => r.geoId === unit.geoId)!;
        for (const id of e.candidates.map(c => c.id)) expect(unit.votes[id]).toBe(historic.votes[id]);
      }
    }
  });

  it("freezes prior proportional-other donor sets so candidate addition cannot rewrite earlier scenario results", () => {
    const e = election(2);
    const b: BaseUnitResult[] = [{ geoId: "47001", stateId: "47", eligibleVoters: null,
      votes: { "id-0": 10, "id-1": 0 }, otherBallots: 2 }];
    const previous = { ...empty(), actions: [share("id-0", 50, "historic-share")] };
    const old = simulateElection(e, b, previous);
    expect(old.national.votes).toEqual({ "id-0": 5, "id-1": 5 });
    const extended = addCandidate(e, b, { ...candidate("future", 2) }, previous);
    expect(extended.scenario?.actions[0]).toEqual({
      ...previous.actions[0]!, redistribution: { kind: "explicit-donors", candidateIds: ["id-1"] }
    });
    const replay = simulateElection(extended.election, extended.baseUnits, extended.scenario!);
    expect(replay.national.votes).toEqual({ "future": 0, "id-0": 5, "id-1": 5 });
    expect(replay.national.ballots).toBe(old.national.ballots);
    expect(simulateElection(extended.election, extended.baseUnits, parseScenario(serializeScenario(extended.scenario!)))).toEqual(replay);
    const later = appendAction(extended.scenario!, share("future", 20, "fresh-share"));
    const after = simulateElection(extended.election, extended.baseUnits, later);
    expect(after.national.votes.future).toBe(2);
    checkConservation(after, ["id-0", "id-1", "future"]);
    expect(previous.actions[0]).toEqual(share("id-0", 50, "historic-share"));
  });

  it("220 ordered actions across 95 counties conserve ballots under replay, and operation ordering matters", () => {
    const e = election(5), b = rows(5);
    const baselineSnapshot = JSON.stringify({ e, b });
    const scope = { kind: "state" as const, stateId: "47" };
    let scenario = empty();
    for (let i = 0; i < 220; i++) {
      const op = i % 3 === 0 ? turnout(1.0001, `turnout-${i}`, scope) :
        i % 3 === 1 ? transfer("id-0", "id-1", 0.005, `transfer-${i}`, scope) :
        share(`id-${i % 5}`, 12 + (i % 23), `share-${i}`, scope);
      scenario = appendAction(scenario, op);
    }
    const first = simulateElection(e, b, scenario);
    checkConservation(first, e.candidates.map(c => c.id));
    const imported = parseScenario(serializeScenario(scenario));
    expect(JSON.stringify(first)).toBe(JSON.stringify(simulateElection(e, b, imported)));
    expect(JSON.stringify({ e, b })).toBe(baselineSnapshot);
    const starting = simulateElection(e, b, empty());
    expect(simulateElection(e, b, empty())).toEqual(starting);
    const left = simulateElection(e, b, { ...empty(), actions: [
      share("id-0", 17, "a"), transfer("id-0", "id-1", 2, "b")
    ] });
    const right = simulateElection(e, b, { ...empty(), actions: [
      transfer("id-0", "id-1", 2, "b"), share("id-0", 17, "a")
    ] });
    expect(left.national.votes["id-0"]).not.toBe(right.national.votes["id-0"]);
  });

  it("turnout at zero is absorbing, and impossible next-step transfers fail without mutating inputs", () => {
    const e = election(3), b = rows(3, 3);
    const scenario = { ...empty(), actions: [turnout(0, "zero"), turnout(15, "reopen")] };
    const baseline = JSON.stringify(b);
    const result = simulateElection(e, b, scenario);
    expect(result.national.ballots).toBe(0);
    const zeroBallotTransfer = simulateElection(e, b, { ...scenario, actions: [...scenario.actions, transfer("id-0", "id-1", 20, "zero-transfer")] });
    expect(zeroBallotTransfer).toEqual(result);
    const added = addCandidate(e, b, { ...candidate("future", 3) });
    code(() => simulateElection(added.election, added.baseUnits, { ...empty(), actions: [transfer("future", "id-0", 20, "impossible")] }), "INSUFFICIENT_SUPPORT");
    expect(JSON.stringify(b)).toBe(baseline);
  });
});
