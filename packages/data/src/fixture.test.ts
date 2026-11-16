import { describe, expect, it } from 'vitest';
import {
  createTennesseeSchematicGrid,
  expectedTennesseeGeoIds,
  getTennesseeCountyReferences,
  getTennesseeSyntheticFixture,
  sumTennesseeFixtureBallots,
} from './index.js';

describe('reproducible synthetic Tennessee fixture', () => {
  it('covers precisely the 95 known five-character Tennessee FIPS IDs, in order', () => {
    const expected = expectedTennesseeGeoIds();
    const counties = getTennesseeCountyReferences();
    expect(expected).toHaveLength(95);
    expect(expected[0]).toBe('47001');
    expect(expected[94]).toBe('47189');
    expect(new Set(expected).size).toBe(95);
    expect(counties.map(row => row.geoId)).toEqual(expected);
    expect(getTennesseeSyntheticFixture().units.map(row => row.geoId)).toEqual(expected);
    expect(counties.find(c => c.geoId === '47037')?.name).toBe('Davidson County');
    expect(counties.find(c => c.geoId === '47157')?.name).toBe('Shelby County');
  });
  it('is always synthetic with exactly three fictional candidates and no party assumptions', () => {
    const { election, units } = getTennesseeSyntheticFixture();
    expect(election.dataStatus).toBe('synthetic');
    expect(election.candidates.map(c => c.id)).toEqual(['aster', 'briar', 'cedar']);
    expect(election.candidates.every(c => c.name.includes('(fictional)'))).toBe(true);
    expect(election.candidates.every(c => c.partyLabel === undefined)).toBe(true);
    expect(units.every(r => Object.keys(r.votes).length === 3)).toBe(true);
  });
  it('conserves all candidate votes, other ballots and total eligible-voter ceilings', () => {
    const { units } = getTennesseeSyntheticFixture();
    for (const row of units) {
      const ballots = Object.values(row.votes).reduce((acc, n) => acc + n, row.otherBallots);
      expect(Number.isSafeInteger(ballots)).toBe(true);
      expect(ballots).toBeLessThanOrEqual(row.eligibleVoters!);
      expect(row.otherBallots).toBeGreaterThanOrEqual(0);
    }
    const totals = sumTennesseeFixtureBallots(units);
    expect(totals.ballots).toBe(totals.candidateBallots + totals.otherBallots);
    expect(totals.candidateBallots).toBeGreaterThan(0);
  });
  it('returns unshared copies so consumers cannot corrupt global baseline state', () => {
    const original = JSON.stringify(getTennesseeSyntheticFixture());
    const copy = getTennesseeSyntheticFixture();
    copy.units[0]!.votes.aster = 999999;
    copy.election.candidates[0]!.name = 'replaced';
    expect(JSON.stringify(getTennesseeSyntheticFixture())).toBe(original);
  });
  it('creates 95 deterministic interactive SCHEMATIC polygons, never labeled as real geography', () => {
    const grid = createTennesseeSchematicGrid();
    expect(grid.coordinateSystem).toBe('LOCAL_GRID_NOT_LONGITUDE_LATITUDE');
    expect(grid.disclaimer).toMatch(/NOT REAL COUNTY BOUNDARIES/);
    expect(grid.features.map(f => f.id)).toEqual(expectedTennesseeGeoIds());
    expect(grid.features.every(f => f.geometry.type === 'Polygon' && f.properties.geometryStatus === 'SCHEMATIC_NOT_GEOGRAPHIC')).toBe(true);
    expect(grid.features.every(f => JSON.stringify(f.geometry.coordinates[0]![0]) === JSON.stringify(f.geometry.coordinates[0]![4]))).toBe(true);
    expect(createTennesseeSchematicGrid()).toEqual(grid);
  });
});
