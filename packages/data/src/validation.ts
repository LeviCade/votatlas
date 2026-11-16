import type { BaseUnitResult, ElectionDefinition } from '@votatlas/contracts';

export interface ElectionDataset {
  election: ElectionDefinition;
  units: BaseUnitResult[];
}

export interface ProvenanceSource {
  id: string;
  role: 'county-identifiers' | 'synthetic-votes' | 'schematic-geometry';
  publisher: string;
  title: string;
  url: string | null;
  vintage: string;
  license: string;
  attribution: string;
  notes: string;
}

export interface ProvenanceManifest {
  schemaVersion: 1;
  datasetId: string;
  dataStatus: 'synthetic' | 'official' | 'estimated';
  geographyVintage: string;
  generatedBy: string;
  generationMethod: string;
  /** SHA-256 of UTF-8 fixture JSON including its final LF. Checked by scripts/check-fixtures.mjs. */
  payloadSha256: string;
  sources: ProvenanceSource[];
}

export interface ValidationOptions {
  requiredGeoIds?: readonly string[];
  expectedStateId?: string;
}

export class DataValidationError extends Error {
  override name = 'DataValidationError';
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DataValidationError(message);
}
function record(value: unknown, path: string): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string): string {
  ensure(typeof value === 'string' && value.trim().length > 0, `${path} must be a nonempty string`);
  return value;
}
function safeVotes(value: unknown, path: string): number {
  ensure(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, `${path} must be a nonnegative safe integer`);
  return value;
}
function safeAdd(a: number, b: number, path: string): number {
  const total = a + b;
  ensure(Number.isSafeInteger(total), `${path} exceeds the safe integer range`);
  return total;
}

/** Rejects malformed imports before casting them to the canonical shared contracts. */
export function validateElectionDataset(input: unknown, options: ValidationOptions = {}): ElectionDataset {
  const data = record(input, 'dataset');
  const election = record(data.election, 'election');
  text(election.id, 'election.id');
  text(election.title, 'election.title');
  text(election.office, 'election.office');
  text(election.geographyVintage, 'election.geographyVintage');
  ensure(['synthetic', 'estimated', 'official'].includes(String(election.dataStatus)), 'election.dataStatus must be recognized');
  if (election.year !== undefined) safeVotes(election.year, 'election.year');
  ensure(Array.isArray(election.candidates) && election.candidates.length > 0, 'election.candidates must be nonempty');

  const candidateIds: string[] = [];
  const ballotOrders = new Set<number>();
  for (const [i, value] of election.candidates.entries()) {
    const candidate = record(value, `candidates[${i}]`);
    const id = text(candidate.id, `candidates[${i}].id`);
    ensure(!candidateIds.includes(id), `duplicate candidate ID: ${id}`);
    text(candidate.name, `candidates[${i}].name`);
    text(candidate.color, `candidates[${i}].color`);
    if (candidate.partyLabel !== undefined) text(candidate.partyLabel, `candidates[${i}].partyLabel`);
    const order = safeVotes(candidate.ballotOrder, `candidates[${i}].ballotOrder`);
    ensure(!ballotOrders.has(order), `duplicate candidate ballotOrder: ${order}`);
    candidateIds.push(id);
    ballotOrders.add(order);
  }
  ensure(Array.isArray(data.units) && data.units.length > 0, 'dataset.units must be nonempty');
  const actualGeoIds: string[] = [];
  let previousId = '';
  for (const [i, value] of data.units.entries()) {
    const unit = record(value, `units[${i}]`);
    const geoId = text(unit.geoId, `units[${i}].geoId`);
    ensure(/^\d{5}$/.test(geoId), `units[${i}].geoId must be a five-character FIPS string`);
    ensure(geoId > previousId, `county GEOIDs must be strictly ascending with no duplicates: ${geoId}`);
    const stateId = text(unit.stateId, `units[${i}].stateId`);
    ensure(/^\d{2}$/.test(stateId), `units[${i}].stateId must be two characters`);
    ensure(geoId.startsWith(stateId), `county ${geoId} has inconsistent stateId ${stateId}`);
    if (options.expectedStateId !== undefined) ensure(stateId === options.expectedStateId, `county ${geoId} is not in state ${options.expectedStateId}`);
    ensure(unit.eligibleVoters === null || unit.eligibleVoters !== undefined, `units[${i}].eligibleVoters must be a number or null`);
    const eligible = unit.eligibleVoters === null ? null : safeVotes(unit.eligibleVoters, `units[${i}].eligibleVoters`);
    const votes = record(unit.votes, `units[${i}].votes`);
    ensure(Object.keys(votes).length === candidateIds.length, `county ${geoId} has missing or unknown candidate vote keys`);
    let ballots = safeVotes(unit.otherBallots, `units[${i}].otherBallots`);
    for (const id of candidateIds) {
      ensure(Object.hasOwn(votes, id), `county ${geoId} missing candidate ${id}`);
      ballots = safeAdd(ballots, safeVotes(votes[id], `county ${geoId} votes.${id}`), `county ${geoId} ballots`);
    }
    if (eligible !== null) ensure(ballots <= eligible, `county ${geoId} ballots exceed eligibleVoters`);
    // BaseUnitResult does NOT contain a ballot total. A present total must conserve ballots.
    if (Object.hasOwn(unit, 'ballots')) {
      ensure(safeVotes(unit.ballots, `units[${i}].ballots`) === ballots, `county ${geoId} ballots do not conserve votes + otherBallots`);
    }
    actualGeoIds.push(geoId);
    previousId = geoId;
  }
  if (options.requiredGeoIds !== undefined) {
    const expected = [...options.requiredGeoIds];
    ensure(new Set(expected).size === expected.length && expected.every(id => /^\d{5}$/.test(id)), 'requiredGeoIds must be unique five-character FIPS strings');
    expected.sort();
    ensure(actualGeoIds.length === expected.length, `expected ${expected.length} counties, found ${actualGeoIds.length}`);
    for (let i = 0; i < expected.length; i++) {
      ensure(actualGeoIds[i] === expected[i], `missing or unexpected county: expected ${expected[i]}, got ${actualGeoIds[i] ?? '(missing)'}`);
    }
  }
  return input as ElectionDataset;
}

