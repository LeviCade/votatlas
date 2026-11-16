# Votatlas — live Tennessee synthetic election sandbox (Round Two)

The React workbench consumes `getTennesseeSyntheticFixture()` from `@votatlas/data` and uses `simulateElection`, `appendAction`, `undoLastAction`, `serializeScenario`, and `parseScenario` from `@votatlas/sim-core`.

**Every vote is fictional.** County GEOIDs and names come from the Census 2020 reference; ballots are invented and never claim to be actual election returns.

## Commands (after conductor updates root pnpm-lock.yaml)

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @votatlas/web exec playwright install --with-deps chromium
pnpm --filter @votatlas/web test:smoke
```

Playwright emits `votatlas-live-sandbox.png` in desktop and mobile test-result directories; the GitHub `web-smoke` workflow uploads these artifacts.

## Ownership and integration

- E1 owns `apps/web/**`, `packages/map/**`. Conductor owns root lockfile and release integration.
- A `SandboxSession` holds the canonical scenario and engine-generated result. Every action is appended immutably, simulated and validated before React state updates. No component computes simulated votes.
- The UI has local/state scopes, transfer, share and turnout commands, Undo, exact Reset, JSON export/download and validated JSON import. Invalid inputs leave the prior session unchanged.
- All 95 counties are available in the searchable keyboard-navigable list and in a labeled **NON-GEOGRAPHIC** interactive tile atlas. It does not misuse local schematic index coordinates as longitude/latitude.
- When E3 publishes the promised `getTennesseeRealCountyGeoJSON()` export with independently sourced 95 WGS84-compatible polygons, the map presentation can switch to the existing MapLibre renderer. The optional provider is detected at runtime; no hard dependency on an unmerged E3 API.
- The MapLibre data adapter colors by candidate ID and presents leader/tie/no-data colors, using the engine's live result.
- Candidate editing and demographics remain explicitly disabled where modeling/contracts are incomplete; no ElectIndex code or geography is copied.

## Native proof requirements

Use the Playwright screenshots and actual job URLs, not green claims inferred from committed test code. Tests assert county-local transfer, statewide rollup changes, undo/reset, scenario export/import, invalid error paths, and 2/3/5 candidate render support.
