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


## Tennessee 2024 historical presidential election: release gate

Official primary: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyCounty.pdf (Tennessee SOS, December 2, 2024, printed pp. 1-2). Independent statewide by-office original: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf. The seven named ticket totals are 1,966,865; 1,056,265; 5,865; 3,457; 988; 21,535; 8,967, totaling 3,063,942. This denominator is ONLY the seven printed candidate tickets, not ballots cast, and excludes write-ins. The official county table does NOT report county write-in totals. A secondary atlas lists 8,682 write-ins, 3,072,624 presidential votes including write-ins and 3,090,161 ballots cast; these are unverified leads, NOT source-certified county data. No missing numbers become zero: zero otherBallots in a PROPOSED seven-ticket-only model means no other categories included, not zero actually cast. Historical eligibleVoters is always null.

The source parser requires original PDF bytes and pdftotext -layout, all 95 exact county names/GEOIDs, ordered rows, seven integers per row, agreement with the printed statewide total and the independent by-office SOS results. It reports original file SHA-256, proposed fixture SHA-256 and exact vote totals. Run: node --test scripts/tn-2024-sos-validation.test.mjs ; node scripts/generate-tennessee-2024.mjs --check ; node scripts/generate-tennessee-2024.mjs --audit --source /path/to/official.pdf. The feature-branch GitHub source-audit workflow downloads and parses the original official file. Its audit output does not publish data. The historical API getTennessee2024PresidentialFixture() throws HistoricalElectionUnavailableError until source and rights are approved; provenance is exposed through getTennessee2024PresidentialProvenance(). Synthetic ballots and geometry are unchanged.

Rights: Tennessee SOS documents are not automatically federal public domain under 17 USC 105. The original PDF is not redistributed. Factual vote counts are uncopyrightable facts under 17 USC 102(b) and Feist; nonetheless Tennessee site usage terms and data-release signoff are pending conductor review. The machine-readable manifest holds the no-go status, source URLs, row/reconciliation semantics and rights assessment.

## Round Four — owner-supplied SOS report audit (2026-11-15)

**Reconciliation succeeded, release remains BLOCKED.** The repository owner supplied two original-format Tennessee SOS reports for the November 5, 2024 State General election: `20241105GeneralbyCounty.pdf` (28 pages, 150,933 bytes) and `20241105GeneralbyPrecinct.pdf` (225 pages, 1,626,347 bytes). The reports print December 2, 2024. Their embedded creation metadata reads November 25, 2024; do not confuse either timestamp with an independently verified certification date.

- County PDF SHA-256: `bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f`.
- Precinct PDF SHA-256: `5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b`.
- Stable seven-ticket county row JSON SHA-256: `7d32c6e7067222a41a094475a0746c6e178b0ffb80e30542a8e321ac9743fbcf`.
- `95/95` county rows agree between the PDF reports, each with seven columns and complete 2020 Census county GEOID mapping. `1,862` precinct results individually sum to their 95 reported county subtotals. Statewide independent totals per ticket: `1,966,865; 1,056,265; 5,865; 3,457; 988; 21,535; 8,967`; seven-ticket sum `3,063,942`.
- Seven printed tickets **exclude** write-ins. County write-in results, presidential undervotes, total ballots cast and eligible-voter denominators are not reported in these seven candidate columns. They remain **unknown**, not zero. No external atlas counts are mixed into primary-source observations.

Both primary source URLs are linked in `tennessee-2024-provenance.json`. The SOS publisher's linked reports were independently readable as indexed text, matching their headings and printed vote totals, but **original publisher PDF binary retrieval returned HTTP 403 in automation**. The two user-supplied PDFs are now pinned by SHA-256; their **byte identity with a fresh original SOS-domain download is NOT proven**. A self-contained hash proves later files match the user-supplied inputs, not that a government server signed them. This is a source-authentication gate, not a statement that the totals are fictional. Raw PDFs are **not committed or redistributed**; the conductor must explicitly approve usage terms/rights, authoritative-byte authentication and seven-ticket-only scope before opening historical API access.

Reproduce locally with both original PDFs available, Node 22 and Poppler's `pdftotext`:

```sh
node --test scripts/tn-2024-sos-validation.test.mjs
node --test scripts/tn-2024-precinct-validation.test.mjs
node scripts/generate-tennessee-2024.mjs --check
node scripts/audit-tennessee-2024-supplied.mjs --county /path/20241105GeneralbyCounty.pdf --precinct /path/20241105GeneralbyPrecinct.pdf
```

The audit prints checksums and numerical evidence only; it never writes an approved fixture. Negative tests exercise header/candidate mislabeling, missing and duplicate counties, altered counts, incomplete columns, cross-county swaps and GEOID matching. The publication helper also refuses `--write` unless independent official-byte verification and conductor rights approval are expressly recorded AND the precinct report reconciles. CI without user files tests the parser and confirms the no-go gate; **a green CI run alone does not attest the PDFs**. Do not mark Issue #20 completed or deliver an official fixture until the separate provenance and rights signoffs are documented.

## Round Five historical original-source authentication

The seven-ticket by-office SOS publisher-indexed text independently confirms the 3,063,942 reported total. This is **not** proof of original government file-byte identity. See [SOURCE_AUTHENTICATION_2024_R5.md](SOURCE_AUTHENTICATION_2024_R5.md) for precise source evidence, unknown categories, rights analysis, two required additional original files and reproducible auditor commands. The historical fixture and getter remain BLOCKED.

## 2024 Census ACS county demographic population marginals

The source-verified 2024 ACS 5-year B01001 adult age 18+ and B15003 educational attainment age 25+ **resident population** marginals are available through the typed immutable getters in src/acs-2024.ts, with all 95 county GEOIDs and full Census-source SHA-256 provenance. See [ACS_2024_SOURCE_METHOD.md](ACS_2024_SOURCE_METHOD.md) for exact variable mapping, distinct universes, original MOE sentinel treatment and official-source reproduction. **These are not voters, ballots, turnout, eligible persons, or observed support.** The separate 2024 Tennessee SOS historical election getter stays blocked.
