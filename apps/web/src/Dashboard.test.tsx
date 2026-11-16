import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Candidate, SimulationResult } from "@votatlas/contracts";
import { Dashboard } from "./Dashboard";
import { demoCounties, demoElection, demoResult } from "./fixtures/synthetic";

const render = (candidates: Candidate[], result: SimulationResult) =>
  renderToStaticMarkup(createElement(Dashboard, {
    election: { ...demoElection, candidates }, result, counties: demoCounties,
    onAdjustment: () => { /* server render: no click */ },
  }));

describe("candidate-neutral dashboard", () => {
  it("renders the development dataset and keyboard-accessible county selection", () => {
    const markup = render(demoElection.candidates, demoResult);
    expect(markup).toContain("SYNTHETIC DATA");
    expect(markup).toContain("schematic counties");
    expect(markup).toContain("Find a county by name or FIPS code");
    expect(markup).toContain("Demographics locked");
    expect(markup).toContain("Simulation not connected");
    expect(markup).toContain('aria-label="County selection list"');
  });
  it("supports 2, 3, and 5 candidates without party-position assumptions", () => {
    for (const count of [2, 3, 5]) {
      const candidates = Array.from({ length: count }, (_, i): Candidate => ({
        id: "person-" + i, name: "Candidate " + i, color: "#123456", ballotOrder: count - i,
      }));
      const result: SimulationResult = {
        ...demoResult,
        national: { ...demoResult.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) },
        byState: { "47": { ...demoResult.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) } },
      };
      const markup = render(candidates, result);
      expect((markup.match(/data-testid="candidate-score"/g) ?? []).length).toBe(count);
      for (const candidate of candidates) expect(markup).toContain(candidate.name);
    }
  });
  it("makes demographics explicitly unavailable", () => {
    const markup = render(demoElection.candidates, demoResult);
    expect(markup).toMatch(/disabled=""[^>]*>Demographics<\/button>/);
  });
});
