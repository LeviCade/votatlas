# Three Engineers + Conductor — Working Rules

**GitHub repository:** LeviCade/votatlas.
**Conductor integration branch:** integration.
**Round One branches (merged):** feature/v0.1-e1-map-ui, feature/v0.1-e2-candidate-engine, feature/v0.1-e3-data-ci.
**Round Two branches (merged):** feature/v0.1-r2-e1-live-ui, feature/v0.1-r2-e2-core-hardening, feature/v0.1-r2-e3-real-tn-map.
**Round Three branches (merged):** feature/v0.1-r3-e1-custom-candidates, feature/v0.1-r3-e2-portable-scenarios, feature/v0.1-r3-e3-official-tn-2024.
**Round Four branches (merged):** feature/v0.1-r4-e1-geo-scopes, feature/v0.1-r4-e2-demographic-core, feature/v0.1-r4-e3-official-source.
**Round Five branches (merged):** feature/v0.1-r5-e1-model-lab, feature/v0.1-r5-e2-cohort-projects, feature/v0.1-r5-e3-2024-authentication.
**Round Six branches:** feature/v0.1-r6-e1-demographic-sliders, feature/v0.1-r6-e2-composition-model, feature/v0.1-r6-e3-acs-county-profiles.

## Ownership
- E1: apps/web/** and packages/map/**, including tests located there.
- E2: packages/sim-core/**, including tests located there.
- E3: packages/data/**, scripts/** and .github/workflows/**, including their tests.
- Conductor: packages/contracts/**, root package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.base.json, docs/** and prompts/**.
- Cross-owner changes requested as an issue and made only with conductor coordination.

## PR workflow
1. Fetch latest integration commit; record exact SHA.
2. Work only in owned paths; no direct pushes to main or integration.
3. Open small PR against integration; provide a test matrix, exact base/head SHAs, file list and unresolved issues.
4. Conductor reviews interfaces, fixtures, CI and actual functional behavior. Merge only after relevant acceptance passes.
5. After every merge, conductor updates docs/CONDUCTOR_HANDOFF.md with merged PRs, new SHA, gates and next dispatch.

## Coordination
Never commit or redistribute copied ElectIndex code/data. No dummy controls presented as operational math. An engineer may mock contract-shaped data for UI while marking it as synthetic. No integration by copying one engineer's entire implementation into another's directory.

## First-release hard rule
One usable end-to-end sandbox beats three standalone green components. No unrelated features before county selection -> candidate transfer -> recalculation -> reset/export works.
