import type { BaseUnitResult } from '@votatlas/contracts';
import fixtureJson from '../fixtures/tennessee-synthetic-v1.json' with { type: 'json' };
import countyJson from '../fixtures/tennessee-counties-2020.json' with { type: 'json' };
import provenanceJson from '../fixtures/provenance.json' with { type: 'json' };
import { validateElectionDataset, validateProvenanceManifest } from './validation.js';
import type { ElectionDataset, ProvenanceManifest } from './validation.js';

/** US Census Bureau 2020 county names and five-character GEOIDs. These are not synthetic. */
export interface CountyReference { geoId: string; name: string }
export function getTennesseeCountyReferences(): CountyReference[] {
  return structuredClone(countyJson);
}
export function expectedTennesseeGeoIds(): string[] {
  return Array.from({ length: 95 }, (_, i) => `47${String(2 * i + 1).padStart(3, '0')}`);
}

/** Returns a fresh, validated copy. Never mutate the package's shared JSON import. */
export function getTennesseeSyntheticFixture(): ElectionDataset {
  const dataset: unknown = structuredClone(fixtureJson);
  return validateElectionDataset(dataset, { requiredGeoIds: expectedTennesseeGeoIds(), expectedStateId: '47' });
}

export function getTennesseeProvenance(): ProvenanceManifest {
  const manifest: unknown = structuredClone(provenanceJson);
  const dataset = getTennesseeSyntheticFixture();
  return validateProvenanceManifest(manifest, dataset);
}

/** Exact, non-rounded baseline totals; otherBallots is never silently mixed into votes. */
export function sumTennesseeFixtureBallots(units: readonly BaseUnitResult[]): { candidateBallots: number; otherBallots: number; ballots: number } {
  let candidateBallots = 0;
  let otherBallots = 0;
  for (const row of units) {
    for (const count of Object.values(row.votes)) candidateBallots += count;
    otherBallots += row.otherBallots;
  }
  const ballots = candidateBallots + otherBallots;
  if (![candidateBallots, otherBallots, ballots].every(Number.isSafeInteger)) throw new RangeError('fixture totals exceed safe integer range');
  return { candidateBallots, otherBallots, ballots };
}
