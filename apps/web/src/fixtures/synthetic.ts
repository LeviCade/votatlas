import type {
  BaseUnitResult, Candidate, ElectionDefinition, ResultTotals, SimulationResult, UnitResult,
} from "@votatlas/contracts";
import type { CountyShapes } from "@votatlas/map";

/**
 * DEVELOPMENT DATA ONLY. All vote counts are invented, and polygons are schematic
 * tiles — NOT real county boundaries, official returns, forecasts, or estimates.
 * Replaced by E3's licensed 95-county TN fixture as soon as its schema is published.
 */
export const demoCandidates: Candidate[] = [
  { id: "aster", name: "Morgan Vale", partyLabel: "Civic Horizon", color: "#68a9f7", ballotOrder: 1 },
  { id: "beacon", name: "Jordan Park", partyLabel: "Forward Coalition", color: "#f4a16b", ballotOrder: 2 },
  { id: "cypress", name: "Avery Stone", partyLabel: "Independent", color: "#82d7b5", ballotOrder: 3 },
];

export const demoElection: ElectionDefinition = {
  id: "synthetic-tn-v1",
  title: "Tennessee laboratory election",
  office: "Fictional statewide office",
  year: 2026,
  geographyVintage: "schematic-demo-2026",
  dataStatus: "synthetic",
  candidates: demoCandidates,
};

const rows: BaseUnitResult[] = [
  { geoId: "47157", stateId: "47", eligibleVoters: null, votes: { aster: 130000, beacon: 155000, cypress: 42000 }, otherBallots: 4000 },
  { geoId: "47125", stateId: "47", eligibleVoters: null, votes: { aster: 46000, beacon: 41000, cypress: 19000 }, otherBallots: 1200 },
  { geoId: "47037", stateId: "47", eligibleVoters: null, votes: { aster: 155000, beacon: 151000, cypress: 78000 }, otherBallots: 5200 },
  { geoId: "47187", stateId: "47", eligibleVoters: null, votes: { aster: 94000, beacon: 88000, cypress: 19000 }, otherBallots: 2400 },
  { geoId: "47149", stateId: "47", eligibleVoters: null, votes: { aster: 102000, beacon: 98000, cypress: 34000 }, otherBallots: 2700 },
  { geoId: "47065", stateId: "47", eligibleVoters: null, votes: { aster: 79000, beacon: 92000, cypress: 35000 }, otherBallots: 2400 },
  { geoId: "47093", stateId: "47", eligibleVoters: null, votes: { aster: 82000, beacon: 101000, cypress: 30000 }, otherBallots: 2200 },
  { geoId: "47009", stateId: "47", eligibleVoters: null, votes: { aster: 51000, beacon: 50000, cypress: 14000 }, otherBallots: 1100 },
  { geoId: "47179", stateId: "47", eligibleVoters: null, votes: { aster: 33000, beacon: 40000, cypress: 18000 }, otherBallots: 700 },
  { geoId: "47163", stateId: "47", eligibleVoters: null, votes: { aster: 36000, beacon: 43000, cypress: 16000 }, otherBallots: 800 },
];

const syntheticUnits: UnitResult[] = rows.map((row) => ({
  ...row,
  ballots: Object.values(row.votes).reduce((sum, count) => sum + count, row.otherBallots),
}));

const syntheticTotals: ResultTotals = {
  votes: { aster: 808000, beacon: 859000, cypress: 305000 },
  otherBallots: 22700,
  ballots: 1994700,
  winnerCandidateId: "beacon",
  tie: false,
};

export const demoResult: SimulationResult = {
  electionId: demoElection.id,
  schemaVersion: 1,
  dataStatus: "synthetic",
  units: syntheticUnits,
  byState: { "47": syntheticTotals },
  national: syntheticTotals,
};

// Geometries are independent SVG-like map tiles positioned within an illustrative
// viewport. A tile does not assert the real location, area, or shape of its county.
const tiles: Array<{ geoId: string; name: string; x: number; y: number }> = [
  { geoId: "47157", name: "Shelby", x: -90.0, y: 35.10 },
  { geoId: "47125", name: "Montgomery", x: -88.4, y: 35.88 },
  { geoId: "47037", name: "Davidson", x: -86.8, y: 35.88 },
  { geoId: "47187", name: "Williamson", x: -86.8, y: 35.10 },
  { geoId: "47149", name: "Rutherford", x: -85.2, y: 35.10 },
  { geoId: "47065", name: "Hamilton", x: -83.6, y: 35.10 },
  { geoId: "47093", name: "Knox", x: -85.2, y: 35.88 },
  { geoId: "47009", name: "Blount", x: -83.6, y: 35.88 },
  { geoId: "47179", name: "Washington", x: -82.0, y: 35.10 },
  { geoId: "47163", name: "Sullivan", x: -82.0, y: 35.88 },
];

export const demoCounties: CountyShapes = {
  type: "FeatureCollection",
  features: tiles.map(({ geoId, name, x, y }) => ({
    type: "Feature" as const,
    properties: { geoId, name },
    geometry: {
      type: "Polygon" as const,
      coordinates: [[
        [x, y], [x + 1.55, y], [x + 1.55, y + 0.73],
        [x + 0.7, y + 0.73], [x + 0.66, y + 0.68],
        [x, y + 0.73], [x, y],
      ]],
    },
  })),
};
