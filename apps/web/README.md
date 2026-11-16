# Votatlas map-first UI — Engineer 1

Owned paths: `apps/web/**` and `packages/map/**`. This is an **interactive development preview**, not a simulation or official electoral dataset.

## Run after a workspace install

```sh
corepack enable
pnpm install
pnpm --filter @votatlas/web dev
pnpm --filter @votatlas/map typecheck
pnpm --filter @votatlas/web typecheck
pnpm --filter @votatlas/map test
pnpm --filter @votatlas/web test
pnpm --filter @votatlas/web build
pnpm --filter @votatlas/web test:smoke
```

The Playwright smoke assumes a completed build and installed Chromium browser (`pnpm exec playwright install chromium`).

## Integration seams

- `Dashboard` takes `ElectionDefinition`, `SimulationResult`, geographic `CountyShapes`, and `onAdjustment(action: Adjustment)`.
- MapLibre is presentation only and does not run any simulated calculation. All colors use candidate IDs, not party positions.
- E2: wire the action callback to the pure simulator; replace mock `result` from the engine, and expose action history/undo/reset/export at the integration layer.
- E3: replace `src/fixtures/synthetic.ts` with independently licensed 95-county Tennessee geometry/results and verify GEOID matching. Current polygons are **schematic tiles**, not county shapes. Ownership of fixture source remains E3; discuss the loader contract before integrating.
- Candidate roster edits and demographic controls are blocked by missing contracts/model support; the UI does not pretend they work.

No network basemap, API token, copied ElectIndex asset, or actual election results are included. The font stylesheet is an optional Google Fonts request; system-font fallbacks remain if offline.

## Browser behavior

The map uses WebGL, with a bounded failure state and an independent, keyboard-accessible county search/list. On small screens, the right dock moves beneath the map. Candidate score, legend, and local detail all read the injected `SimulationResult`. Pending actions are clearly marked as **not applied** in this preview.

Playwright screenshots are written as test artifacts when the browser suite runs.
