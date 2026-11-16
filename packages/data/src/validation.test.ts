import { describe, expect, it } from 'vitest';
import {
  DataValidationError,
  validateElectionDataset,
  validateProvenanceManifest,
  getTennesseeSyntheticFixture,
  getTennesseeProvenance,
  expectedTennesseeGeoIds,
} from './index.js';

const fixture = () => getTennesseeSyntheticFixture();
const manifest = () => getTennesseeProvenance();

function invalid(edited: (dataset: ReturnType<typeof fixture>) => void, message: RegExp): void {
  const data = fixture();
  edited(data);
  expect(() => validateElectionDataset(data, { requiredGeoIds: expectedTennesseeGeoIds(), expectedStateId: '47' })).toThrow(message);
}

describe('county and ballot integrity', () => {
  it('validates the exact 95-county canonical fixture', () => {
    expect(validateElectionDataset(fixture(), { requiredGeoIds: expectedTennesseeGeoIds(), expectedStateId: '47' }).units).toHaveLength(95);
  });
  it('rejects a duplicated county GEOID', () => invalid(d => { d.units[1]!.geoId = d.units[0]!.geoId; }, /strictly ascending/));
  it('rejects a missing county even when otherwise valid and sorted', () => invalid(d => { d.units.splice(12, 1); }, /expected 95 counties/));
  it('rejects another state and an invalid FIPS', () => {
    invalid(d => { d.units[0]!.geoId = '01001'; d.units[0]!.stateId = '01'; }, /not in state 47/);
    invalid(d => { d.units[0]!.geoId = '4700'; }, /five-character FIPS/);
  });
  it('rejects unsorted county rows', () => invalid(d => { [d.units[0], d.units[1]] = [d.units[1]!, d.units[0]!]; }, /strictly ascending/));
  it('rejects invalid vote values', () => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      invalid(d => { d.units[0]!.votes.aster = value; }, /nonnegative safe integer/);
    }
  });
  it('rejects invalid other ballots and eligible voters', () => {
    invalid(d => { d.units[0]!.otherBallots = -2; }, /nonnegative safe integer/);
    invalid(d => { d.units[0]!.eligibleVoters = -1; }, /nonnegative safe integer/);
    invalid(d => { d.units[0]!.eligibleVoters = 0; }, /exceed eligibleVoters/);
    invalid(d => { d.units[0]!.eligibleVoters = undefined as unknown as number; }, /number or null/);
  });
  it('rejects missing or unknown candidate keys in any county', () => {
    invalid(d => { delete d.units[0]!.votes.aster; }, /missing or unknown candidate/);
    invalid(d => { d.units[0]!.votes.imposter = 1; }, /missing or unknown candidate/);
    invalid(d => { delete d.units[0]!.votes.aster; d.units[0]!.votes.imposter = 1; }, /missing candidate aster/);
  });
  it('rejects duplicate candidate IDs and ballot order', () => {
    invalid(d => { d.election.candidates[1]!.id = 'aster'; }, /duplicate candidate ID/);
    invalid(d => { d.election.candidates[1]!.ballotOrder = 0; }, /duplicate candidate ballotOrder/);
  });
  it('rejects inconsistent state ID and incorrect conservation', () => {
    invalid(d => { d.units[0]!.stateId = '48'; }, /inconsistent stateId/);
    invalid(d => { (d.units[0]! as unknown as Record<string, unknown>).ballots = 10; }, /do not conserve/);
  });
  it('rejects arithmetic overflow rather than silently rounding sums', () => {
    invalid(d => {
      d.units[0]!.eligibleVoters = null;
      d.units[0]!.votes.aster = Number.MAX_SAFE_INTEGER;
      d.units[0]!.votes.briar = 3;
    }, /safe integer range/);
  });
  it('supports a genuinely empty-ballot county while keeping candidate keys explicit', () => {
    const d = fixture();
    d.units[0]!.votes = { aster: 0, briar: 0, cedar: 0 };
    d.units[0]!.otherBallots = 0;
    d.units[0]!.eligibleVoters = 0;
    expect(() => validateElectionDataset(d)).not.toThrow();
  });
  it('reports a dedicated error type for invalid input', () => {
    expect(() => validateElectionDataset(null)).toThrow(DataValidationError);
  });
});

describe('provenance and licensing', () => {
  it('validates the source vintage, disclosed synthetic ballots, rights and checksum', () => {
    expect(validateProvenanceManifest(manifest(), fixture()).sources.map(s => s.role)).toEqual([
      'county-identifiers', 'synthetic-votes', 'schematic-geometry',
    ]);
  });
  it('rejects fabricated or missing source info', () => {
    const data = fixture();
    const m = manifest();
    m.sources.splice(0, 1);
    expect(() => validateProvenanceManifest(m, data)).toThrow(/missing county identifier provenance/);
    const bad = manifest();
    bad.sources[0]!.license = 'unknown';
    expect(() => validateProvenanceManifest(bad, data)).toThrow(/unresolved rights/);
    const badUrl = manifest();
    badUrl.sources[0]!.url = 'http://insecure.example';
    expect(() => validateProvenanceManifest(badUrl, data)).toThrow(/HTTPS or null/);
  });
  it('rejects duplicate source IDs, missing synthetic vote provenance and missing URL', () => {
    const d = fixture();
    const dup = manifest();
    dup.sources[1]!.id = dup.sources[0]!.id;
    expect(() => validateProvenanceManifest(dup, d)).toThrow(/duplicate manifest source ID/);
    const missing = manifest();
    missing.sources.splice(1, 1);
    expect(() => validateProvenanceManifest(missing, d)).toThrow(/synthetic dataset must disclose/);
    const noUrl = manifest();
    noUrl.sources[0]!.url = null;
    expect(() => validateProvenanceManifest(noUrl, d)).toThrow(/require a public source URL/);
  });
  it('rejects mismatched dataset, geography vintage and digest format', () => {
    const data = fixture();
    const m1 = manifest(); m1.datasetId = 'another-dataset';
    expect(() => validateProvenanceManifest(m1, data)).toThrow(/disagrees/);
    const m2 = manifest(); m2.geographyVintage = '2024';
    expect(() => validateProvenanceManifest(m2, data)).toThrow(/disagrees/);
    const m3 = manifest(); m3.payloadSha256 = 'bad';
    expect(() => validateProvenanceManifest(m3, data)).toThrow(/SHA-256/);
  });
});
