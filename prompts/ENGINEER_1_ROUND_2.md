# 🎨🗺️ VOTATLAS — ENGINEER 1, ROUND TWO: LIVE SANDBOX

Repository: LeviCade/votatlas.
Branch: feature/v0.1-r2-e1-live-ui.
PR target: integration.
Start from the new conductor-specified integration SHA; confirm the branch head before changing files.
Read README, docs/CONDUCTOR_HANDOFF.md, docs/PRODUCT_VISION.md, docs/ARCHITECTURE.md, docs/CONTRACTS.md, docs/TESTING_AND_ACCEPTANCE.md, docs/ENGINEERING_OWNERSHIP.md, canonical TypeScript contracts, and Issue #10.

Ownership: apps/web/** and packages/map/** ONLY. The conductor owns root pnpm-lock.yaml and contracts. Coordinate dependency additions early.

## Mission: make the app actually simulate
Current App.tsx merely queues Adjustment actions against a 10-county demo with immutable totals. Replace that with the E3 95-county canonical synthetic fixture AND the E2 pure simulateElection engine. Show a working, responsive map-first sandbox.

## Required end-to-end operations
1. Import getTennesseeSyntheticFixture from @votatlas/data and simulateElection/appendAction/undoLastAction/serializeScenario/parseScenario from @votatlas/sim-core. Add these dependencies to apps/web/package.json; message conductor immediately for lockfile regeneration. Do NOT modify root lockfile yourself.
2. Create a controlled Scenario object in React: start empty; recalculate SimulationResult on every action; use explicit state and typed errors; never compute candidate votes inside presentation code.
3. Replace the 10-county mock with the full 95-county dataset in scoreboard and searchable county list. Candidate registry is E3's aster/briar/cedar; do not retain the old beacon/cypress IDs.
4. County selection -> TRANSFER_PP moves e.g. five percentage points from Aster to Cedar; selected county totals and statewide totals update; all other counties remain unchanged. Use engine output for map colors, legend, selected county and result panel.
5. Add Undo, Reset and Save/Load JSON UI. Exact reset returns every original county count; scenario JSON round-trip reproduces the same numeric outputs, with import validation and useful errors.
6. Preserve clear synthetic badges, WebGL unavailable fallback, mobile layout and keyboard selection.
7. Coordinate with E3 on real Census county geometry. Never render E3's local-index schematic grid as longitude/latitude. A labeled temporary 10-tile map is acceptable while awaiting E3, but 95-county county list and results are mandatory. Complete actual 95-county map integration once E3 provides the GeoJSON.
8. Update Playwright tests to assert actual changed values and undo/reset, not a queued-action warning; capture real desktop and mobile screenshots; keep current map tests green.

No unverified demographic controls and no raw ElectIndex source reuse. Do not hardcode party IDs or assume two candidates. Open an incremental PR into integration with exact SHAs, tests, browser evidence, and remaining gaps. You do NOT merge your own PR.

Success is an actual numeric result changing from a county edit, not a prettier preview.
