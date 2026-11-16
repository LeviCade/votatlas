# Roadmap and Release Gates

## Stage 0 — Project foundation
Documentation, shared contract package, root workspace tooling, integration branch, three engineer ownership branches, initial GitHub issues, conductor handoff. **No arbitrary feature implementation during setup.**

## Stage 1 — Tennessee synthetic sandbox (v0.1)\n**Core integration achieved on 2026-11-15 (PRs #14–#17, CI green).** Final public release remains gated on license/rights approval and dedicated leader-flip browser verification.
- 95 county GEOIDs, validated synthetic vote counts/geometry, 3 editable candidates.
- MapLibre county map, click selection, contextual local adjustments, live per-county/state/national scoreboard.
- Candidate-neutral pure engine with SET_SHARE/TRANSFER_PP/TURNOUT_SCALE semantics, exact reset and scenario JSON roundtrip.
- Unit/typecheck/build/CI and one passing end-to-end vertical slice.
**Gate:** change county Candidate C support, observe map and state totals, undo/reset exactly, export/import exact scenario.

## Stage 2 — Historical data and election types
Independent authorized sources, immutable baselines, candidate registries, gubernatorial/Senate/presidential and primary rules as separate rulesets. Real geography and provenance.

## Stage 3 — Multi-geography
Nation, states, county multi-select, congressional-district vintage crosswalks, supported precinct data, correct splits across counties. Unified interactions at all supported scopes.

## Stage 4 — Demographic laboratory
Custom cohorts, transparent population universes, candidate preferences, turnout, joint/overlap treatment, simulated vs estimated distinction, uncertainty and calibration tests.

## Stage 5 — Public release quality
Scenario comparison, export/share, responsive/mobile/accessibility, stability/security/performance budgets, license and dataset provenance review.

Advance by demonstrated acceptance, not subjective percentage complete. CI red means no merge.
