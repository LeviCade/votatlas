import { describe, expect, it } from "vitest";
import { demoCounties, demoElection, demoResult } from "./synthetic";

describe("development-only contract fixture", () => {
  it("has unique five-character county GEOIDs and synthetic provenance", () => {
    expect(demoResult.dataStatus).toBe("synthetic");
    expect(demoElection.dataStatus).toBe("synthetic");
    const ids = demoResult.units.map((unit) => unit.geoId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^47\d{3}$/);
    expect(demoCounties.features.map((f) => f.properties.geoId).sort()).toEqual([...ids].sort());
  });
  it("rolls up exact integer ballots without implicitly merging other ballots", () => {
    const candidateIds = demoElection.candidates.map((c) => c.id);
    for (const unit of demoResult.units) {
      const candidates = candidateIds.reduce((sum, id) => sum + (unit.votes[id] ?? 0), 0);
      expect(unit.ballots).toBe(candidates + unit.otherBallots);
    }
    for (const id of candidateIds) {
      expect(demoResult.units.reduce((sum, u) => sum + (u.votes[id] ?? 0), 0)).toBe(demoResult.national.votes[id]);
    }
    expect(demoResult.units.reduce((sum, u) => sum + u.otherBallots, 0)).toBe(demoResult.national.otherBallots);
    expect(demoResult.units.reduce((sum, u) => sum + u.ballots, 0)).toBe(demoResult.national.ballots);
  });
});
