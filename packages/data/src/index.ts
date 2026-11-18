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

/** Genuine 2024 ACS county POPULATION composition, never observed voting behavior. */
export type {TennesseeAcsDimension,TennesseeAcsCategory,TennesseeAcsCountyMarginal,TennesseeAcsProvenance} from './acs-2024.js';
export {CensusPopulationDataUnavailableError,getTennesseeAcs2024CountyMarginals,getTennesseeAcs2024Provenance} from './acs-2024.js';

export type {TennesseeAcsCompositionSourceProvenance} from './acs-2024.js';
export {getTennesseeAcs2024CompositionSourceProvenance} from './acs-2024.js';
