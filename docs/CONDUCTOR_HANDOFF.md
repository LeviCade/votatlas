# Votatlas — Living Conductor Handoff

## LATEST CHECKPOINT — 2026-11-15 / Round One completed, Round Two prepared

Repository: https://github.com/LeviCade/votatlas (public).
Default branch: main (not yet promoted; foundation only).
Working branch: integration.
Last verified integration code SHA before this checkpoint: 1de74c9a6a021052dac381a41d929e716cd5c7ae.
This documentation checkpoint itself will advance integration. Always retrieve LIVE branch head before dispatch or merge. Do not assume the SHA printed above is current.

### Verified accepted PRs
- PR #9 conductor pnpm lockfile, squash SHA 3c5bc363264969910410959e99b36b844e29d4ca. Bootstrap workflow generated lockfile and was deleted. Pin pnpm 9.15.9.
- PR #7 Engineer 3 data, 95 TN synthetic county results + source rights/validation/CI, squash SHA 306fc7304d27a5f69bb196740b1c24c5e7bd32bc.
- PR #8 Engineer 2 candidate-neutral pure simulator, squash SHA e9a5285bf6b096dda220ba154058e8b2175d4c17.
- PR #6 Engineer 1 map-first React/MapLibre workbench, squash SHA 1de74c9a6a021052dac381a41d929e716cd5c7ae. Conductor fixed incompatible maplibre.supported API call and added separate web-smoke workflow.
- These four PRs merged to integration. No round-two feature PRs accepted yet. main is not a release.

### Verified CI
- Full workspace CI on final Round One integration SHA: https://github.com/LeviCade/votatlas/actions/runs/43791004727 (SUCCESS).
- Desktop/mobile Playwright on final Round One integration SHA: https://github.com/LeviCade/votatlas/actions/runs/43791004716 (SUCCESS).
- E3 validated 95-county fixture / 17 source regressions and full CI: https://github.com/LeviCade/votatlas/actions/runs/43790155354.
- E2 native workspace CI: https://github.com/LeviCade/votatlas/actions/runs/43790317300.
- E1 native workspace CI: https://github.com/LeviCade/votatlas/actions/runs/43790829022; browser smoke: https://github.com/LeviCade/votatlas/actions/runs/43790829008.

### VERIFIED BEHAVIOR / NOT YET WORKING
Works: all packages typecheck/test/build in CI; map workbench renders with ten intentionally schematic county tiles; simulated sample scoreboard and accessible selection; controls queue typed action and visibly say totals stay static; 95-county synthetic data package validated; engine separately calculates deterministic candidate-neutral adjustments.
NOT WORKING END TO END: UI is not yet connected to sim-core and 95-county fixture. Map doesn't yet show real Tennessee county polygons. Undo/reset/scenario import/export is not wired in the UI. No custom candidate builder or demographic controls are live. Never claim "playable Votatlas v0.1" until all required end-to-end gates pass.

### Round Two issues and prompt files
- Issue #10: E1 live UI wiring, prompt prompts/ENGINEER_1_ROUND_2.md.
- Issue #11: E2 dynamic candidate registry and multistep math hardening, prompt prompts/ENGINEER_2_ROUND_2.md.
- Issue #12: E3 real licensed 95-county geometry, prompt prompts/ENGINEER_3_ROUND_2.md.
- Issue #4: conductor end-to-end release gate (still OPEN).
- Issue #5: repository license and data rights (still OPEN).
- Planned Round Two branches: feature/v0.1-r2-e1-live-ui, feature/v0.1-r2-e2-core-hardening, feature/v0.1-r2-e3-real-tn-map. Branch only after reading LIVE integration head; all start from identical commit.

### Conductor's next critical actions
1. Coordinate required apps/web/package.json dependencies @votatlas/data and @votatlas/sim-core and regenerate pnpm-lock.yaml using real pnpm on GH-hosted runner after manifest updates. Never weaken frozen-lockfile CI.
2. Dispatch the three Round Two prompts at exact fresh integration SHA.
3. Review issues and PRs; only merge verified green source with ownership audit and license checks.
4. Prove 95-county real map with working selected-county candidate transfer, statewide rollup, undo/reset and JSON roundtrip in Chromium desktop/mobile.
5. Update this file after every accepted PR. Promote integration -> main only when release gate #4 passes.

### Ownership and rules
E1 apps/web/**, packages/map/**.
E2 packages/sim-core/**.
E3 packages/data/**, scripts/**, .github/workflows/**.
Conductor root workspace/pnpm lock, contracts, docs/prompts, integrator reviews and release governance. Avoid cross-owner edits except explicitly documented conductor integration repairs.
Do not commit proprietary ElectIndex source/data/images; use independent code and rights-reviewed public data.
Code license not chosen yet. No automated outside contributions or main release without decision.
Promote by passing verified gates, not percentages.

### Recovery for future conductor chats
1. Read this handoff, README, docs/ARCHITECTURE.md, docs/CONTRACTS.md, docs/ENGINEERING_OWNERSHIP.md, docs/TESTING_AND_ACCEPTANCE.md, and latest three round prompts.
2. Query live main/integration and PR heads; inspect CI jobs/logs. Never rely solely on past chat or checkpoint SHA.
3. Audit changed files against ownership, run/check tests, merge via integration, update this checkpoint with exact SHA and link.
4. Report precisely which v0.1 user journey is functional and what remains blocked.
