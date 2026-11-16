import type { BaseUnitResult, CandidateId, ElectionDefinition, GeoScope, ResultTotals, SimulationResult } from "@votatlas/contracts";
import { SimulationError, simulateElection } from "./engine.js";

/** Experimental synthetic-only demographic cohorts. One disjoint partition, never stacked marginals. */
export interface CohortDefinition {
  id: string;
  label: string;
  /** Exactly one value for every dimension in the partition; verified joint cells use complete tuples. */
  dimensions: Record<string, string>;
}
export interface CohortCell {
  cohortId: string;
  /** Explicit modeled voter universe for this cell; null only when the county has no eligibility universe. */
  eligibleVoters: number | null;
  votes: Record<CandidateId, number>;
  otherBallots: number;
}
export interface CohortCounty {
  geoId: string;
  cells: CohortCell[];
}
export interface SyntheticCohortPartition {
  schemaVersion: 1;
  dataStatus: "synthetic";
  partitionId: string;
  /** A single marginal dimension or an explicitly supplied joint cross-tabulation. */
  kind: "single" | "joint";
  dimensionIds: string[];
  /** Mandatory for joint models; asserts explicitly supplied synthetic joint counts, not multiplied marginals. */
  jointCountsSource?: "explicit-synthetic-cross-tabulation";
  universe: "modeled-ballots";
  cohorts: CohortDefinition[];
  counties: CohortCounty[];
}
export type CohortAction =
  | { type: "COHORT_TRANSFER_PP"; id: string; scope: GeoScope; cohortIds: string[];
      fromCandidateId: CandidateId; toCandidateId: CandidateId; points: number }
  | { type: "COHORT_TURNOUT_SCALE"; id: string; scope: GeoScope; cohortIds: string[]; factor: number };
export interface CohortCellDelta {
  geoId: string;
  cohortId: string;
  before: { votes: Record<CandidateId, number>; otherBallots: number; ballots: number };
  after: { votes: Record<CandidateId, number>; otherBallots: number; ballots: number };
  deltaVotes: Record<CandidateId, number>;
  deltaOtherBallots: number;
  deltaBallots: number;
}
export interface CohortSimulationResult {
  dataStatus: "synthetic";
  universe: "modeled-ballots";
  transferDenominator: "selected-cohort-candidate-ballots";
  partitionId: string;
  /** Auditable, sorted cell counts and exact signed deltas. */
  cells: Array<{ geoId: string; cohortId: string; eligibleVoters: number | null;
    votes: Record<CandidateId, number>; otherBallots: number; ballots: number }>;
  deltas: CohortCellDelta[];
  /** Directly consumable by the existing candidate-neutral engine. */
  baseUnits: BaseUnitResult[];
  /** The existing simulator supplies canonical state/nation rollups and winner/tie semantics. */
  result: SimulationResult;
  byState: Record<string, ResultTotals>;
  national: ResultTotals;
}

