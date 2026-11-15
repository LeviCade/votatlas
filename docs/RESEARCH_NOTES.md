# Source Research and Provenance

## Investigation inputs (not committed)
The user independently supplied ElectIndex browser screenshots, Safari page HTML, browser-delivered JavaScript references and a functional-reconnaissance report dated 2026-11-15. Those are **third-party reference materials**; do not check their source bundles or datasets into this repository without license review.

## Observed ideas
- Election Shuffler supports historic U.S. presidential scenarios, county maps, national/local controls, demographic groups and named third-party candidates.
- Its engine has primary Democratic/Republican/Other vote buckets; other votes can be split among named/custom candidates.
- In exposed code, district vote computation scales source district-by-county components using county ratio multipliers. Custom candidate support uses group composition and state strongholds.
- Original map interface uses MapLibre/PMTiles/TopoJSON/D3. Visual direction: large county choropleth, selection controls, top scoreboard, contextual dock.
- Reconnaissance map interaction was limited by WebGL in the cloud browser; many geographic behaviors were not independently verified.
- Source analysis found potential ambiguity between some comments and custom-candidate donor direction; implement own explicit typed contract.

## Design changes
Candidate-neutral votes by candidate ID. Any number of candidates. Geography scopes with documented crosswalks. No black-box demographic overlap. Historical data must be baseline-exact and provably sourced.

## License-safe independent sources to evaluate
Census TIGER/Line geometry; Census ACS (including limitations/estimate vintages); state election office certified returns; MIT Election Data + Science Lab; NARA presidential electoral results. Review each asset and dataset license, attribution and redistribution conditions before import.

## Do not claim
This repository does not implement the original ElectIndex code, reproduce its proprietary mathematical estimator, or inherit rights to its data. Research is inspiration and behavioral evidence only.
