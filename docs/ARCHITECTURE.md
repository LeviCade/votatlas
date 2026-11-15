# Architecture — Conductor ADR 0001

## Stack
TypeScript/pnpm workspaces; React and Vite for apps/web; pure TypeScript in packages/sim-core; MapLibre GL adapter in packages/map; validated fixtures and public data pipelines in packages/data; Vitest and Playwright; GitHub Actions.

## Ownership
- Conductor: repository root configuration, packages/contracts, architecture and integration.
- Engineer 1: apps/web and packages/map.
- Engineer 2: packages/sim-core.
- Engineer 3: packages/data, scripts and .github/workflows.
- Engineers do not edit another engineer's paths or conductor-owned files without explicit approval.

## Core invariants
All candidate votes are indexed by stable candidate ID, not by party affiliation. A zero-action scenario yields exactly the baseline integer totals. All state and national sums derive from one computed atomic-unit table. A controlled transfer preserves candidate ballots and other ballot categories. No negative, NaN or Infinity values. Replays are deterministic.

## v0.1 geographic model
County is atomic. County IDs are five-character FIPS/GEOID strings, not numbers. A state scope resolves to a deterministic set of county IDs. Nation is a collection of all included counties. Districts and precincts are explicitly unsupported until vintage-specific crosswalks or detailed atoms are available. Never pretend a congressional district nests fully inside one county.

## Adjustment semantics
- TRANSFER_PP: points are percent of candidate ballots in the selected scope, transferred from an explicit source candidate to a destination candidate. Reject transfers exceeding available source votes. Keep candidate ballot total unchanged.
- SET_SHARE: target share of candidate ballots in the selected scope; redistribution source must be explicit, either proportional other candidates or an explicit donor set. Reject impossible requests.
- TURNOUT_SCALE: multiplicative factor on modeled ballots, independently specified, with proportional candidate allocation in first release. State denominator convention explicitly in results.
- Action history is immutable and replayed in order. Only explicitly commutative operation classes may be canonicalized.
- Largest-remainder integer allocation with deterministic tie-breaking by sorted geo and candidate IDs, performed at atomic units before aggregation.
- Zero ballots mean no winner; top-vote tie means no unique winner. Electors only apply to elections that define them.

## Layers
1. Data: synthetic or licensed source datasets, boundaries, source manifests and GEOIDs.
2. Contracts: canonical types and scenario version.
3. Core: validated actions, atomic computation, rounding, deterministic rollups, undo/replay.
4. Geography: resolves selections into atomic IDs/weights.
5. Presentation: candidate-neutral map color, legend, scoreboard, editing controls.
6. Persistence: versioned scenario JSON; later IndexedDB and share links.

## Performance
Worker-ready pure compute; typed arrays and stable IDs; incremental recompute later; avoid shipping full nationwide polygon payload through reactive UI state every slider tick.

## Safety and rights
Validate all input and scenario imports; no executable scenarios or unsafe HTML; license-check all public datasets. ElectIndex source is solely investigative reference, not code for this repository.
