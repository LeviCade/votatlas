# 🎨🗺️ VOTATLAS — ENGINEER 1 / ROUND 1 — MAP-FIRST UI

Repo: LeviCade/votatlas. Base: latest conductor-specified integration HEAD (verify live SHA). Branch: feature/v0.1-e1-map-ui. PR base: integration.

Read README, docs/PRODUCT_VISION.md, ARCHITECTURE.md, CONTRACTS.md, ENGINEERING_OWNERSHIP.md, TESTING_AND_ACCEPTANCE.md, CONDUCTOR_HANDOFF.md, and packages/contracts/src/index.ts.

## Exclusive ownership
apps/web/** and packages/map/**, with tests in those directories. Never edit contracts/root manifests, E2 engine, E3 data/CI. Ask conductor for shared dependency/API changes.

## Mission
Deliver a working, map-first React interface reminiscent of the interaction pattern (NOT proprietary design/code) of the reference: panoramic map; compact top candidate scoreboard; geographic selector; right contextual editor; responsive controls; map selection and legend. The design must be candidate-neutral for 2, 3, 5+ candidates.

## First PR — concrete acceptance
1. React/Vite app shell with readable desktop/mobile layout, stable tokens and helpful initial/loading/error states.
2. MapLibre adapter rendering a small synthetic polygon fixture first, then consuming E3's Tennessee fixture when available; county select/hover/zoom.
3. Keyboard-accessible county selection via a list/search control when map is inaccessible.
4. Scoreboard, map legend and unit tooltips driven by mock data conforming to canonical SimulationResult contract.
5. Controls for Election, Candidates, Local, Demographics (disabled with explicit reason), and Style, emitting typed Adjustment actions through callbacks. Do NOT fake calculation or imply mock values are official.
6. Component tests/screenshots and a successful local build/typecheck. Use placeholder data only in explicitly labeled development fixtures.

## Integration
Create small PR(s) against integration; include exact base/head SHAs, changed paths, commands/results, screenshot, known gaps. No direct merge. Coordinate with E2 for action API and E3 for county fixture. Maintain no simulation logic inside the map layer. Stop any request to copy ElectIndex assets.
