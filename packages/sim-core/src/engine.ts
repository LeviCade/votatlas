import type {
  Adjustment, BaseUnitResult, CandidateId, ElectionDefinition, GeoScope,
  Redistribution, ResultTotals, Scenario, SimulationResult, UnitResult
} from "@votatlas/contracts";

export type SimulationErrorCode =
  | "INVALID_ELECTION" | "INVALID_BASE_UNIT" | "INVALID_SCENARIO"
  | "INVALID_ACTION" | "UNKNOWN_CANDIDATE" | "UNKNOWN_GEO"
  | "UNSUPPORTED_SCOPE" | "INSUFFICIENT_SUPPORT"
  | "TURNOUT_EXCEEDS_ELIGIBLE" | "INTEGER_OVERFLOW"
  | "INVALID_CANDIDATE" | "DUPLICATE_CANDIDATE"
  | "RESERVED_CANDIDATE_ID" | "CANDIDATE_HAS_VOTES";

/** Expected input and model failures are errors with stable, machine-readable codes. */
export class SimulationError extends Error {
  readonly name = "SimulationError";
  constructor(readonly code: SimulationErrorCode, message: string) {
    super(message);
  }
}

type Row = UnitResult;
type UnknownObject = Record<string, unknown>;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function fail(code: SimulationErrorCode, detail: string): never { throw new SimulationError(code, detail); }
const isRecord = (value: unknown): value is UnknownObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function stringField(value: unknown, label: string, code: SimulationErrorCode): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(code, `${label} must be a nonempty string`);
  return value;
}

