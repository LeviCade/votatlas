# Votatlas — The Election Sandbox

**Every election. Every map. Every possibility.**

Votatlas is a map-first, **candidate-neutral election simulation laboratory**. Explore official historical results or design clearly labeled hypothetical elections with custom candidates, demographic cohorts, turnout, and geographic controls at national, state, county, district, and (where supported) precinct scopes.

## What makes it different
- Any candidate lineup, including nonpartisan and multiparty elections; never assume two parties.
- The same adjustment controls apply to a geographic selection at different levels.
- A panoramic interactive county map, live scoreboard, contextual controls, and shareable scenarios.
- Exact baseline reproduction, deterministic calculations, explicit data provenance, and clearly disclosed model uncertainty.

## Project status — November 15, 2026
**Round Four integrated — Tennessee multi-scope election sandbox.** Real 95-county Census boundaries, candidate-neutral custom candidates, scoped county/multi-county/statewide adjustments, Undo/Reset, and canonical v2 portable scenario projects are verified by desktop/mobile browser CI. An experimental **synthetic-only** disjoint demographic cohort engine is also available in sim-core; demographic UI and model-file persistence are planned for Round Five. The county presidential totals currently displayed remain **FICTIONAL**, not official historical returns. Owner-supplied 2024 source PDFs reconcile for 95 counties and 1,862 precincts, but the historical fixture is **BLOCKED** pending independent upstream authentication, reuse/scope approval and missing ballot-category review (Issue #20). Main is not released; license/data rights gate #5 OPEN. See [source retrieval requests](docs/SOURCE_RETRIEVAL_REQUESTS.md).

## Engineering entry points
- [Product vision](docs/PRODUCT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contracts](docs/CONTRACTS.md)
- [Roadmap](docs/ROADMAP.md)
- [Testing/acceptance](docs/TESTING_AND_ACCEPTANCE.md)
- [Ownership/integration rules](docs/ENGINEERING_OWNERSHIP.md)
- [Live conductor handoff](docs/CONDUCTOR_HANDOFF.md)
- [Research provenance](docs/RESEARCH_NOTES.md)

## Three-engineer launch
Engineer 1: `apps/web/`, `packages/map/` — UI and maps.  
Engineer 2: `packages/sim-core/` — deterministic candidate-neutral math.  
Engineer 3: `packages/data/`, `scripts/`, `.github/workflows/` — synthetic fixtures, ingestion and CI.  
Conductor: `packages/contracts/`, root workspace/build files, acceptance, reviews and merges.

All engineer PRs target `integration`. Read the pinned conductor handoff and the relevant dispatch in `prompts/` before touching code.

## Rights and data
Votatlas is independently implemented. ElectIndex research is used solely as a behavioral/UI reference; do **not** commit its proprietary JavaScript, data exports, or branded assets without documented permission. Use license-reviewed independent sources and synthetic data for early tests. Votatlas is **not** an election forecast, official election platform, or representation of actual voter preferences in hypothetical scenarios.

**Code license:** to be selected and added by the repository owner before outside contributions or release. Public visibility alone does not grant reuse permission.