const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const forbidden = new Set(["__proto__", "prototype", "constructor", "toString", "valueOf", "hasOwnProperty"]);
type Cell = CohortSimulationResult["cells"][number];
const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
/** Code-unit ordering is runtime-locale independent, unlike localeCompare. */
const lex = (a: string, b: string): number => a === b ? 0 : a < b ? -1 : 1;
function bad(detail: string): never { throw new SimulationError("INVALID_ACTION", `Synthetic cohort: ${detail}`); }
function invalidPartition(detail: string): never { throw new SimulationError("INVALID_BASE_UNIT", `Synthetic cohort partition: ${detail}`); }
function safeId(v: unknown, label: string): string {
  if (typeof v !== "string" || v.length < 1 || v.length > 128 || v !== v.trim() ||
      /[\x00-\x1f\x7f]/.test(v) || forbidden.has(v)) invalidPartition(`${label} is invalid or reserved`);
  return v;
}
function count(v: unknown, label: string): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) invalidPartition(`${label} must be a nonnegative safe integer`);
  return v;
}
function add(a: number, b: number, label: string): number {
  const total = BigInt(a) + BigInt(b);
  if (total > MAX || total < -MAX) throw new SimulationError("INTEGER_OVERFLOW", `${label} exceeds integer precision`);
  return Number(total);
}
function nonnegativeSum(values: readonly number[], label: string): number {
  return values.reduce((acc, n) => add(acc, n, label), 0);
}
function rational(value: number, label: string): [bigint, bigint] {
  if (!Number.isFinite(value) || value < 0) bad(`${label} must be nonnegative and finite`);
  const s = value.toString().toLowerCase();
  const [mantissa = "", exponent = "0"] = s.split("e");
  const parts = mantissa.split(".");
  const digits = (parts[0] ?? "0") + (parts[1] ?? "");
  const places = (parts[1] ?? "").length - Number(exponent);
  return places >= 0 ? [BigInt(digits), 10n ** BigInt(places)] : [BigInt(digits) * 10n ** BigInt(-places), 1n];
}
function roundMul(value: number, multiplier: number, denominator: number, label: string): number {
  const [n, d] = rational(multiplier, label);
  const numerator = BigInt(value) * n;
  const divisor = d * BigInt(denominator);
  const answer = (numerator * 2n + divisor) / (divisor * 2n);
  if (answer > MAX) throw new SimulationError("INTEGER_OVERFLOW", `${label} exceeds integer precision`);
  return Number(answer);
}
/** Largest remainder; ties go to existing stable ordering of cells/candidates. */
function allocate(total: number, weights: readonly number[], equalOnZero = false): number[] {
  if (!Number.isSafeInteger(total) || total < 0) bad("invalid allocation total");
  if (weights.length === 0) { if (total !== 0) bad("no allocation recipients"); return []; }
  const sum = nonnegativeSum(weights, "allocation denominator");
  if (sum === 0 && !equalOnZero) {
    if (total > 0) bad("cannot allocate turnout from a zero-ballot cell");
    return weights.map(() => 0);
  }
  const denom = BigInt(sum || weights.length);
  const numerators = weights.map(w => BigInt(sum ? w : 1) * BigInt(total));
  const floors = numerators.map(n => Number(n / denom));
  const allocated = nonnegativeSum(floors, "allocation floors");
  let left = total - allocated;
  const priorities = numerators.map((n, i) => ({ i, rem: n % denom }))
    .sort((a, b) => a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1);
  for (const { i } of priorities) { if (left-- <= 0) break; floors[i]!++; }
  return floors;
}
function ballots(c: Pick<Cell, "votes" | "otherBallots">, ids: readonly string[]): number {
  return nonnegativeSum([...ids.map(id => c.votes[id]!), c.otherBallots], "cohort ballots");
}
function votesCopy(obj: Record<string, number>, ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map(id => [id, obj[id]!]));
}
function verifyVotes(obj: unknown, ids: readonly string[], label: string): Record<string, number> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) invalidPartition(`${label} must be a vote object`);
  const record = obj as Record<string, unknown>;
  if (Object.keys(record).length !== ids.length) invalidPartition(`${label} must contain exactly the candidate registry`);
  return Object.fromEntries(ids.map(id => {
    if (!own(record, id)) invalidPartition(`${label} missing candidate ${id}`);
    return [id, count(record[id], `${label}.${id}`)];
  }));
}
function cloneAndValidate(election: ElectionDefinition, baseline: readonly BaseUnitResult[], partition: SyntheticCohortPartition):
  { ids: string[]; original: SimulationResult; cells: Cell[]; cohortIds: string[] } {
  if (election.dataStatus !== "synthetic") invalidPartition("cohort model requires a synthetic election, not observed historical preferences");
  const original = simulateElection(election, baseline, { schemaVersion: 1, electionId: election.id, actions: [] });
  const ids = election.candidates.map(c => c.id).sort();
  if (!partition || typeof partition !== "object" || partition.schemaVersion !== 1 ||
      partition.dataStatus !== "synthetic" || partition.universe !== "modeled-ballots" ||
      !Array.isArray(partition.dimensionIds) || !Array.isArray(partition.cohorts) ||
      !Array.isArray(partition.counties)) invalidPartition("invalid schema, universe or provenance");
  safeId(partition.partitionId, "partitionId");
  const dims = partition.dimensionIds.map(d => safeId(d, "dimensionId"));
  if (new Set(dims).size !== dims.length || dims.length === 0) invalidPartition("dimensions must be nonempty and distinct");
  if (dims.length === 1 && (partition.kind !== "single" || partition.jointCountsSource !== undefined))
    invalidPartition("a single dimension must use single partition kind");
  if (dims.length > 1 && (partition.kind !== "joint" || partition.jointCountsSource !== "explicit-synthetic-cross-tabulation"))
    invalidPartition("overlapping dimensions require explicit synthetic joint cross-tabulation, not independent marginals");
  if (!partition.cohorts.length) invalidPartition("partition needs at least one cohort");
  const cohortIds = new Set<string>();
  const tuples = new Set<string>();
  for (const cohort of partition.cohorts) {
    if (!cohort || typeof cohort !== "object") invalidPartition("cohort definition must be an object");
    safeId(cohort.id, "cohortId");
    if (cohortIds.has(cohort.id)) invalidPartition(`duplicate cohort ${cohort.id}`);
    cohortIds.add(cohort.id);
    if (typeof cohort.label !== "string" || !cohort.label.trim() || cohort.label.length > 128) invalidPartition("invalid cohort label");
    if (!cohort.dimensions || typeof cohort.dimensions !== "object" || Array.isArray(cohort.dimensions) ||
        Object.keys(cohort.dimensions).length !== dims.length) invalidPartition(`incomplete/extra attributes for ${cohort.id}`);
    const tuple = dims.map(dim => {
      if (!own(cohort.dimensions, dim)) invalidPartition(`${cohort.id} has missing dimension ${dim}`);
      return safeId(cohort.dimensions[dim], `${cohort.id}.${dim}`);
    });
    const key = JSON.stringify(tuple);
    if (tuples.has(key)) invalidPartition(`overlapping joint cell/tuple: ${key}`);
    tuples.add(key);
  }
  const countyIds = new Set<string>();
  const originalRows = new Map(original.units.map(r => [r.geoId, r]));
  const cells: Cell[] = [];
  for (const county of partition.counties) {
    if (!county || typeof county !== "object" || typeof county.geoId !== "string" ||
        countyIds.has(county.geoId)) invalidPartition("duplicate or invalid county ID");
    const base = originalRows.get(county.geoId);
    if (!base) invalidPartition(`unknown county ${county.geoId}`);
    countyIds.add(county.geoId);
    if (!Array.isArray(county.cells) || county.cells.length !== cohortIds.size) invalidPartition(`incomplete partition for ${county.geoId}`);
    const seen = new Set<string>();
    const perCandidate = Object.fromEntries(ids.map(id => [id, 0])) as Record<string, number>;
    let other = 0;
    let eligible = 0;
    for (const cell of county.cells) {
      if (!cell || typeof cell !== "object" || !cohortIds.has(cell.cohortId) || seen.has(cell.cohortId))
        invalidPartition(`duplicate or unknown cohort in ${county.geoId}`);
      seen.add(cell.cohortId);
      const votes = verifyVotes(cell.votes, ids, `${county.geoId}/${cell.cohortId}`);
      const extra = count(cell.otherBallots, "otherBallots");
      const total = ballots({ votes, otherBallots: extra }, ids);
      if (base.eligibleVoters !== null && cell.eligibleVoters === null) invalidPartition(`missing eligible universe for ${county.geoId}/${cell.cohortId}`);
      if (cell.eligibleVoters !== null) {
        const cap = count(cell.eligibleVoters, "cell eligibleVoters");
        if (total > cap) invalidPartition(`cell ballots exceed eligible voter universe for ${county.geoId}/${cell.cohortId}`);
        eligible = add(eligible, cap, "eligible voter partition");
      }
      other = add(other, extra, "other ballot partition");
      for (const id of ids) perCandidate[id] = add(perCandidate[id]!, votes[id]!, "candidate vote partition");
      cells.push({ geoId: county.geoId, cohortId: cell.cohortId, eligibleVoters: cell.eligibleVoters,
        votes, otherBallots: extra, ballots: total });
    }
    if (other !== base.otherBallots || ids.some(id => perCandidate[id] !== base.votes[id]))
      invalidPartition(`cohort votes do not exactly sum to trusted baseline for ${county.geoId}`);
    if (base.eligibleVoters !== null && eligible !== base.eligibleVoters)
      invalidPartition(`cohort eligible voters do not exactly sum to county universe for ${county.geoId}`);
  }
  if (countyIds.size !== original.units.length) invalidPartition("missing county or incomplete geographic partition");
  cells.sort((a, b) => lex(a.geoId, b.geoId) || lex(a.cohortId, b.cohortId));
  return { ids, original, cells, cohortIds: [...cohortIds].sort() };
}
function scopedCells(cells: readonly Cell[], action: CohortAction, cohortIds: readonly string[]): Cell[] {
  if (!action || typeof action !== "object" || typeof action.id !== "string" || !action.id.trim() || action.id.length > 128 ||
      !Array.isArray(action.cohortIds)) bad("invalid action ID or cohort selection");
  const selected = new Set<string>();
  for (const id of action.cohortIds) {
    if (typeof id !== "string" || selected.has(id)) bad("duplicate/invalid selected cohort");
    if (!cohortIds.includes(id)) throw new SimulationError("UNKNOWN_GEO", `Unknown synthetic cohort ${id}`);
    selected.add(id);
  }
  const scope = action.scope;
  if (!scope || typeof scope !== "object") bad("invalid scope");
  let target: Cell[];
  switch (scope.kind) {
    case "national": target = [...cells]; break;
    case "state":
      if (typeof scope.stateId !== "string" || !cells.some(c => c.geoId.slice(0, 2) === scope.stateId))
        throw new SimulationError("UNKNOWN_GEO", `Unknown state ${scope.stateId}`);
      target = cells.filter(c => c.geoId.slice(0, 2) === scope.stateId); break;
    case "county": {
      if (!Array.isArray(scope.countyIds) || !scope.countyIds.length ||
          new Set(scope.countyIds).size !== scope.countyIds.length) bad("invalid county selection");
      const included = new Set(scope.countyIds);
      for (const id of included) if (!cells.some(c => c.geoId === id)) throw new SimulationError("UNKNOWN_GEO", `Unknown county ${id}`);
      target = cells.filter(c => included.has(c.geoId)); break;
    }
    case "district": case "precinct": throw new SimulationError("UNSUPPORTED_SCOPE", "Cohort model requires disjoint county atoms");
    default: bad("unsupported cohort scope");
  }
  return target.filter(c => selected.has(c.cohortId));
}

