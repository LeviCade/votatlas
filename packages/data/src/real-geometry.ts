import geojson from '../fixtures/tennessee-counties-real-2020.geo.json' with { type: 'json' };
import provenance from '../fixtures/tennessee-geometry-2020.provenance.json' with { type: 'json' };

/** Structural GeoJSON types intentionally compatible with @votatlas/map CountyShapes. */
export type TennesseeGeometry = { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };
export interface TennesseeCountyFeature {
  type: 'Feature';
  id: string;
  properties: { geoId: string; name: string };
  geometry: TennesseeGeometry;
}
export interface TennesseeCountyGeoJSON {
  type: 'FeatureCollection';
  features: TennesseeCountyFeature[];
}

/**
 * REAL U.S. Census Bureau 2020 Tennessee county shapes.
 * GeoJSON is lon/lat; this is categorically different from createTennesseeSchematicGrid().
 * Each shape's properties.geoId matches the election fixture's unit.geoId exactly.
 */
export function getTennesseeRealCountyGeoJSON(): TennesseeCountyGeoJSON {
  // Fixture is verified in GitHub Actions by scripts/check-tennessee-geometry.mjs.
  // Return a fresh copy so consuming map code cannot mutate the module singleton.
  return structuredClone(geojson) as unknown as TennesseeCountyGeoJSON;
}

export function getTennesseeGeometryProvenance(): typeof provenance {
  return structuredClone(provenance);
}
