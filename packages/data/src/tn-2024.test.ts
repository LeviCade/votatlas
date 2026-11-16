import { describe, it, expect } from 'vitest';
import {
  getTennessee2024PresidentialFixture,
  getTennessee2024PresidentialProvenance,
  HistoricalElectionUnavailableError,
  getTennesseeSyntheticFixture,
  getTennesseeRealCountyGeoJSON,
} from './index.js';

describe('Tennessee 2024 historical data provenance release gate', () => {
  it('never presents an incomplete, unverified SOS source as a published historical dataset', () => {
    const provenance = getTennessee2024PresidentialProvenance();
    expect(provenance.releaseApproved).toBe(false);
    expect(provenance.dataStatus).toBe('blocked');
    expect(provenance.sourceSha256).toBeNull();
    expect(provenance.payloadSha256).toBeNull();
    expect(() => getTennessee2024PresidentialFixture()).toThrow(HistoricalElectionUnavailableError);
  });
  it('provides isolated source provenance so callers cannot weaken the release gate', () => {
    const copy = getTennessee2024PresidentialProvenance();
    copy.releaseApproved = true;
    copy.dataStatus = 'official';
    copy.sourceSha256 = 'f'.repeat(64);
    copy.payloadSha256 = 'f'.repeat(64);
    expect(getTennessee2024PresidentialProvenance().releaseApproved).toBe(false);
    expect(() => getTennessee2024PresidentialFixture()).toThrow(HistoricalElectionUnavailableError);
  });
  it('does not touch preexisting synthetic election or authentic Census geometry', () => {
    expect(getTennesseeSyntheticFixture().election.dataStatus).toBe('synthetic');
    expect(getTennesseeSyntheticFixture().units).toHaveLength(95);
    expect(getTennesseeRealCountyGeoJSON().features).toHaveLength(95);
  });
});