/** Recompute from the immutable trusted baseline plus ONE synthetic disjoint partition. */
export function simulateCohortPartition(
  election: ElectionDefinition,
  baseline: readonly BaseUnitResult[],
  partition: SyntheticCohortPartition,
  actions: readonly CohortAction[] = []
): CohortSimulationResult {
  const { ids, original, cells, cohortIds } = cloneAndValidate(election, baseline, partition);
  if (!Array.isArray(actions)) bad("actions must be an ordered array");
  const initial = cells.map(c => ({ ...c, votes: votesCopy(c.votes, ids) }));
  const used = new Set<string>();
  for (const action of actions) {
    const selected = scopedCells(cells, action, cohortIds);
    if (used.has(action.id)) bad(`duplicate cohort action ID ${action.id}`);
    used.add(action.id);
    switch (action.type) {
      case "COHORT_TRANSFER_PP": {
        if (!ids.includes(action.fromCandidateId) || !ids.includes(action.toCandidateId))
          throw new SimulationError("UNKNOWN_CANDIDATE", "Unknown cohort transfer candidate");
        if (action.fromCandidateId === action.toCandidateId || typeof action.points !== "number" ||
            !Number.isFinite(action.points) || action.points < 0 || action.points > 100) bad("invalid cohort transfer");
        const volume = nonnegativeSum(selected.map(c => nonnegativeSum(ids.map(id => c.votes[id]!), "candidate ballots")), "selected candidate denominator");
        const move = roundMul(volume, action.points, 100, "cohort transfer");
        const capacity = nonnegativeSum(selected.map(c => c.votes[action.fromCandidateId]!), "donor support");
        if (move > capacity) throw new SimulationError("INSUFFICIENT_SUPPORT", `${action.id}: cohort donor capacity ${capacity}, requested ${move}`);
        const portions = allocate(move, selected.map(c => c.votes[action.fromCandidateId]!));
        selected.forEach((c, i) => {
          c.votes[action.fromCandidateId]! -= portions[i]!;
          c.votes[action.toCandidateId] = add(c.votes[action.toCandidateId]!, portions[i]!, "cohort recipient");
        });
        break;
      }
      case "COHORT_TURNOUT_SCALE": {
        if (typeof action.factor !== "number" || !Number.isFinite(action.factor) || action.factor < 0) bad("invalid cohort turnout factor");
        for (const c of selected) {
          const total = roundMul(c.ballots, action.factor, 1, "cohort turnout");
          if (c.eligibleVoters !== null && total > c.eligibleVoters)
            throw new SimulationError("TURNOUT_EXCEEDS_ELIGIBLE", `${action.id}: ${c.geoId}/${c.cohortId} exceeds eligible voters`);
          const distribution = allocate(total, [...ids.map(id => c.votes[id]!), c.otherBallots]);
          ids.forEach((id, i) => { c.votes[id] = distribution[i]!; });
          c.otherBallots = distribution[ids.length]!;
          c.ballots = total;
        }
        break;
      }
      default: bad("unknown cohort action type");
    }
  }
  const originals = new Map(original.units.map(r => [r.geoId, r]));
  const counts = new Map<string, BaseUnitResult>();
  for (const row of original.units) counts.set(row.geoId, { geoId: row.geoId, stateId: row.stateId,
    eligibleVoters: row.eligibleVoters, votes: Object.fromEntries(ids.map(id => [id, 0])), otherBallots: 0 });
  for (const c of cells) {
    const sum = counts.get(c.geoId)!;
    for (const id of ids) sum.votes[id] = add(sum.votes[id]!, c.votes[id]!, "county cohort rollup");
    sum.otherBallots = add(sum.otherBallots, c.otherBallots, "county other ballot rollup");
  }
  const baseUnits = [...counts.values()];
  for (const row of baseUnits) {
    const current = ballots(row, ids);
    const parent = originals.get(row.geoId)!;
    if (parent.eligibleVoters !== null && current > parent.eligibleVoters)
      throw new SimulationError("TURNOUT_EXCEEDS_ELIGIBLE", `${row.geoId} cohort votes exceed county eligible universe`);
  }
  const result = simulateElection(election, baseUnits, { schemaVersion: 1, electionId: election.id, actions: [] });
  const deltas: CohortCellDelta[] = cells.map((c, i) => {
    const before = initial[i]!;
    return { geoId: c.geoId, cohortId: c.cohortId,
      before: { votes: votesCopy(before.votes, ids), otherBallots: before.otherBallots, ballots: before.ballots },
      after: { votes: votesCopy(c.votes, ids), otherBallots: c.otherBallots, ballots: c.ballots },
      deltaVotes: Object.fromEntries(ids.map(id => [id, c.votes[id]! - before.votes[id]!])),
      deltaOtherBallots: c.otherBallots - before.otherBallots,
      deltaBallots: c.ballots - before.ballots };
  });
  return { dataStatus: "synthetic", universe: "modeled-ballots", transferDenominator: "selected-cohort-candidate-ballots",
    partitionId: partition.partitionId, cells, deltas, baseUnits, result, byState: result.byState, national: result.national };
}
