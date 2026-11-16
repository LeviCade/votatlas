# VOTATLAS — ENGINEER #2 / ROUND FIVE: CANONICAL v3 COHORT PROJECTS

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r5-e2-cohort-projects
PR target: integration
Starting SHA: read pinned R5 SHA in Issue #31.
Issue: #31.
Exclusive ownership: packages/sim-core/**.

FIRST: Read latest docs/CONDUCTOR_HANDOFF.md, R4 cohort model implementation/tests, existing portable v2 codec, project contracts and issues #30/#31. Publish the proposed R5 interface contract immediately to E1 on Issue #30 BEFORE substantial code.

MISSION: Exactly reproducible, source-bound cohort project files that preserve custom candidates and synthetic demographic edits, without duplicating the canonical v2 serialization.

REQUIRED:
1. Define strict optional v3 scenario-project schema: trusted source identity and fingerprint; v2 candidate registry/standard action history; declared explicitly synthetic cohort partition, declared model provenance/version, ordered cohort edits, and model state. Do not trust arbitrary imported replacement baseline votes. V3 import requires the original trusted source fixture and validates every candidate, county and cohort partition.
2. Establish an unambiguous, stable order: ordinary v1 adjustments replay first against the source, cohort partition matches exactly that intermediate result, then cohort actions replay. Changes to upstream actions or candidate roster must deterministically invalidate/rebuild the derived partition, never silently reuse incorrect modeled vote counts.
3. Preserve existing v1 and v2 parse/restore functions without breaking changes and safely support v3 in new explicit API. Exports/imports byte-identical in results, not necessarily whitespace.
4. Implement a small deterministic, obviously fictional optional cohort fixture generator for the 95-county synthetic source (e.g., declared model-group bins, not observed 2024 voting by demographic). Expose seed, version, and provenance. Age-like category labels may be used ONLY if unambiguously marked hypothetical. All cells mutually exclusive, per-candidate and other-ballot sums exact.
5. Test malicious imports, impossible turnovers, unsupported demographic intersections, capacity, source fingerprint mismatch, extended candidate registry, reorder/tie drift, 2/3/5/10 candidates, no data aliasing, 190+ mixed actions and 95 county state totals. No overlap double-counting.
6. Keep existing synthetic-only restriction in cohort engine. National scope is limited to loaded data, not a claim that TN is USA.
7. Native CI, strict TS, source test, no new root dependencies. Open PR, no merge.

IMPORTANT: E1 must use your one canonical API, never an ad hoc parallel project codec. Document any pending E1 integration gate.
