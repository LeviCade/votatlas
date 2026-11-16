import { getTennesseeCountyReferences } from './tennessee.js';

export interface SchematicCountyFeature {
  type: 'Feature';
  id: string;
  properties: { geoId: string; name: string; dataStatus: 'synthetic'; geometryStatus: 'SCHEMATIC_NOT_GEOGRAPHIC' };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}
export interface SchematicCountyCollection {
  type: 'FeatureCollection';
  coordinateSystem: 'LOCAL_GRID_NOT_LONGITUDE_LATITUDE';
  disclaimer: 'Synthetic grid tiles: NOT REAL COUNTY BOUNDARIES. Never display as real geographic shapes.';
  features: SchematicCountyFeature[];
}
/** For deterministic click-to-select tests ONLY. Not valid longitude/latitude geometry. */
export function createTennesseeSchematicGrid(): SchematicCountyCollection {
  const counties = getTennesseeCountyReferences();
  return {
    type: 'FeatureCollection',
    coordinateSystem: 'LOCAL_GRID_NOT_LONGITUDE_LATITUDE',
    disclaimer: 'Synthetic grid tiles: NOT REAL COUNTY BOUNDARIES. Never display as real geographic shapes.',
    features: counties.map((county, i) => {
      const x = i % 12;
      const y = Math.floor(i / 12);
      const ring = [[x, y], [x + 0.9, y], [x + 0.9, y + 0.9], [x, y + 0.9], [x, y]];
      return {
        type: 'Feature',
        id: county.geoId,
        properties: { geoId: county.geoId, name: county.name, dataStatus: 'synthetic', geometryStatus: 'SCHEMATIC_NOT_GEOGRAPHIC' },
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
    }),
  };
}
