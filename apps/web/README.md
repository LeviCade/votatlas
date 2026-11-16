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


## R5 — Synthetic Model Lab (explicitly hypothetical)

The **Model Lab** control category is opt-in and shows an acknowledgment that no
real demographic voting preferences, measured cohort counts, polls, or 2024
historical returns are in use. This tab is distinct from the ordinary candidate
editor and from the current real Census 95-county geography.

- The **only** production demo partition is produced by the
  `@votatlas/sim-core` **`createSyntheticDemoPartition`** export, given the
  current post-classic engine result and candidate registry. E1 does not
  generate demographic data, assume age/race preferences, or combine overlapping
  demographic marginals. The partition must reconstruct every selected county,
  candidate vote and other-ballot category before actions begin.
- Model actions are `COHORT_TRANSFER_PP` (candidate-ballot percentage points)
  and `COHORT_TURNOUT_SCALE` (full-ballot multiplier), using exactly the same
  county/multi-county/Tennessee state scopes as the ordinary workbench. The
  authoritative `simulateCohortPartition` package provides every new county
  result and then runs the existing election engine. No UI election math or
  alternative simulator is introduced.
- The model is an atomic `{partition, actions, output}` snapshot. Separate
  **Undo model action**, **Reset model edits**, **Exit Model Lab**, and the
  workbench's **Reset entire project** have different, explicit effects.
  Ordinary election actions and candidate registry modifications are blocked
  while the partition is active: otherwise the partition would silently refer
  to an obsolete post-classic baseline. Changing ordinary history requires
  exiting/resetting the synthetic model and opting in anew.
- Source/selected-area/statewide scoreboards, candidate leaders, and real
  MapLibre fill colors use the same `CohortSimulationResult.result`, with
  synthetic-only disclaimers. The Model Lab's group values compare current
  group cells with the **pre-model** partition, not with allegedly observed
  demographic returns. Transfers use candidate ballots only; modeled turnout
  checks each eligible-capacity cell and the original county.
- **Persistence gate:** The only possible v3 save path is
  `@votatlas/sim-core.createScenarioProjectV3` followed by the existing
  canonical `serializeScenarioProject`. The only load path is the canonical
  `restoreScenarioProject` with the trusted E3 fixture, never an E1-authored
  fallback codec. Until the E2 R5 feature is integrated, model generation and
  v3 saving are disabled with explicit messaging. Ordinary v1/v2 import/export
  remains unchanged while no model is active; *model-active* v2 save is
  intentionally prohibited so cohort actions cannot silently vanish.
- The existing traditional election state can include added or renamed
  hypothetical candidates and prior ordinary actions before model creation.
  A restored v3 model must reproduce both the standard intermediate state and
  the final cohort-modeled result.

### Browser acceptance

`pnpm --filter @votatlas/web test:smoke` runs desktop/mobile Chromium
including Model Lab source labeling, opt-in, three-county cohort transfers,
statewide modeled turnout, custom candidates, model Undo/Reset and canonical
v3 source-mismatch rejection. When the E2 generator has **not** landed, these
browser tests explicitly verify the visible unavailable gate instead of
inventing model data; **this is not full functional acceptance**. Conductor
must run CI again after integrating E2's canonical v3 API and verify real
model actions and screenshot attachments before merging E1.

All source election totals are invented, **not** actual voting records.
The map uses independent U.S. Census geometry but makes no subgroup inference.
