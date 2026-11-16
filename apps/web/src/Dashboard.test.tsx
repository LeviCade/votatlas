import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Candidate, SimulationResult } from "@votatlas/contracts";
import { getTennesseeCountyReferences, getTennesseeSyntheticFixture } from "@votatlas/data";
import { Dashboard } from "./Dashboard";
import { initializeSandbox } from "./sandbox";

const { election, units } = getTennesseeSyntheticFixture();
const baseline = initializeSandbox(election, units);
const references = getTennesseeCountyReferences();
const render = (candidates: Candidate[], result: SimulationResult) =>
  renderToStaticMarkup(createElement(Dashboard, {
    election: { ...election, candidates }, result, baseline: result, references,
    scenario: baseline.scenario, onAdjustment: () => {}, onUndo: () => {},
    onReset: () => {}, onExport: () => "{}", onImport: () => true,
    message: "", error: "",
  }));

describe("live candidate-neutral dashboard", () => {
  it("renders 95 county tiles, accessible searchable controls and synthetic labels", () => {
    const markup = render(election.candidates, baseline.result);
    expect(markup).toContain("SYNTHETIC DATA");
    expect(markup).toContain("non-geographic 95-county atlas");
    expect(markup).toContain("95 counties in fixture");
    expect((markup.match(/data-testid="county-map-tile"/g) ?? []).length).toBe(95);
    expect(markup).toContain('aria-label="County selection list"');
    expect(markup).toContain("Find a county by name or FIPS code");
    expect(markup).toContain("Demographics locked");
    expect(markup).toContain("Simulation engine connected");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Import JSON");
  });
  it("supports 2, 3, and 5 candidates without party-position assumptions", () => {
    for (const count of [2, 3, 5]) {
      const candidates = Array.from({ length: count }, (_, i): Candidate => ({
        id: "candidate-" + i, name: "Candidate " + i, color: "#123456", ballotOrder: count - i,
      }));
      const result: SimulationResult = {
        ...baseline.result,
        national: { ...baseline.result.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) },
        byState: { "47": { ...baseline.result.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) } },
      };
      const markup = render(candidates, result);
      expect((markup.match(/data-testid="candidate-score"/g) ?? []).length).toBe(count);
      for (const candidate of candidates) expect(markup).toContain(candidate.name);
    }
  });
  it("prevents non-implemented demographic editing", () => {
    const markup = render(election.candidates, baseline.result);
    expect(markup).toMatch(/disabled=""[^>]*>Demographics<\/button>/);
  });
});
