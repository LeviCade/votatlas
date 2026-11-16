import { describe, expect, it } from "vitest";
import { getTennesseeSyntheticFixture } from "@votatlas/data";
import type { Adjustment } from "@votatlas/contracts";
import { applySandboxAction, emptyScenario, exportSandboxScenario, importSandboxScenario, initializeSandbox, undoSandboxAction } from "./sandbox";

const { election, units } = getTennesseeSyntheticFixture();
const baseline = initializeSandbox(election, units);
const transfer = (): Adjustment => ({ id: "davidson-five-pp", type: "TRANSFER_PP",
  scope: { kind: "county", countyIds: ["47037"] },
  fromCandidateId: "aster", toCandidateId: "cedar", points: 5 });

describe("95-county engine adapter", () => {
  it("loads the canonical full baseline exactly", () => {
    expect(units).toHaveLength(95);
    expect(baseline.result.units).toHaveLength(95);
    expect(baseline.scenario).toEqual(emptyScenario(election.id));
    for (const unit of units) {
      expect(baseline.result.units.find(row => row.geoId === unit.geoId)?.votes).toEqual(unit.votes);
    }
  });
  it("transfers five points in Davidson, preserves other counties and conserves ballots", () => {
    const next = applySandboxAction(election, units, baseline, transfer());
    const before = baseline.result.units.find(unit => unit.geoId === "47037")!;
    const after = next.result.units.find(unit => unit.geoId === "47037")!;
    const delta = before.votes.aster - after.votes.aster;
    expect(delta).toBeGreaterThan(0);
    expect(after.votes.cedar - before.votes.cedar).toBe(delta);
    expect(after.votes.briar).toBe(before.votes.briar);
    expect(next.result.byState["47"]!.votes.aster).toBe(baseline.result.byState["47"]!.votes.aster - delta);
    expect(next.result.byState["47"]!.votes.cedar).toBe(baseline.result.byState["47"]!.votes.cedar + delta);
    expect(next.result.national.ballots).toBe(baseline.result.national.ballots);
    for (const row of next.result.units.filter(item => item.geoId !== "47037"))
      expect(row).toEqual(baseline.result.units.find(item => item.geoId === row.geoId));
  });
  it("undoes, resets and imports/exports the exact replay", () => {
    const next = applySandboxAction(election, units, baseline, transfer());
    expect(undoSandboxAction(election, units, next).result).toEqual(baseline.result);
    const json = exportSandboxScenario(next);
    const loaded = importSandboxScenario(election, units, json);
    expect(loaded).toEqual(next);
    expect(exportSandboxScenario(loaded)).toBe(json);
    expect(initializeSandbox(election, units).result).toEqual(baseline.result);
  });
  it("rejects invalid imports and impossible transfers transactionally", () => {
    expect(() => importSandboxScenario(election, units, "{bad json")).toThrow();
    expect(() => importSandboxScenario(election, units, '{"schemaVersion":1,"electionId":"invalid","actions":[]}')).toThrow();
    expect(() => applySandboxAction(election, units, baseline, { ...transfer(), id:"impossible", points:100 })).toThrow();
    expect(baseline.scenario.actions).toHaveLength(0);
  });
});
