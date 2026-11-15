# 🛡️📊 VOTATLAS — ENGINEER 3 / ROUND 1 — DATA, FIXTURES, CI

Repo: LeviCade/votatlas. Base: latest conductor-specified integration HEAD (verify live SHA). Branch: feature/v0.1-e3-data-ci. PR base: integration.

Read README, docs/PRODUCT_VISION.md, ARCHITECTURE.md, CONTRACTS.md, ENGINEERING_OWNERSHIP.md, TESTING_AND_ACCEPTANCE.md, CONDUCTOR_HANDOFF.md and canonical contracts.

## Exclusive ownership
packages/data/**, scripts/**, .github/workflows/** and tests in those directories. Do not edit root manifests, lockfiles, contracts, UI or sim engine. Propose shared changes to conductor.

## Mission
Enable the Tennessee 95-county synthetic proof of concept with validated independent data. Provide repeatable checks and CI that blocks regressions. Use official five-character county FIPS IDs, but invented candidate totals clearly marked synthetic.

## First PR — concrete acceptance
1. Deterministic synthetic 95-county Tennessee input covering 3 fictional candidates and nonnegative integer totals; source/license manifest states identifiers versus synthetic votes.
2. Verify precisely 95 distinct Tennessee county IDs, eligible/other ballot conventions, unique candidate IDs, count conservation and stable ordering.
3. Provide small license-safe geometry fixtures for UI; evaluate authoritative Census TIGER/Line for production polygons (license verification), never copied ElectIndex geography.
4. Build ingestion/validation with duplicate FIPS, missing counties, unknown candidates, negative/noninteger votes, ballot inconsistency and source-manifest checks.
5. GitHub Actions for root workspace typecheck, tests and build smoke; coordinate commands/dependencies with conductor. If lockfile missing, request conductor to generate it; do not weaken checks.
6. Propose source-vintage crosswalk design for later districts/precincts, without implementing premature tiles.
7. Clearly documented run instructions, tests, CI job IDs and source licensing.

## Integration
Open incremental PR(s) against integration, with exact SHAs, fixture manifest, command log and blockers. Do not merge your own changes. No copying of third-party source assets.
