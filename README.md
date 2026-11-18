# Votatlas — The Election Sandbox

**Every election. Every map. Every possibility.**

Votatlas is a map-first, **candidate-neutral election simulation laboratory**. Explore official historical results or design clearly labeled hypothetical elections with custom candidates, demographic cohorts, turnout, and geographic controls at national, state, county, district, and (where supported) precinct scopes.

## What makes it different
- Any candidate lineup, including nonpartisan and multiparty elections; never assume two parties.
- The same adjustment controls apply to a geographic selection at different levels.
- A panoramic interactive county map, live scoreboard, contextual controls, and shareable scenarios.
- Exact baseline reproduction, deterministic calculations, explicit data provenance, and clearly disclosed model uncertainty.

## Project status — November 17, 2026
**Round Six integrated — source-backed demographic composition with hypothetical election modeling.** Votatlas now uses original U.S. Census Bureau 2024 ACS 5-year county population estimates for all 95 Tennessee counties: B01001 age 18+ (5,499,414 residents) and B15003 education 25+ (4,870,330 residents). Its map-first Model Lab lets users select one population marginal, choose explicit hypothetical electorate weights, and model candidate support and turnout through the deterministic simulation engine. Source provenance and current-profile fingerprints are checked on project restoration; canonical v3 projects preserve the modeled result. **These ACS figures describe residents, not voters or ballots. All Tennessee election ballots remain fictional, and every demographic preference/turnout assumption is hypothetical.** Age 18+ and education 25+ are different overlapping population universes, never a joint table. The Tennessee 2024 presidential election fixture remains blocked under Issue #20; code/data-rights gate #5 remains OPEN; main is unreleased. See [ACS source method](packages/data/ACS_2024_SOURCE_METHOD.md) and [source retrieval requests](docs/SOURCE_RETRIEVAL_REQUESTS.md).
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
