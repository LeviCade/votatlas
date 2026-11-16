export type { ElectionDataset, ValidationOptions, ProvenanceSource, ProvenanceManifest } from './validation.js';
export { DataValidationError, validateElectionDataset, validateProvenanceManifest } from './validation.js';
export type { CountyReference } from './tennessee.js';
export { getTennesseeCountyReferences, expectedTennesseeGeoIds, getTennesseeSyntheticFixture, getTennesseeProvenance, sumTennesseeFixtureBallots } from './tennessee.js';
export type { SchematicCountyFeature, SchematicCountyCollection } from './geometry.js';
export { createTennesseeSchematicGrid } from './geometry.js';

/** Real Census 2020 Tennessee county polygons; NOT the local-index schematic grid. */
export type { TennesseeGeometry, TennesseeCountyFeature, TennesseeCountyGeoJSON } from './real-geometry.js';
export { getTennesseeRealCountyGeoJSON, getTennesseeGeometryProvenance } from './real-geometry.js';

/** Source-gated genuine Tennessee presidential records; no synthetic fallback. */
export type { Tennessee2024SourceProvenance } from './tn-2024.js';
export { HistoricalElectionUnavailableError, getTennessee2024PresidentialFixture, getTennessee2024PresidentialProvenance } from './tn-2024.js';
