import { describe, it, expect } from "vitest";
import type { Adjustment, BaseUnitResult, Candidate, ElectionDefinition, Scenario } from "@votatlas/contracts";
import {
  addCandidate, appendAction, createScenarioProject, fingerprintSourceElection,
  MAX_SCENARIO_PROJECT_BYTES, parseScenario, parseScenarioProject,
  removeZeroVoteCandidate, renameCandidate, restoreScenarioProject,
  serializeScenario, serializeScenarioProject, simulateElection, SimulationError
} from "./index.js";
import { sha256Hex } from "./sha256.js";

const candidate = (id: string, index: number): Candidate =>
  ({ id, name: `Fictional ${id}`, color: "#AABBCC", ballotOrder: index });
const election = (count: number): ElectionDefinition => ({
  id: "tn-synthetic-v1", title: "Fictional Tennessee", office: "Synthetic",
  geographyVintage: "2020", dataStatus: "synthetic",
  candidates: Array.from({ length: count }, (_, i) => candidate(`id-${i}`, i))
});
const rows = (count: number, units = 95): BaseUnitResult[] => Array.from({ length: units }, (_, i) => ({
  geoId: `47${String(2 * i + 1).padStart(3, "0")}`, stateId: "47",
  eligibleVoters: null, otherBallots: i % 7,
  votes: Object.fromEntries(Array.from({ length: count }, (_, j) => [`id-${j}`, 20 + ((i * 37 + j * 13) % 109)]))
}));
const empty = (): Scenario => ({ schemaVersion: 1, electionId: "tn-synthetic-v1", actions: [] });
const share = (id: string, percent: number, suffix: string): Adjustment => ({
  id: suffix, type: "SET_SHARE", candidateId: id, targetPercent: percent,
  redistribution: { kind: "proportional-other" }, scope: { kind: "national" }
});
const transfer = (from: string, to: string, points: number, suffix: string): Adjustment => ({
  id: suffix, type: "TRANSFER_PP", fromCandidateId: from, toCandidateId: to,
  points, scope: { kind: "national" }
});
const turnout = (factor: number, suffix: string): Adjustment => ({
  id: suffix, type: "TURNOUT_SCALE", factor, allocation: "proportional-candidates",
  scope: { kind: "state", stateId: "47" }
});
function errorCode(fn: () => unknown, expected: string): void {
  try { fn(); throw new Error(`Expected ${expected}`); }
  catch (error) {
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).code).toBe(expected);
  }
}
function conservation(result: ReturnType<typeof simulateElection>): void {
  let ballots = 0;
  const totals = Object.fromEntries(Object.keys(result.national.votes).map(id => [id, 0]));
  for (const unit of result.units) {
    const sum = Object.values(unit.votes).reduce((a, b) => a + b, unit.otherBallots);
    expect(sum).toBe(unit.ballots);
    for (const [id, value] of Object.entries(unit.votes)) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      totals[id]! += value;
    }
    ballots += unit.ballots;
  }
  expect(result.national.ballots).toBe(ballots);
  expect(result.byState["47"]?.ballots).toBe(ballots);
  expect(result.national.votes).toEqual(totals);
}

function exportWithAdded(count: number, history = 0) {
  const source = election(count), sourceRows = rows(count);
  let current = { election: source, baseUnits: sourceRows, scenario: empty() };
  // Pre-existing proportional-other is frozen when the hypothetical candidate is added.
  current.scenario = appendAction(current.scenario, share("id-0", 35, "old"));
  const added = addCandidate(current.election, current.baseUnits, {
    id: "custom-99", name: "Fourth fictional", color: "#BF12AC", partyLabel: "Independent"
  }, current.scenario);
  current = { election: added.election, baseUnits: added.baseUnits, scenario: added.scenario! };
  current.election = renameCandidate(current.election, "id-0", "Changed original name");
  current.election = renameCandidate(current.election, "custom-99", "New hypothetical name");
  current.scenario = appendAction(current.scenario, share("custom-99", 12, "new-share"));
  for (let i = 0; i < history; i++) {
    // Candidate-target shares are always feasible; ultra-small turnout factors stay within safe limits.
    current.scenario = appendAction(current.scenario, i % 7 === 0 ? turnout(1.000001, `turnout-${i}`) :
      share(`id-${i % count}`, 10 + (i * 7 % 50), `share-${i}`));
  }
  return { source, sourceRows, current };
}