/** Validates rights metadata *and* consistency with the referenced fixture. */
export function validateProvenanceManifest(input: unknown, dataset: ElectionDataset): ProvenanceManifest {
  const manifest = record(input, 'manifest');
  ensure(manifest.schemaVersion === 1, 'unsupported manifest.schemaVersion');
  ensure(manifest.datasetId === dataset.election.id, 'manifest.datasetId disagrees with election.id');
  ensure(manifest.geographyVintage === dataset.election.geographyVintage, 'manifest.geographyVintage disagrees with election');
  ensure(manifest.dataStatus === dataset.election.dataStatus, 'manifest.dataStatus disagrees with election');
  text(manifest.generatedBy, 'manifest.generatedBy');
  text(manifest.generationMethod, 'manifest.generationMethod');
  ensure(typeof manifest.payloadSha256 === 'string' && /^[a-f0-9]{64}$/.test(manifest.payloadSha256), 'manifest.payloadSha256 must be a SHA-256 hex digest');
  ensure(Array.isArray(manifest.sources) && manifest.sources.length > 0, 'manifest.sources is required');
  const sourceIds = new Set<string>();
  const roles = new Set<string>();
  for (const [i, value] of manifest.sources.entries()) {
    const source = record(value, `sources[${i}]`);
    const id = text(source.id, `sources[${i}].id`);
    ensure(!sourceIds.has(id), `duplicate manifest source ID: ${id}`);
    const role = text(source.role, `sources[${i}].role`);
    ensure(['county-identifiers', 'synthetic-votes', 'schematic-geometry'].includes(role), `unknown source role: ${role}`);
    ensure(!roles.has(role), `duplicate source role: ${role}`);
    for (const field of ['publisher', 'title', 'vintage', 'license', 'attribution', 'notes']) text(source[field], `sources[${i}].${field}`);
    ensure(typeof source.license === 'string' && !/^(unknown|none|unlicensed|proprietary)$/i.test(source.license.trim()), `sources[${i}] has unresolved rights`);
    ensure(source.url === null || (typeof source.url === 'string' && /^https:\/\//.test(source.url)), `sources[${i}].url must be HTTPS or null`);
    if (role === 'county-identifiers') ensure(typeof source.url === 'string', 'county identifiers require a public source URL');
    sourceIds.add(id);
    roles.add(role);
  }
  ensure(roles.has('county-identifiers'), 'missing county identifier provenance');
  if (dataset.election.dataStatus === 'synthetic') {
    ensure(roles.has('synthetic-votes'), 'synthetic dataset must disclose vote generation');
    ensure(typeof manifest.generationMethod === 'string' && /synthetic|deterministic|arithmetic|fictional/i.test(manifest.generationMethod), 'synthetic generation method must be explicit');
  }
  return input as ProvenanceManifest;
}
