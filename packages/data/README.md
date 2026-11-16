# Votatlas Data — Census 2020 geography + fictional election ballots

**Use:** `import { getTennesseeSyntheticFixture, getTennesseeRealCountyGeoJSON, getTennesseeGeometryProvenance } from '@votatlas/data';`

- `getTennesseeSyntheticFixture()` returns a fresh validated `ElectionDataset` compatible with the canonical `@votatlas/contracts` `ElectionDefinition` + `BaseUnitResult[]`. **All vote counts, eligible-voter counts and candidate identities are fictional.** Rows are sorted by five-character GEOID.
- `getTennesseeCountyReferences()` provides all 95 official 2020 Tennessee county GEOIDs and names; the source is the U.S. Census Bureau 2020 code file (see `fixtures/provenance.json`). The official FIPS IDs are used *only* to connect synthetic votes to geography.
- `getTennesseeProvenance()` supplies versioned publisher, vintage, rights and attribution for each of the identifier, ballot and preview sources. SHA-256 of the actual committed fixture bytes is checked in CI.
- `getTennesseeRealCountyGeoJSON()` returns fresh, actual 2020 Census Tennessee county Polygon/MultiPolygon features in `[longitude, latitude]` coordinate order. All 95 feature IDs and `properties.geoId` exactly join the fictional election's `units[].geoId`. E1's `@votatlas/map` `paintCounties` consumes this directly; never attach ballot data to the geometry.
- `getTennesseeGeometryProvenance()` includes Census source vintage, mirror pin, processing parameters, byte checksum, and cartographic limitations.
- `createTennesseeSchematicGrid()` creates 95 deterministic **NON-GEOGRAPHIC** click-target polygons for isolated UI tests. Coordinates are local tile indices, **NOT** longitude/latitude or real Tennessee boundaries. UI must label this visibly as a schematic rather than feeding it to a real geographic map.
- `validateElectionDataset(unknown, {requiredGeoIds,expectedStateId})` validates imported ballots, candidate registries, totals, source state, strict sorting and complete county coverage. `validateProvenanceManifest(unknown,dataset)` validates version and rights metadata. Neither function mutates its input.

## Reproducibility

After conductor commits a compatible root lockfile (`pnpm@9.15.9`):

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/check-fixtures.mjs
node scripts/check-tennessee-geometry.mjs
node --test scripts/geometry-validation.test.mjs
node scripts/generate-tennessee-geometry.mjs --check
```

To regenerate on purpose, run `node scripts/generate-tennessee-fixture.mjs --write`; review the exact diff to the fixture and manifest SHA before committing. `--check` compares bytes with the deterministic generator. The CI check additionally loads the built validator.

## Data rights and source policy

U.S. Census Bureau 2020 county identifiers: <https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt>. This U.S. federal government-authored material is not copyright-protected under 17 U.S.C. §105; cite the Census Bureau. The reference contains neither observed election results nor demographics. The generated ballots and schematic geometry are original Votatlas examples. Their code/artifact reuse is governed by the project's still-pending repository license decision. This package contains **no** ElectIndex code, map data or results.

## Real geographic boundary source, usage and reproducibility

**The live map tier now includes actual 2020 Tennessee county outlines — 95 real counties, 95 election-data joins.** The authoritative original product is [U.S. Census Bureau 2020 Redistricting TIGER/Line county20, Tennessee](https://www2.census.gov/geo/tiger/TIGER2020PL/LAYER/COUNTY/2020/tl_2020_47_county20.zip). The conversion input is a pinned [third-party mirror of the 2020 Census county20 GeoJSON](https://github.com/Tenjin25/TNRealignmentMap/blob/030bcf3abfe92c3df5fef101d06899a9fe812fc4/VTDs/tl_2020_47_county20/tl_2020_47_county20.geojson), **not** an official Census-hosted GeoJSON. The pinned conversion source's Git blob SHA-1 is `96bec1fe4d0569557b54ac5d77e7995068d76e48`; the exact original Census ZIP and mirror provenance are both documented in `fixtures/tennessee-geometry-2020.provenance.json`.

The independently implemented converter reads the pinned Census-derivative geographic source, verifies its content hash and Tennessee 2020 IDs, simplifies closed Polygon/MultiPolygon rings using deterministic two-chain Ramer–Douglas–Peucker at 0.00015 degrees (approximately 15–17 meters), rounds coordinates to six decimal places and sorts features by five-character GEOID. The generated UTF-8 GeoJSON is `fixtures/tennessee-counties-real-2020.geo.json`: **955,123 bytes**, **41,363 positions**, **95 counties**, **5 multipart features**, **4 interior rings**, bounding box **[-90.310455, 34.983020, -81.646900, 36.678255]**. SHA-256: `5ee11ec39c9bce7116ccfb2405fae4a955e1f25c7dd9bb178e8dd24ab52e65bb`. No geometry/vote combination is committed; the join is via `feature.id = feature.properties.geoId = unit.geoId`.

```sh
# Offline fixture verification (also runs in standard GitHub Actions)
node scripts/check-tennessee-geometry.mjs
node scripts/generate-tennessee-geometry.mjs --check
node --test scripts/geometry-validation.test.mjs

# Re-fetch pinned 2020 Census-derived mirror and assert byte-identical GeoJSON (network)
node scripts/generate-tennessee-geometry.mjs --check-source

# Explicitly regenerate both output and its SHA-256 manifest (network; review diff)
node scripts/generate-tennessee-geometry.mjs --write
```

**Source vs. model status:** only county boundaries and identifiers are sourced from the Census Bureau; election candidates, votes and eligible counts remain *fully fictional*. The source coordinates are geographic NAD83 (EPSG:4269), used as WGS84-compatible lon/lat for small-scale MapLibre visualization. This is not a surveyed high-accuracy datum transformation. Simplification operates independently on each county ring; it can create small slivers or shape deviations around shared borders, and is not suitable for topological intersection, adjacency, area/perimeter calculations, property/title questions or geocoding. For those purposes obtain raw Census data. The original source is U.S. federal government-authored data (17 U.S.C. §105), reusable with attribution. **Source: U.S. Census Bureau, 2020 Census P.L. 94-171 TIGER/Line® county boundaries; simplified by Votatlas.** TIGER/Line® is a Census Bureau registered mark, not Votatlas branding. The Census Bureau does not warrant exact positional or legal boundary accuracy, and does not endorse this product. This package contains no ElectIndex geographic assets.

**MapLibre join contract:** `getTennesseeRealCountyGeoJSON()` exposes standards-compatible features with `id: "47037"`, `properties: { geoId: "47037", name: "Davidson County" }`, `geometry: { type: "Polygon" | "MultiPolygon", coordinates: ... }`. E1's MapLibre source can use `promoteId: "geoId"` and `paintCounties(...)`. The schematic function remains unchanged and explicitly nongeographic.

## Future geography-vintage crosswalk design (not implemented)

Maintain `(sourceVintage, sourceGeoId, targetVintage, targetGeoId, weightBasis, weightNumerator, weightDenominator, sourcePublisher, sourceURI, rights)` mappings. Require a disjoint/complete target partition for each source unit or explicitly flag incomplete overlaps. Historical precinct and district boundaries require separate vintage-specific intersections and disclosure of areal/population-weighted estimation; never imply counties nest perfectly within districts or silently translate between vintages. Validate FIPS history and geographic identity changes before replay; preserve original source-vintage identifiers even when rendering contemporary shapes. Fractional weights must be reconciled to atomic integer ballots with fixed deterministic tie-breaking.
