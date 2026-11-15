# Votatlas — Living Conductor Handoff

## Checkpoint 0 — 2026-11-15
- Repository: https://github.com/LeviCade/votatlas (PUBLIC, created by owner, verified by connector).
- Foundation README commit: f49bb312189f068b7293df1254a2011c563fe462.
- Foundation documentation / contracts: committed as eedcbdad1d29fc89aaa7b966632763d57f4bb6b1.
- Branches created from eedcbdad1d29fc89aaa7b966632763d57f4bb6b1: main, integration, feature/v0.1-e1-map-ui, feature/v0.1-e2-candidate-engine, feature/v0.1-e3-data-ci. Subsequent checkpoint refresh will fast-forward all four to this handoff update.
- Engineers: E1 map/UI; E2 math; E3 synthetic data/CI.
- Accepted PRs: none. CI evidence: none. Running app: none. Do not claim otherwise.
- v0.1 target: 95-county synthetic Tennessee, three fictional candidates, local vote transfer, map+scoreboard updates, exact reset, JSON roundtrip.
- Design: candidate-neutral pure engine, typed scenario actions, county atoms and versioned future district/precinct crosswalks.
- External reference: ElectIndex Shuffler screenshots/HTML/reverse-engineering notes and publicly served source examined for behavior. These assets are NOT committed; independent code and license-reviewed data only.
- Outstanding product choice: project software license requires owner approval before outside contribution; code license not yet published.
- Round-one dispatch files published under prompts/. Engineer tracking issues #1, #2, #3; conductor integration issue #4; licensing/data gate #5. No engineer coding has begun; dispatch to three independent coding sessions using pinned live integration SHA. Merge only with acceptance evidence.

## What every conductor session MUST do first
1. Read this file, README, architecture, contracts, ownership and latest GitHub PRs/issues.
2. Verify live integration/main heads and all PR head SHAs. Never assume old status is current.
3. Check CI/jobs, changed file paths, tests and exact runnable vertical slice.
4. Record merged PRs, integration SHA, blockers and dispatches in a new checkpoint here.
5. Preserve the project vision and restrict work to assigned areas.

## Every future checkpoint must include
Timestamp; exact main/integration SHAs; PR #, owner, merge SHA and test evidence; in-flight work; CI status; contract version; verified end-to-end behavior; blockers and exact next three engineer prompts.

## Checkpoint 1 — project kickoff (2026-11-15)
- Verified public repo: LeviCade/votatlas; authenticated owner has push/admin access.
- Main foundation docs, contracts and prompts commit: eedcbdad1d29fc89aaa7b966632763d57f4bb6b1.
- Created integration and three engineer branches at foundation SHA; they are being brought forward to this handoff checkpoint.
- Tracking: [E1 #1](https://github.com/LeviCade/votatlas/issues/1), [E2 #2](https://github.com/LeviCade/votatlas/issues/2), [E3 #3](https://github.com/LeviCade/votatlas/issues/3), [conductor #4](https://github.com/LeviCade/votatlas/issues/4), [license #5](https://github.com/LeviCade/votatlas/issues/5).
- Accepted feature PRs: none. CI status: no workflow run. Release: no runnable application yet.
- Engineer first actions: read latest branch HEAD and prompts/ENGINEER_*_ROUND_1.md; create owned-path code; open PRs against integration.
- Conductor first actions on return: verify live heads and PRs; review CI; integrate the first end-to-end county transfer behavior.
- Legal gate: no code license published; no third-party ElectIndex assets in repository. Synthetic vote data first.
