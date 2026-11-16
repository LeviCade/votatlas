# 🛡️🗺️ VOTATLAS — ENGINEER 3, ROUND TWO: REAL TENNESSEE COUNTY MAP

Repository: LeviCade/votatlas.
Branch: feature/v0.1-r2-e3-real-tn-map.
PR target: integration.
Start from latest conductor kickoff SHA; verify first.
Read conductor handoff, roadmap/ownership/acceptance, E3 README, existing data scripts and Issue #12.

Ownership: packages/data/**, scripts/** and .github/workflows/** ONLY. No app/map/simulation-contract/root edits.

## Mission
Round One established 95 real county FIPS IDs and **fictional** ballot counts, but geometry is a deliberately fake local grid. Replace that display tier with independently sourced, license-reviewed actual Tennessee county polygons suitable for MapLibre GL.

## Acceptance
1. Retrieve official Census cartographic boundary or TIGER/Line county geometry, ideally vintage 2020 to match identifiers/fixture. Extract Tennessee (STATEFP=47) and preserve all 95 full five-character GEOIDs; record exact source URL, vintage, rights, transformations, checksum.
2. Produce a bounded-size WGS84 longitude/latitude GeoJSON FeatureCollection of real Polygon/MultiPolygon county boundaries; use a reproducible conversion/simplification script. Do not include non-Tennessee features and do not assume every feature is a single ring.
3. Validate 95 unique identifiers, precise match to existing fixture list, valid bbox range, finite lon/lat, closed rings and minimum coordinate lengths. No duplicated/missing counties. Provide test and generated-byte manifest.
4. Provide a clearly named typed export for the E1 MapLibre adapter. Separate actual geography from createTennesseeSchematicGrid(), which must remain labeled as NON-GEOGRAPHIC.
5. Update data README/provenance to distinguish actual geography, synthetic vote counts and 2020 county identifiers. Include Census attribution and note statistical, nonlegal nature of boundaries. Do not copy any geometry or source from ElectIndex.
6. Keep existing 17-source-regression tests, full native CI and reproducibility checks passing.
7. Coordinate with E1 on shape of properties/feature IDs; offer a small GeoJSON sample and expected bbox early so E1 can integrate without waiting for final file.

Open a PR into integration with exact source provenance, changed files, tests, artifact size, and a screenshot or geo validation report. No direct merge. No unrelated data expansion yet.
