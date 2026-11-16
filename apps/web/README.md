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


## Round Three: candidate registry and portable projects

- **Candidate editor**: open **Candidates** to add a fictional candidate with stable ID/name/color and optional affiliation. New candidates begin with zero source ballots, across all 95 counties. Rename preserves the stable ID and baseline. Protected original candidates cannot be deleted; hypothetical removals are refused if history, current votes, or deterministic replay would be lost.
- **Source versus scenario**: `getTennesseeSyntheticFixture()` remains the one trusted source. The UI session tracks an extended election definition and zero-extended source rows separately, with immutable typed actions and a `SimulationResult` always computed by `@votatlas/sim-core`. Reset discards all hypothetical edits and returns to exact original source.
- **V2 portable project**: **Export JSON** saves source fingerprint, added/renamed candidates and ordered actions; **Import JSON** restores them from a caller-supplied trusted fixture. Legacy v1 action-only JSON still imports for the original source registry. No file may replace raw source vote rows; invalid/oversized files are rejected atomically.
- **E2 integration**: `apps/web/src/portable.ts` selects the canonical `createScenarioProject`, `serializeScenarioProject`, and `restoreScenarioProject` API from Engineer #2 once merged. An isolated, strict bridge implementation keeps E1 working before that shared PR lands. After E2 merges, canonical project SHA-256 source fingerprint and history-aware removals take precedence.
- **Real Census geometry**: `MapCanvas` uses E3's 95-feature geographic GeoJSON. With `?e2e=1` only, a read-only `window.__votatlasMapForE2E.inspectCounty(geoId)` diagnostic exposes the actual MapLibre `county-geometry` source features, paint expression, current zoom and rendered feature presence. This diagnostic never calculates ballots and is absent from regular sessions.

### Round Three acceptance commands

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @votatlas/web exec playwright install --with-deps chromium
pnpm --filter @votatlas/web test:smoke
```

Native browser acceptance **does not** rely on scoreboard text alone: selecting Davidson and transferring **7 percentage points** Aster→Cedar must change `querySourceFeatures("county-geometry")` for `47037` from `winnerCandidateId: "aster", fill: "#7544A6"` to `winnerCandidateId: "cedar", fill: "#B47F15"`, with MapLibre layer expression `["get","fill"]`, a rendered county feature, and stable zoom. Playwright emits desktop/mobile `davidson-aster-real-map.png`, `davidson-cedar-flip-real-map.png`, and `custom-candidate-editor.png` as CI workflow attachments.

Source returns remain **synthetic**; county outlines are **2020 U.S. Census-derived**. There is no official 2024 return selector until E3 can prove independent authoritative provenance and reconciliation. Demographics are disabled and this site is not a forecast.
