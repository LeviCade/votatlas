import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Candidate, SimulationResult } from "@votatlas/contracts";
import { getTennesseeCountyReferences, getTennesseeSyntheticFixture } from "@votatlas/data";
import { Dashboard } from "./Dashboard";
import { initializeRegistrySandbox } from "./sandbox";

const source = getTennesseeSyntheticFixture();
const baseline = initializeRegistrySandbox(source.election, source.units);
const references = getTennesseeCountyReferences();
function render(candidates: Candidate[], result: SimulationResult, sourceCandidates=candidates): string {
  return renderToStaticMarkup(createElement(Dashboard, {
    election: { ...source.election, candidates },
    trustedSource: { ...source.election, candidates: sourceCandidates },
    result, baseline: result, references,
    scenario: baseline.scenario,
    onAdjustment: () => {}, onUndo: () => {}, onReset: () => {},
    onAddCandidate: () => true, onRenameCandidate: () => true, onRemoveCandidate: () => true,
    onExport: () => "{}", onImport: () => true,
    message: "", error: "",
  }));
}

describe("candidate-neutral responsive dashboard", () => {
  it("keeps all 95 counties and synthetic status with accessible navigation", () => {
    const markup = render(source.election.candidates, baseline.result);
    expect(markup).toContain("SYNTHETIC DATA");
    expect(markup).toContain("95 counties in fixture");
    expect((markup.match(/data-testid="county-map-tile"/g) ?? []).length).toBe(95);
    expect(markup).toContain('aria-label="County selection list"');
    expect(markup).toContain("Find a county by name or FIPS code");
    expect(markup).toContain("Hypothetical groups only");
    expect(markup).toContain("Simulation engine connected");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain("Import JSON");
  });
  it("renders candidate-neutral 2, 3, 5, 10 roster/scoreboard and selectors", () => {
    for (const count of [2, 3, 5, 10]) {
      const candidates: Candidate[] = Array.from({ length: count }, (_, i) => ({
        id: "person-" + i, name: "Candidate " + i, color: "#123456", ballotOrder: count - i,
      }));
      const result: SimulationResult = {
        ...baseline.result,
        national: { ...baseline.result.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) },
        byState: { "47": { ...baseline.result.national, votes: Object.fromEntries(candidates.map((c, i) => [c.id, (i + 1) * 100])) } },
      };
      const markup = render(candidates, result);
      expect((markup.match(/data-testid="candidate-score"/g) ?? []).length).toBe(count);
      expect(markup).toContain(`${count} candidates`);
      for (const candidate of candidates) expect(markup).toContain(candidate.name);
    }
  });
  it("exposes opt-in synthetic Model Lab but not an observed demographic model", () => {
    const markup = render(source.election.candidates, baseline.result);
    expect(markup).toContain(">Model Lab</button>");
    expect(markup).toContain("Hypothetical groups only");
    expect(markup).not.toContain("Demographics locked");
  });
});
