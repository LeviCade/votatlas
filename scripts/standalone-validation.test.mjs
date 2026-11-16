/** Dependency-free CI smoke for actual TypeScript validator while root lockfile is pending. */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateElectionDataset, validateProvenanceManifest, DataValidationError } from '../packages/data/src/validation.ts';
import { expectedTennesseeIds, generateTennesseeFixture, serializeFixture } from './tennessee-fixture-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(resolve(root, 'packages/data/fixtures', name), 'utf8'));
const fixture = () => read('tennessee-synthetic-v1.json');
const manifest = () => read('provenance.json');
const options = { expectedStateId: '47', requiredGeoIds: expectedTennesseeIds() };
const reject = (mutate, message) => {
  const data = fixture(); mutate(data);
  assert.throws(() => validateElectionDataset(data, options), message);
};

test('official Tennessee GEOID reference has exactly 95 stable county IDs', () => {
  const counties = read('tennessee-counties-2020.json');
  assert.deepEqual(counties.map(c => c.geoId), expectedTennesseeIds());
  assert.equal(counties.find(c => c.geoId === '47037').name, 'Davidson County');
  assert.equal(counties.find(c => c.geoId === '47189').name, 'Wilson County');
});
test('fixture is deterministic byte-for-byte', () => {
  const expected = generateTennesseeFixture(read('tennessee-counties-2020.json'));
  assert.equal(readFileSync(resolve(root, 'packages/data/fixtures/tennessee-synthetic-v1.json'), 'utf8'), serializeFixture(expected));
});
test('canonical 95-county, three-candidate synthetic fixture validates', () => {
  const d = validateElectionDataset(fixture(), options);
  assert.equal(d.units.length, 95);
  assert.equal(d.election.candidates.length, 3);
  assert.equal(d.election.dataStatus, 'synthetic');
  assert.ok(d.election.candidates.every(c => c.name.includes('(fictional)')));
});
test('all county candidate+other ballots conserve count and fit eligible voters', () => {
  for (const row of validateElectionDataset(fixture(), options).units) {
    const sum = Object.values(row.votes).reduce((a, v) => a + v, row.otherBallots);
    assert.ok(Number.isSafeInteger(sum) && sum <= row.eligibleVoters);
  }
});
test('duplicate county GEOIDs rejected', () => reject(d => { d.units[1].geoId = d.units[0].geoId; }, /strictly ascending/));
test('missing county rejected', () => reject(d => { d.units.pop(); }, /expected 95 counties/));
test('other-state county rejected', () => reject(d => { d.units[0].geoId = '01001'; d.units[0].stateId = '01'; }, /not in state 47/));
test('noninteger, negative, unsafe and nonfinite votes rejected', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) reject(d => { d.units[0].votes.aster = value; }, /nonnegative safe integer/);
});
test('unknown or missing candidate keys rejected', () => {
  reject(d => { d.units[0].votes.unknown = 2; }, /missing or unknown candidate/);
  reject(d => { delete d.units[0].votes.aster; }, /missing or unknown candidate/);
});
test('duplicate candidate registry entries rejected', () => reject(d => { d.election.candidates[2].id = 'aster'; }, /duplicate candidate ID/));
test('ballot-order collisions rejected', () => reject(d => { d.election.candidates[2].ballotOrder = 0; }, /duplicate candidate ballotOrder/));
test('turnout ceiling and supplied total ballot conservation rejected', () => {
  reject(d => { d.units[0].eligibleVoters = 0; }, /exceed eligibleVoters/);
  reject(d => { d.units[0].ballots = 10; }, /do not conserve/);
});
test('ballot accumulation overflow rejected', () => reject(d => { d.units[0].eligibleVoters = null; d.units[0].votes.aster = Number.MAX_SAFE_INTEGER; d.units[0].votes.briar = 2; }, /safe integer range/));
test('empty ballots remain valid and nonpartisan', () => {
  const d = fixture(); d.units[0].votes = { aster: 0, briar: 0, cedar: 0 }; d.units[0].eligibleVoters = 0; d.units[0].otherBallots = 0;
  assert.doesNotThrow(() => validateElectionDataset(d, options));
});
test('invalid dataset produces a typed exception', () => assert.throws(() => validateElectionDataset(null), DataValidationError));
test('complete provenance manifest matches fixture and names original sources', () => {
  const p = validateProvenanceManifest(manifest(), fixture());
  assert.deepEqual(p.sources.map(s => s.role), ['county-identifiers', 'synthetic-votes', 'schematic-geometry']);
});
test('unlicensed source, missing rights, wrong vintage and bad digest rejected', () => {
  const d = fixture();
  let p = manifest(); p.sources[0].license = 'unknown';
  assert.throws(() => validateProvenanceManifest(p, d), /unresolved rights/);
  p = manifest(); p.sources[0].url = null;
  assert.throws(() => validateProvenanceManifest(p, d), /require a public source URL/);
  p = manifest(); p.geographyVintage = '2024';
  assert.throws(() => validateProvenanceManifest(p, d), /disagrees/);
  p = manifest(); p.payloadSha256 = 'broken';
  assert.throws(() => validateProvenanceManifest(p, d), /SHA-256/);
});
