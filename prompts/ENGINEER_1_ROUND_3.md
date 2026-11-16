# 🎨🗺️ VOTATLAS — ENGINEER #1, ROUND THREE: CUSTOM CANDIDATES + VERIFIED MAP WINNER FLIPS

Repository: https://github.com/LeviCade/votatlas
Branch: `feature/v0.1-r3-e1-custom-candidates`.
Target: `integration`.
GitHub Issue #18.
Start from the conductor-pinned Round Three base SHA in the latest Issue #4 kickoff comment. Record exact starting SHA before code changes.

Read docs/CONDUCTOR_HANDOFF.md, docs/ARCHITECTURE.md, docs/CONTRACTS.md, docs/ENGINEERING_OWNERSHIP.md, docs/TESTING_AND_ACCEPTANCE.md, existing apps/web and packages/map, and the current E2 candidate-registry implementation.

Own `apps/web/**` and `packages/map/**` ONLY. Conductor owns root package manifests/lockfile and contracts. Coordinate with E2 Issue #19 about serializing custom registry state.

## Mission
Turn the live, 95-county synthetic Tennessee playground into a genuinely candidate-neutral user editor: 2/3/5/10 candidates; safe addition, rename, guarded removal; full scenario-project export/import and deterministic replay after candidate creation. Preserve the existing baseline as immutable ground truth.

## Requirements
1. Build a typed candidate registry controller around E2's addCandidate/renameCandidate/removeZeroVoteCandidate. Keep election, baseline rows and scenario state synchronized atomically. Never delete a candidate whose ballots or existing scenario actions would be silently lost; handle active-history removal explicitly and reject unsafe actions.
2. Allow users to add fictional candidates with ID/name/color, optional affiliation, and zero starting votes. Preserve the 95 original counties, identifiers, existing candidate votes and geography. Label additions hypothetical; if a future official election is selected, distinguish actual recorded returns from simulated modifications.
3. Integrate E2's planned portable v2 scenario-project APIs when available; make import/export restore custom candidates, source fixture identity and action log. Continue supporting v1 action-only scenarios for the unchanged source registry.
4. Show a per-candidate legend and valid selectors for 2, 3, 5 and 10 candidates. Do not rely on any particular party IDs.
5. Add a real, reproducible leader-flip test. In the current Davidson synthetic baseline, Aster leads Cedar narrowly after a 5pp transfer; use a stronger valid transfer so Cedar becomes the county leader. Assert the MapLibre GeoJSON fill color changes to Cedar's color, not just the vote text. Verify updating votes does not unexpectedly reset user zoom.
6. Improve responsiveness/accessibility; keyboard and touch operation, controls not obscured by scrolling, proper labels and failure messages. Assert actual browser rendering, not merely the presence of the map wrapper.
7. Preserve exact reset/undo, error handling, upload size limits, JSON replay and synthetic labels. All test screenshots must come from real desktop/mobile Chromium CI and be attached to the PR.

## Merge gates
Run pinned/frozen pnpm CI, TypeScript, Vitest, build and Playwright. Every number must come from @votatlas/sim-core; map properties from actual @votatlas/data Census GeoJSON. No fabricated demographics and no proprietary ElectIndex code.

Coordinate E2 APIs and future official dataset selection with E3; do not cross edit owned paths. Submit PR against integration, list changed files and actual verified test evidence, do not merge.
