# Votatlas — Conductor Checklist

1. Retrieve live main/integration SHAs, PRs, issues and CI runs.
2. Audit each PR's changed paths against strict ownership.
3. Verify canonical contract compatibility. Any shared change originates with conductor.
4. Reproduce reported targeted tests; verify fresh install/typecheck/unit/build and any end-to-end smoke.
5. Inspect numerical invariants, scenario replay and synthetic data provenance.
6. Merge accepted PRs into integration (not directly to main); record exact merge SHA and CI.
7. Update docs/CONDUCTOR_HANDOFF.md with accepted PRs, blockers, next dispatches and new SHA.
8. At a full vertical slice, open integration -> main release PR with checklist and evidence.
9. Never claim tests that weren't run, or use percentages as substitutes for verified gates.
10. Reject source or data copying from ElectIndex without confirmed authorization.
