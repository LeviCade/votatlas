import { describe, expect, it } from 'vitest';
import { expectedTennesseeGeoIds, getTennesseeSyntheticFixture, getTennesseeCountyReferences } from './tennessee.js';
import { getTennesseeRealCountyGeoJSON, getTennesseeGeometryProvenance } from './real-geometry.js';

describe('REAL Tennessee Census 2020 county geometries', () => {
  it('has 95 real shapes, one for each canonical synthetic election GEOID', () => {
    const geometry = getTennesseeRealCountyGeoJSON();
    const expected = expectedTennesseeGeoIds();
    expect(geometry.type).toBe('FeatureCollection');
    expect(geometry.features.map(f => f.properties.geoId)).toEqual(expected);
    expect(geometry.features.map(f => f.id)).toEqual(expected);
    expect(geometry.features.map(f => f.properties.geoId))
      .toEqual(getTennesseeSyntheticFixture().units.map(f => f.geoId));
    expect(geometry.features.map(f => f.properties.name))
      .toEqual(getTennesseeCountyReferences().map(f => f.name));
  });
  it('has geographic lon/lat with real polygon and multipolygon rings', () => {
    const shapes = getTennesseeRealCountyGeoJSON();
    let multipart = 0;
    for (const feature of shapes.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      if (feature.geometry.type === 'MultiPolygon') multipart++;
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) {
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]).toEqual(ring[ring.length - 1]);
          for (const [lon, lat] of ring) {
            expect(lon).toBeGreaterThan(-90.5);
            expect(lon).toBeLessThan(-81.4);
            expect(lat).toBeGreaterThan(34.8);
            expect(lat).toBeLessThan(36.9);
          }
        }
      }
    }
    expect(multipart).toBe(5);
  });
  it('never incorporates synthetic vote totals into real geometry properties', () => {
    for (const feature of getTennesseeRealCountyGeoJSON().features) {
      expect(Object.keys(feature.properties).sort()).toEqual(['geoId', 'name']);
      expect(feature.properties).not.toHaveProperty('votes');
    }
    const provenance = getTennesseeGeometryProvenance();
    expect(provenance.geographyVintage).toBe('2020');
    expect(provenance.sourcePublisher).toBe('U.S. Census Bureau');
    expect(provenance.output.bytes).toBeLessThan(2_000_000);
  });
  it('returns a fresh independent copy of shapes and provenance', () => {
    const first = getTennesseeRealCountyGeoJSON();
    first.features[0]!.properties.name = 'Mutated!';
    expect(getTennesseeRealCountyGeoJSON().features[0]!.properties.name).toBe('Anderson County');
    const prior = getTennesseeGeometryProvenance();
    prior.output.bytes = 1;
    expect(getTennesseeGeometryProvenance().output.bytes).toBe(955123);
  });
});
