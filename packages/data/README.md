# Votatlas Data — Tennessee synthetic proof of concept

**Use:** `import { getTennesseeSyntheticFixture, getTennesseeProvenance, createTennesseeSchematicGrid } from '@votatlas/data';`

- `getTennesseeSyntheticFixture()` returns a fresh validated `ElectionDataset` compatible with the canonical `@votatlas/contracts` `ElectionDefinition` + `BaseUnitResult[]`. **All vote counts, eligible-voter counts and candidate identities are fictional.** Rows are sorted by five-character GEOID.
- `getTennesseeCountyReferences()` provides all 95 official 2020 Tennessee county GEOIDs and names; the source is the U.S. Census Bureau 2020 code file (see `fixtures/provenance.json`). The official FIPS IDs are used *only* to connect synthetic votes to geography.
- `getTennesseeProvenance()` supplies versioned publisher, vintage, rights and attribution for each of the identifier, ballot and preview sources. SHA-256 of the actual committed fixture bytes is checked in CI.
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
```

To regenerate on purpose, run `node scripts/generate-tennessee-fixture.mjs --write`; review the exact diff to the fixture and manifest SHA before committing. `--check` compares bytes with the deterministic generator. The CI check additionally loads the built validator.

## Data rights and source policy

U.S. Census Bureau 2020 county identifiers: <https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt>. This U.S. federal government-authored material is not copyright-protected under 17 U.S.C. §105; cite the Census Bureau. The reference contains neither observed election results nor demographics. The generated ballots and schematic geometry are original Votatlas examples. Their code/artifact reuse is governed by the project's still-pending repository license decision. This package contains **no** ElectIndex code, map data or results.

**Actual county polygons are not included in round one.** Production boundary source candidate: U.S. Census 2024 cartographic boundaries (TIGER/Line®), https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html. Conductor must review redistribution and the Census trademark/attribution disclaimer before publishing an extracted, simplified version. Do not mislabel schematic tiles as geographical shapes. The Census Bureau states that its boundary products are statistical and **not** legal land descriptions.

## Future geography-vintage crosswalk design (not implemented)

Maintain `(sourceVintage, sourceGeoId, targetVintage, targetGeoId, weightBasis, weightNumerator, weightDenominator, sourcePublisher, sourceURI, rights)` mappings. Require a disjoint/complete target partition for each source unit or explicitly flag incomplete overlaps. Historical precinct and district boundaries require separate vintage-specific intersections and disclosure of areal/population-weighted estimation; never imply counties nest perfectly within districts or silently translate between vintages. Validate FIPS history and geographic identity changes before replay; preserve original source-vintage identifiers even when rendering contemporary shapes. Fractional weights must be reconciled to atomic integer ballots with fixed deterministic tie-breaking.