describe("portable v2 scenario project", () => {
  it("SHA-256 matches standard vectors (including UTF-8) without Node crypto", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("hello world")).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  for (const count of [2, 3, 5, 10]) {
    it(`replays v2 custom candidate, edited base label, source provenance on 95 counties from ${count} originals`, () => {
      const { source, sourceRows, current } = exportWithAdded(count, 20);
      const snapshot = JSON.stringify({ source, sourceRows, current });
      const original = simulateElection(current.election, current.baseUnits, current.scenario);
      const project = createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario);
      expect(project.schemaVersion).toBe(2);
      expect(project.registry.additions).toHaveLength(1);
      expect(project.registry.overrides).toHaveLength(1);
      expect(project.source.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
      const encoded = serializeScenarioProject(project);
      expect(encoded).not.toContain('"units"');
      expect(encoded).not.toContain('"otherBallots"');
      const parsed = parseScenarioProject(encoded);
      expect(parsed).toEqual(project);
      const restored = restoreScenarioProject(encoded, source, sourceRows);
      expect(restored.election).toEqual(current.election);
      expect(restored.scenario).toEqual(current.scenario);
      expect(JSON.stringify(restored.result)).toBe(JSON.stringify(original));
      expect(serializeScenarioProject(project)).toBe(serializeScenarioProject(parsed as typeof project));
      expect(JSON.stringify({ source, sourceRows, current })).toBe(snapshot);
      conservation(restored.result);
      const reset = simulateElection(restored.election, restored.baseUnits, empty());
      const baseline = simulateElection(source, sourceRows, empty());
      expect(reset.national.ballots).toBe(baseline.national.ballots);
      expect(reset.national.votes["custom-99"]).toBe(0);
    });
  }

  it("supports 3 -> 4 -> 5 -> 10 custom candidates without losing original county votes", () => {
    const source = election(3), sourceRows = rows(3);
    let current = { election: source, baseUnits: sourceRows, scenario: empty() };
    for (let i = 3; i < 10; i++) {
      const added = addCandidate(current.election, current.baseUnits, candidate(`future-${i}`, i), current.scenario);
      current = { election: added.election, baseUnits: added.baseUnits, scenario: added.scenario! };
    }
    current.scenario = appendAction(current.scenario, share("future-9", 19, "c10"));
    const restored = restoreScenarioProject(
      serializeScenarioProject(createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario)),
      source, sourceRows
    );
    expect(restored.election.candidates).toHaveLength(10);
    expect(restored.result).toEqual(simulateElection(current.election, current.baseUnits, current.scenario));
    conservation(restored.result);
  });

  it("does not retroactively change proportional redistribution from before candidate addition", () => {
    const source = election(2);
    const sourceRows = [{ geoId: "47001", stateId: "47", eligibleVoters: null,
      votes: { "id-0": 0, "id-1": 10 }, otherBallots: 0 }];
    const before = { ...empty(), actions: [share("id-0", 50, "old-share")] };
    const extended = addCandidate(source, sourceRows, candidate("future", 2), before);
    expect(extended.scenario?.actions[0]).toMatchObject({
      redistribution: { kind: "explicit-donors", candidateIds: ["id-1"] }
    });
    const scenario = appendAction(extended.scenario!, share("future", 20, "new-share"));
    const raw = serializeScenarioProject(createScenarioProject(source, sourceRows, extended.election, extended.baseUnits, scenario));
    const reopened = restoreScenarioProject(raw, source, sourceRows);
    expect(reopened.result.national.votes).toEqual(simulateElection(extended.election, extended.baseUnits, scenario).national.votes);
    expect(reopened.scenario.actions[0]).toEqual(extended.scenario?.actions[0]);
  });

  it("provides v1 backward import without changing original v1 exports", () => {
    const source = election(3), sourceRows = rows(3);
    const previous = { ...empty(), actions: [share("id-0", 17, "legacy-share")] };
    const json = serializeScenario(previous);
    expect(parseScenarioProject(json)).toEqual(parseScenario(json));
    const restored = restoreScenarioProject(json, source, sourceRows);
    expect(restored.scenario).toEqual(previous);
    expect(restored.election).toEqual(source);
    expect(restored.result).toEqual(simulateElection(source, sourceRows, previous));
    errorCode(() => restoreScenarioProject(json, { ...source, id: "different" }, sourceRows), "SOURCE_MISMATCH");
  });

  it("strictly detects changed source votes, turnout bounds, metadata, status, and geography vintage", () => {
    const { source, sourceRows, current } = exportWithAdded(3);
    const json = serializeScenarioProject(createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario));
    const modified = structuredClone(sourceRows);
    modified[0]!.votes["id-0"]! += 1;
    errorCode(() => restoreScenarioProject(json, source, modified), "SOURCE_MISMATCH");
    const eligible = structuredClone(sourceRows);
    eligible[0]!.eligibleVoters = 99999;
    errorCode(() => restoreScenarioProject(json, source, eligible), "SOURCE_MISMATCH");
    errorCode(() => restoreScenarioProject(json, { ...source, geographyVintage: "2022" }, sourceRows), "SOURCE_MISMATCH");
    errorCode(() => restoreScenarioProject(json, { ...source, dataStatus: "official" }, sourceRows), "SOURCE_MISMATCH");
    errorCode(() => restoreScenarioProject(json, { ...source, title: "Modified source title" }, sourceRows), "SOURCE_MISMATCH");
    const sameRowsReversed = [...sourceRows].reverse().map(row => ({ ...row, votes: Object.fromEntries(Object.entries(row.votes).reverse()) }));
    const reversedSource = { ...source, candidates: [...source.candidates].reverse() };
    expect(fingerprintSourceElection(reversedSource, sameRowsReversed)).toBe(fingerprintSourceElection(source, sourceRows));
  });

  it("rejects corrupt IDs, invalid registries, unexpected fields, forged overrides, and modified working baseline", () => {
    const { source, sourceRows, current } = exportWithAdded(3);
    const base = createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario);
    const mutate = (f: (p: typeof base) => void) => { const p = structuredClone(base); f(p); return JSON.stringify(p); };
    errorCode(() => parseScenarioProject(mutate(p => { p.registry.additions[0]!.id = "__proto__"; })), "RESERVED_CANDIDATE_ID");
    errorCode(() => parseScenarioProject(mutate(p => { p.registry.additions[0]!.id = "evil<script>"; })), "INVALID_CANDIDATE");
    errorCode(() => parseScenarioProject(mutate(p => { p.registry.additions[0]!.color = "url(javascript:evil)"; })), "INVALID_CANDIDATE");
    errorCode(() => parseScenarioProject(mutate(p => { p.registry.additions.push({ ...p.registry.additions[0]! }); })), "INVALID_PROJECT");
    errorCode(() => parseScenarioProject(mutate(p => { p.source.digest = "sha256:faked"; })), "INVALID_PROJECT");
    errorCode(() => parseScenarioProject(mutate(p => { (p as any).units = sourceRows; })), "INVALID_PROJECT");
    errorCode(() => restoreScenarioProject(mutate(p => { p.registry.overrides[0]!.ballotOrder = 55; }), source, sourceRows), "INVALID_PROJECT");
    errorCode(() => restoreScenarioProject(mutate(p => { p.registry.candidateOrder = ["id-0"]; }), source, sourceRows), "INVALID_PROJECT");
    const forgedWorking = structuredClone(current.baseUnits);
    forgedWorking[0]!.votes["id-1"]! += 2;
    errorCode(() => createScenarioProject(source, sourceRows, current.election, forgedWorking, current.scenario), "SOURCE_MISMATCH");
    const incomplete = { ...current.election, candidates: current.election.candidates.slice(1) };
    errorCode(() => createScenarioProject(source, sourceRows, incomplete, current.baseUnits, current.scenario), "INVALID_PROJECT");
  });

  it("refuses future versions, malformed imports, oversize JSON, and excessive actions", () => {
    const { source, sourceRows, current } = exportWithAdded(3);
    const project = createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario);
    errorCode(() => parseScenarioProject(JSON.stringify({ ...project, schemaVersion: 3 })), "UNSUPPORTED_PROJECT_VERSION");
    errorCode(() => parseScenarioProject("{"), "INVALID_PROJECT");
    errorCode(() => parseScenarioProject("x".repeat(MAX_SCENARIO_PROJECT_BYTES + 1)), "PROJECT_TOO_LARGE");
    const bloated = { ...project, scenario: { ...project.scenario,
      actions: Array.from({ length: 2501 }, (_, i) => turnout(1, `t-${i}`)) } };
    errorCode(() => parseScenarioProject(JSON.stringify(bloated)), "INVALID_PROJECT");
  });

  it("rejects removing candidates who gain votes or participate in history, permits safe turnout-only removal", () => {
    const source = election(3), sourceRows = rows(3, 3);
    const ext = addCandidate(source, sourceRows, candidate("future", 3));
    const scenario = empty();
    errorCode(() => removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", undefined as unknown as Scenario), "INVALID_SCENARIO");
    const withVotes = { ...scenario, actions: [share("future", 25, "add-votes")] };
    errorCode(() => removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", withVotes), "CANDIDATE_HAS_VOTES");
    const reference = { ...scenario, actions: [transfer("future", "id-0", 0, "zero-ref")] };
    errorCode(() => removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", reference), "CANDIDATE_IN_ACTIVE_HISTORY");
    const implicit = { ...scenario, actions: [share("id-1", 40, "implicit-donors")] };
    errorCode(() => removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", implicit), "CANDIDATE_IN_ACTIVE_HISTORY");
    const noFinalVotesButHistoricalReference = { ...scenario, actions: [share("future", 25, "gain"), share("future", 0, "lose")] };
    errorCode(() => removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", noFinalVotesButHistoricalReference), "CANDIDATE_IN_ACTIVE_HISTORY");
    const restored = removeZeroVoteCandidate(ext.election, ext.baseUnits, "future", {
      ...scenario, actions: [turnout(1.1, "safe-turnout")]
    });
    expect(restored.election).toEqual(source);
    expect(restored.baseUnits).toEqual(sourceRows);
    expect(restored.scenario?.actions).toHaveLength(1);
  });

  it("preserves 160 ordered actions and exact results across 95 counties with the original source untouched", () => {
    const { source, sourceRows, current } = exportWithAdded(5, 160);
    const before = JSON.stringify({ source, sourceRows, current });
    const result = simulateElection(current.election, current.baseUnits, current.scenario);
    const encoded = serializeScenarioProject(createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario));
    const restored = restoreScenarioProject(encoded, source, sourceRows);
    expect(JSON.stringify(restored.result)).toBe(JSON.stringify(result));
    expect(restored.scenario.actions).toHaveLength(162);
    conservation(restored.result);
    expect(JSON.stringify({ source, sourceRows, current })).toBe(before);
  });

  it("rejects an operation whose percentage was corrupted after export", () => {
    const { source, sourceRows, current } = exportWithAdded(2);
    const project = createScenarioProject(source, sourceRows, current.election, current.baseUnits, current.scenario);
    project.scenario.actions[0] = { ...project.scenario.actions[0]!, id: "old", type: "TURNOUT_SCALE", factor: -1, allocation: "proportional-candidates", scope: { kind: "national" } };
    errorCode(() => restoreScenarioProject(project, source, sourceRows), "INVALID_ACTION");
  });
});