function nonnegativeInteger(value: unknown, label: string, code: SimulationErrorCode): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a nonnegative safe integer`);
  }
  return value;
}

function finiteRange(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail("INVALID_ACTION", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}

function safeNumber(value: bigint, context: string): number {
  if (value < 0n || value > MAX_SAFE) fail("INTEGER_OVERFLOW", `${context} exceeds the safe integer range`);
  return Number(value);
}

function add(a: number, b: number, context: string): number {
  return safeNumber(BigInt(a) + BigInt(b), context);
}

/** Convert finite JS decimal notation (including exponent notation) into an exact decimal rational. */
function decimalFraction(value: number): [bigint, bigint] {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(value.toString());
  if (!match) fail("INVALID_ACTION", "Expected a finite nonnegative decimal");
  const [, whole = "0", fractional = "", exponent = "0"] = match;
  const digits = BigInt(whole + fractional);
  const power = Number(exponent) - fractional.length;
  return power >= 0 ? [digits * 10n ** BigInt(power), 1n] : [digits, 10n ** BigInt(-power)];
}

/** Half-up rounding is deterministic even when integer products exceed IEEE-754 precision. */
function roundProduct(total: number, multiplier: number, divisor = 1): number {
  const [numerator, denominator] = decimalFraction(multiplier);
  const scaled = BigInt(total) * numerator;
  const base = BigInt(divisor) * denominator;
  return safeNumber((scaled * 2n + base) / (2n * base), "Rounded ballot count");
}

/**
 * Largest remainder / Hamilton allocation.
 * Callers provide weights in canonical tie-break order (geoId, then candidateId).
 * Zero-weight fallback is permitted only for recipients that can receive new ballots.
 */
function allocate(total: number, inputWeights: readonly number[], equalWhenZero = false): number[] {
  if (inputWeights.length === 0) {
    if (total !== 0) fail("INSUFFICIENT_SUPPORT", "No eligible allocation recipients");
    return [];
  }
  if (total === 0) return inputWeights.map(() => 0);
  const weights = inputWeights.map(v => BigInt(v));
  let weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightTotal === 0n) {
    if (!equalWhenZero) fail("INSUFFICIENT_SUPPORT", "No support available for allocation");
    weights.fill(1n);
    weightTotal = BigInt(weights.length);
  }
  const target = BigInt(total);
  const floors = weights.map(weight => (target * weight) / weightTotal);
  const remainders = weights.map(weight => (target * weight) % weightTotal);
  const leftover = safeNumber(target - floors.reduce((sum, value) => sum + value, 0n), "Allocation remainder");
  const order = weights.map((_, index) => index).sort((a, b) => {
    const left = remainders[a]!;
    const right = remainders[b]!;
    return left === right ? a - b : left > right ? -1 : 1;
  });
  for (let i = 0; i < leftover; i++) floors[order[i]!]! += 1n;
  return floors.map(value => safeNumber(value, "Allocated votes"));
}

function validateElection(election: ElectionDefinition): string[] {
  if (!isRecord(election)) fail("INVALID_ELECTION", "Election must be an object");
  stringField(election.id, "election.id", "INVALID_ELECTION");
  stringField(election.geographyVintage, "election.geographyVintage", "INVALID_ELECTION");
  if (!["official", "estimated", "synthetic"].includes(election.dataStatus)) {
    fail("INVALID_ELECTION", "Unknown election dataStatus");
  }
  if (!Array.isArray(election.candidates) || election.candidates.length === 0) {
    fail("INVALID_ELECTION", "Election requires at least one candidate");
  }
  const ids = new Set<string>();
  for (const candidate of election.candidates) {
    if (!isRecord(candidate)) fail("INVALID_ELECTION", "Invalid candidate registry entry");
    const id = stringField(candidate.id, "candidate.id", "INVALID_ELECTION");
    if (ids.has(id)) fail("INVALID_ELECTION", `Duplicate candidate ID: ${id}`);
    ids.add(id);
  }
  return [...ids].sort();
}

function cloneRows(baseUnits: readonly BaseUnitResult[], ids: readonly string[]): Row[] {
  if (!Array.isArray(baseUnits) || baseUnits.length === 0) {
    fail("INVALID_BASE_UNIT", "At least one atomic county is required");
  }
  const known = new Set<string>();
  const rows: Row[] = [];
  for (const base of baseUnits) {
    if (!isRecord(base)) fail("INVALID_BASE_UNIT", "County must be an object");
    const geoId = stringField(base.geoId, "geoId", "INVALID_BASE_UNIT");
    const stateId = stringField(base.stateId, "stateId", "INVALID_BASE_UNIT");
    if (!/^\d{5}$/.test(geoId) || !/^\d{2}$/.test(stateId) || geoId.slice(0, 2) !== stateId) {
      fail("INVALID_BASE_UNIT", `Invalid county FIPS/state pairing: ${geoId}/${stateId}`);
    }
    if (known.has(geoId)) fail("INVALID_BASE_UNIT", `Duplicate county GEOID: ${geoId}`);
    known.add(geoId);
    const sourceVotes: unknown = base.votes;
    if (!isRecord(sourceVotes)) fail("INVALID_BASE_UNIT", `${geoId}: missing candidate votes`);
    const keys = Object.keys(sourceVotes);
    if (keys.length !== ids.length || keys.some(key => !ids.includes(key))) {
      fail("INVALID_BASE_UNIT", `${geoId}: candidate vote keys must match election registry exactly`);
    }
    const votes: Record<CandidateId, number> = Object.fromEntries(ids.map(id => [
      id, nonnegativeInteger(sourceVotes[id], `${geoId}.votes[${id}]`, "INVALID_BASE_UNIT")
    ]));
    const otherBallots = nonnegativeInteger(base.otherBallots, `${geoId}.otherBallots`, "INVALID_BASE_UNIT");
    const eligibleVoters = base.eligibleVoters === null ? null :
      nonnegativeInteger(base.eligibleVoters, `${geoId}.eligibleVoters`, "INVALID_BASE_UNIT");
    let ballots = otherBallots;
    for (const id of ids) ballots = add(ballots, votes[id]!, `${geoId} ballot total`);
    if (eligibleVoters !== null && ballots > eligibleVoters) {
      fail("INVALID_BASE_UNIT", `${geoId}: baseline ballots exceed eligibleVoters`);
    }
    rows.push({ geoId, stateId, eligibleVoters, votes, otherBallots, ballots });
  }
  return rows.sort((a, b) => a.geoId.localeCompare(b.geoId, "en"));
}

function normalizeScope(raw: unknown): GeoScope {
  if (!isRecord(raw)) fail("INVALID_ACTION", "Action scope must be an object");
  switch (raw.kind) {
    case "national": return { kind: "national" };
    case "state": return { kind: "state", stateId: stringField(raw.stateId, "scope.stateId", "INVALID_ACTION") };
    case "county": {
      if (!Array.isArray(raw.countyIds) || raw.countyIds.length === 0) {
        fail("INVALID_ACTION", "county scope requires nonempty countyIds");
      }
      const countyIds = raw.countyIds.map(id => stringField(id, "scope.countyIds[]", "INVALID_ACTION"));
      if (new Set(countyIds).size !== countyIds.length) fail("INVALID_ACTION", "Duplicate county in scope");
      return { kind: "county", countyIds: countyIds.sort() };
    }
    case "district":
    case "precinct":
      fail("UNSUPPORTED_SCOPE", `${raw.kind} requires vintage-specific atomic crosswalks`);
    default: fail("INVALID_ACTION", `Unknown scope kind: ${String(raw.kind)}`);
  }
}

function normalizeRedistribution(raw: unknown): Redistribution {
  if (!isRecord(raw)) fail("INVALID_ACTION", "SET_SHARE requires a redistribution rule");
  if (raw.kind === "proportional-other") return { kind: "proportional-other" };
  if (raw.kind !== "explicit-donors") fail("INVALID_ACTION", "Unknown redistribution rule");
  if (!Array.isArray(raw.candidateIds) || raw.candidateIds.length === 0) {
    fail("INVALID_ACTION", "explicit-donors requires nonempty candidateIds");
  }
  const candidateIds = raw.candidateIds.map(id => stringField(id, "redistribution.candidateIds[]", "INVALID_ACTION"));
  if (new Set(candidateIds).size !== candidateIds.length) fail("INVALID_ACTION", "Duplicate explicit redistribution candidate");
  return { kind: "explicit-donors", candidateIds: candidateIds.sort() };
}

function normalizeScenario(raw: unknown): Scenario {
  if (!isRecord(raw) || raw.schemaVersion !== 1) fail("INVALID_SCENARIO", "Unsupported scenario schemaVersion (expected 1)");
  const electionId = stringField(raw.electionId, "scenario.electionId", "INVALID_SCENARIO");
  if (!Array.isArray(raw.actions)) fail("INVALID_SCENARIO", "scenario.actions must be an array");
  const seen = new Set<string>();
  const actions: Adjustment[] = raw.actions.map(value => {
    if (!isRecord(value)) fail("INVALID_ACTION", "Action must be an object");
    const id = stringField(value.id, "action.id", "INVALID_ACTION");
    if (seen.has(id)) fail("INVALID_ACTION", `Duplicate action ID: ${id}`);
    seen.add(id);
    const scope = normalizeScope(value.scope);
    switch (value.type) {
      case "TRANSFER_PP": return {
        type: "TRANSFER_PP" as const, id, scope,
        fromCandidateId: stringField(value.fromCandidateId, "fromCandidateId", "INVALID_ACTION"),
        toCandidateId: stringField(value.toCandidateId, "toCandidateId", "INVALID_ACTION"),
        points: finiteRange(value.points, "points", 0, 100)
      };
      case "SET_SHARE": return {
        type: "SET_SHARE" as const, id, scope,
        candidateId: stringField(value.candidateId, "candidateId", "INVALID_ACTION"),
        targetPercent: finiteRange(value.targetPercent, "targetPercent", 0, 100),
        redistribution: normalizeRedistribution(value.redistribution)
      };
      case "TURNOUT_SCALE":
        if (value.allocation !== "proportional-candidates") fail("INVALID_ACTION", "Unsupported turnout allocation");
        return {
          type: "TURNOUT_SCALE" as const, id, scope,
          factor: finiteRange(value.factor, "factor", 0, Number.MAX_VALUE),
          allocation: "proportional-candidates" as const
        };
      default: fail("INVALID_ACTION", `Unknown adjustment type: ${String(value.type)}`);
    }
  });
  return { schemaVersion: 1, electionId, actions };
}

function scopedRows(rows: readonly Row[], scope: GeoScope): Row[] {
  switch (scope.kind) {
    case "national": return [...rows];
    case "state": {
      const filtered = rows.filter(row => row.stateId === scope.stateId);
      if (filtered.length === 0) fail("UNKNOWN_GEO", `Unknown state: ${scope.stateId}`);
      return filtered;
    }
    case "county": {
      const desired = new Set(scope.countyIds);
      const filtered = rows.filter(row => desired.has(row.geoId));
      if (filtered.length !== desired.size) {
        fail("UNKNOWN_GEO", `Unknown county: ${scope.countyIds.filter(id => !filtered.some(row => row.geoId === id)).join(", ")}`);
      }
      return filtered;
    }
    case "district":
    case "precinct": fail("UNSUPPORTED_SCOPE", `${scope.kind} scope is not supported in v0.1`);
  }
}

function requireCandidate(id: string, ids: readonly string[]): void {
  if (!ids.includes(id)) fail("UNKNOWN_CANDIDATE", `Unknown candidate: ${id}`);
}

function sumCandidateBallots(rows: readonly Row[], ids: readonly string[]): number {
  let total = 0;
  for (const row of rows) for (const id of ids) total = add(total, row.votes[id]!, "Scoped candidate ballot total");
  return total;
}

function sumCandidate(rows: readonly Row[], id: string): number {
  return rows.reduce((sum, row) => add(sum, row.votes[id]!, `Total votes for ${id}`), 0);
}

function transfer(rows: readonly Row[], ids: readonly string[], action: Extract<Adjustment, { type: "TRANSFER_PP" }>): void {
  const { fromCandidateId: from, toCandidateId: to } = action;
  requireCandidate(from, ids);
  requireCandidate(to, ids);
  if (from === to) fail("INVALID_ACTION", "TRANSFER_PP source and destination must differ");
  const candidateBallots = sumCandidateBallots(rows, ids);
  const moved = roundProduct(candidateBallots, action.points, 100);
  const available = sumCandidate(rows, from);
  if (moved > available) fail("INSUFFICIENT_SUPPORT", `${action.id}: ${from} has ${available}, transfer requires ${moved}`);
  const portions = allocate(moved, rows.map(row => row.votes[from]!));
  rows.forEach((row, index) => {
    const count = portions[index]!;
    row.votes[from]! -= count;
    row.votes[to] = add(row.votes[to]!, count, `Transfer to ${to}`);
  });
}

function setShare(rows: readonly Row[], ids: readonly string[], action: Extract<Adjustment, { type: "SET_SHARE" }>): void {
  const { candidateId: targetId, redistribution } = action;
  requireCandidate(targetId, ids);
  const participants = redistribution.kind === "proportional-other" ?
    ids.filter(id => id !== targetId) : redistribution.candidateIds;
  if (participants.length === 0) fail("INVALID_ACTION", "SET_SHARE needs at least one other candidate");
  for (const id of participants) {
    requireCandidate(id, ids);
    if (id === targetId) fail("INVALID_ACTION", "Target cannot be a redistribution participant");
  }
  const candidateBallots = sumCandidateBallots(rows, ids);
  const current = sumCandidate(rows, targetId);
  const desired = roundProduct(candidateBallots, action.targetPercent, 100);
  if (desired === current) return;

  if (desired > current) {
    const delta = desired - current;
    const cells = rows.flatMap(row => participants.map(id => ({ row, id, weight: row.votes[id]! })));
    const available = cells.reduce((sum, cell) => add(sum, cell.weight, "Redistribution capacity"), 0);
    if (delta > available) fail("INSUFFICIENT_SUPPORT", `${action.id}: redistribution participants can supply only ${available} of ${delta}`);
    const deductions = allocate(delta, cells.map(cell => cell.weight));
    cells.forEach((cell, index) => {
      const count = deductions[index]!;
      cell.row.votes[cell.id]! -= count;
      cell.row.votes[targetId] = add(cell.row.votes[targetId]!, count, `SET_SHARE target ${targetId}`);
    });
  } else {
    const delta = current - desired;
    const removals = allocate(delta, rows.map(row => row.votes[targetId]!));
    rows.forEach((row, index) => {
      const count = removals[index]!;
      row.votes[targetId]! -= count;
      const awards = allocate(count, participants.map(id => row.votes[id]!), true);
      participants.forEach((id, recipientIndex) => {
        row.votes[id] = add(row.votes[id]!, awards[recipientIndex]!, `SET_SHARE recipient ${id}`);
      });
    });
  }
}

function turnoutScale(rows: readonly Row[], ids: readonly string[], action: Extract<Adjustment, { type: "TURNOUT_SCALE" }>): void {
  for (const row of rows) {
    const total = roundProduct(row.ballots, action.factor);
    if (row.eligibleVoters !== null && total > row.eligibleVoters) {
      fail("TURNOUT_EXCEEDS_ELIGIBLE", `${action.id}: ${row.geoId} modeled ballots ${total} exceed eligible ${row.eligibleVoters}`);
    }
    // Every ballot category, including otherBallots, is scaled. A zero-ballot county stays at zero.
    const allocated = allocate(total, [...ids.map(id => row.votes[id]!), row.otherBallots]);
    ids.forEach((id, index) => { row.votes[id] = allocated[index]!; });
    row.otherBallots = allocated[ids.length]!;
    row.ballots = total;
  }
}

function totals(rows: readonly Row[], ids: readonly string[]): ResultTotals {
  const votes: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  let ballots = 0;
  let otherBallots = 0;
  for (const row of rows) {
    ballots = add(ballots, row.ballots, "Aggregate ballots");
    otherBallots = add(otherBallots, row.otherBallots, "Aggregate otherBallots");
    for (const id of ids) votes[id] = add(votes[id]!, row.votes[id]!, `Aggregate votes for ${id}`);
  }
  let highest = 0;
  let winnerCandidateId: string | null = null;
  let tie = false;
  for (const id of ids) {
    const count = votes[id]!;
    if (count > highest) { highest = count; winnerCandidateId = id; tie = false; }
    else if (count === highest && count > 0) { winnerCandidateId = null; tie = true; }
  }
  // A later unique maximum must reset an earlier tie.
  return { votes, otherBallots, ballots, winnerCandidateId, tie };
}

/**
 * Replays actions from an independent baseline clone; never mutates inputs.
 * Candidate share denominator excludes otherBallots. Turnout includes all ballot categories.
 * Rounding: nearest integer, halves up; fractional allocations use stable largest remainder.
 */
export function simulateElection(
  election: ElectionDefinition,
  baseUnits: readonly BaseUnitResult[],
  scenario: Scenario
): SimulationResult {
  const ids = validateElection(election);
  const rows = cloneRows(baseUnits, ids);
  const validScenario = normalizeScenario(scenario);
  if (validScenario.electionId !== election.id) fail("INVALID_SCENARIO", "Scenario electionId does not match election");
  for (const action of validScenario.actions) {
    const selected = scopedRows(rows, action.scope);
    switch (action.type) {
      case "TRANSFER_PP": transfer(selected, ids, action); break;
      case "SET_SHARE": setShare(selected, ids, action); break;
      case "TURNOUT_SCALE": turnoutScale(selected, ids, action); break;
    }
  }
  const states = [...new Set(rows.map(row => row.stateId))].sort();
  const byState: Record<string, ResultTotals> = Object.fromEntries(states.map(id => [
    id, totals(rows.filter(row => row.stateId === id), ids)
  ]));
  return {
    electionId: election.id,
    schemaVersion: 1,
    units: rows,
    byState,
    national: totals(rows, ids),
    dataStatus: election.dataStatus
  };
}

/** A fresh object and action list; the supplied scenario is never modified. */
export function undoLastAction(scenario: Scenario): Scenario {
  const normalized = normalizeScenario(scenario);
  return { ...normalized, actions: normalized.actions.slice(0, -1) };
}

/** Immutable ordered append; guarantees action IDs and payload validate together. */
export function appendAction(scenario: Scenario, action: Adjustment): Scenario {
  const normalized = normalizeScenario(scenario);
  return normalizeScenario({ ...normalized, actions: [...normalized.actions, action] });
}

/** Canonical v1 serialization: preserves action order, canonicalizes scope sets and object keys. */
export function serializeScenario(scenario: Scenario): string {
  return JSON.stringify(normalizeScenario(scenario));
}

export function parseScenario(json: string): Scenario {
  if (typeof json !== "string") fail("INVALID_SCENARIO", "Scenario JSON must be a string");
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { fail("INVALID_SCENARIO", "Malformed scenario JSON"); }
  return normalizeScenario(parsed);
}
