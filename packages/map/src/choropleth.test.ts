import { describe, expect, it } from "vitest";
import type { Candidate, SimulationResult } from "@votatlas/contracts";
import { boundsForCounties, paintCounties, uniqueLeader, type CountyShapes } from "./choropleth";

const candidates: Candidate[] = [
  { id: "raven", name: "Raven", color: "#111111", ballotOrder: 1 },
  { id: "brook", name: "Brook", color: "#222222", ballotOrder: 2 },
  { id: "cedar", name: "Cedar", color: "#333333", ballotOrder: 3 },
];
const shapes: CountyShapes = {
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: { geoId: "47001", name: "Sample" },
    geometry: { type: "Polygon", coordinates: [[[-85, 35], [-84, 35], [-84, 36], [-85, 36], [-85, 35]]] } }],
};
const result: SimulationResult = {
  electionId: "sample", schemaVersion: 1, dataStatus: "synthetic",
  units: [{ geoId: "47001", stateId: "47", eligibleVoters: null,
    votes: { raven: 25, brook: 50, cedar: 25 }, otherBallots: 0, ballots: 100 }],
  byState: {}, national: { votes: { raven: 25, brook: 50, cedar: 25 },
    otherBallots: 0, ballots: 100, winnerCandidateId: "brook", tie: false },
};
describe("map presentation (no simulation math)", () => {
  it("handles arbitrary candidate counts, ties and zero ballots", () => {
    expect(uniqueLeader({ a: 5, b: 3 }, ["a", "b"])).toBe("a");
    expect(uniqueLeader({ a: 5, b: 5, c: 2 }, ["a", "b", "c"])).toBeNull();
    expect(uniqueLeader({ a: 0, b: 0 }, ["a", "b"])).toBeNull();
    expect(uniqueLeader({ a: 4, b: 3, c: 2, d: 1, e: 0 }, ["a", "b", "c", "d", "e"])).toBe("a");
  });
  it("colors synthetic results by candidate IDs and supports neutral mode", () => {
    expect(paintCounties(shapes, result, candidates).features[0]?.properties.fill).toBe("#222222");
    expect(paintCounties(shapes, result, candidates, false).features[0]?.properties.fill).toBe("#476476");
  });
  it("computes map viewport from independent geometry", () => {
    expect(boundsForCounties(shapes)).toEqual([[-85, 35], [-84, 36]]);
    expect(boundsForCounties({ type: "FeatureCollection", features: [] })).toBeNull();
  });
});
