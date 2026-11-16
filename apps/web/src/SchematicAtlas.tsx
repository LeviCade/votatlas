import type { Candidate, SimulationResult } from "@votatlas/contracts";
import type { CountyReference } from "@votatlas/data";
import { UNDECIDED_COLOR, uniqueLeader } from "@votatlas/map";

export interface SchematicAtlasProps {
  references: readonly CountyReference[];
  result: SimulationResult;
  candidates: readonly Candidate[];
  selectedGeoId: string | null;
  showResults: boolean;
  onSelect: (geoId: string) => void;
  onHover: (geoId: string | null) => void;
}

/**
 * Never imply these index-ordered tiles are longitude/latitude coordinates.
 * E3's local grid is deliberately NOT fed to MapLibre.
 */
export function SchematicAtlas({ references, result, candidates, selectedGeoId, showResults, onSelect, onHover }: SchematicAtlasProps) {
  const byId = new Map(result.units.map((unit) => [unit.geoId, unit]));
  const colors = new Map(candidates.map((candidate) => [candidate.id, candidate.color]));
  const candidateIds = candidates.map((candidate) => candidate.id);
  return (
    <div className="atlas-wrap">
      <div className="atlas-grid" role="group" aria-label="Non-geographic Tennessee county tile atlas">
        {references.map((county, index) => {
          const unit = byId.get(county.geoId);
          const leader = unit ? uniqueLeader(unit.votes, candidateIds) : null;
          const fill = showResults && leader ? colors.get(leader) ?? UNDECIDED_COLOR : UNDECIDED_COLOR;
          return <button type="button" key={county.geoId} data-testid="county-map-tile"
            className={selectedGeoId === county.geoId ? "atlas-tile selected" : "atlas-tile"}
            aria-pressed={selectedGeoId === county.geoId} aria-label={county.name + " county tile"}
            title={county.name + " · " + county.geoId + " · schematic index"}
            style={{ backgroundColor: fill }}
            onClick={() => onSelect(county.geoId)}
            onMouseEnter={() => onHover(county.geoId)}
            onMouseLeave={() => onHover(null)}>{index + 1}</button>;
        })}
      </div>
      <div className="atlas-note">95 sample county tiles · not geographic boundaries</div>
    </div>
  );
}
