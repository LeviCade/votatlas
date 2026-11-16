import type { Candidate, GeoId, SimulationResult, UnitResult } from "@votatlas/contracts";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type CountyShape = Feature<Polygon | MultiPolygon, { geoId: GeoId; name: string }>;
export type CountyShapes = FeatureCollection<Polygon | MultiPolygon, { geoId: GeoId; name: string }>;
export type PaintedCounty = Feature<Polygon | MultiPolygon, {
  geoId: GeoId;
  name: string;
  fill: string;
  winnerCandidateId: string | null;
}>;
export type PaintedCounties = FeatureCollection<Polygon | MultiPolygon, PaintedCounty["properties"]>;

export const UNDECIDED_COLOR = "#476476";

/** Display-only selection of a unique leader. Vote calculations belong to sim-core. */
export function uniqueLeader(
  votes: Readonly<Record<string, number>>,
  candidateIds: readonly string[],
): string | null {
  let best: string | null = null;
  let highest = 0;
  let tied = false;
  for (const id of candidateIds) {
    const count = votes[id] ?? 0;
    if (count > highest) {
      highest = count;
      best = id;
      tied = false;
    } else if (count === highest && count > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
}

export function paintCounties(
  shapes: CountyShapes,
  result: SimulationResult,
  candidates: readonly Candidate[],
  showResults: boolean = true,
): PaintedCounties {
  const byId = new Map<GeoId, UnitResult>(result.units.map((unit) => [unit.geoId, unit]));
  const candidateIds = candidates.map((candidate) => candidate.id);
  const colors = new Map(candidates.map((candidate) => [candidate.id, candidate.color]));
  return {
    type: "FeatureCollection",
    features: shapes.features.map((shape): PaintedCounty => {
      const leader = byId.get(shape.properties.geoId);
      const winnerCandidateId = leader ? uniqueLeader(leader.votes, candidateIds) : null;
      return {
        type: "Feature",
        geometry: shape.geometry,
        properties: {
          geoId: shape.properties.geoId,
          name: shape.properties.name,
          winnerCandidateId,
          fill: showResults && winnerCandidateId
            ? colors.get(winnerCandidateId) ?? UNDECIDED_COLOR
            : UNDECIDED_COLOR,
        },
      };
    }),
  };
}

export function boundsForCounties(shapes: CountyShapes): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (point: number[]) => {
    const lon = point[0];
    const lat = point[1];
    if (lon === undefined || lat === undefined || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  };
  for (const feature of shapes.features) {
    if (feature.geometry.type === "Polygon") {
      for (const ring of feature.geometry.coordinates) for (const point of ring) visit(point);
    } else {
      for (const poly of feature.geometry.coordinates)
        for (const ring of poly) for (const point of ring) visit(point);
    }
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}
