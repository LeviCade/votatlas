import { describe, expect, it } from "vitest";
import { getTennesseeSyntheticFixture, getTennesseeRealCountyGeoJSON } from "@votatlas/data";
import type { Adjustment } from "@votatlas/contracts";
import { paintCounties } from "@votatlas/map";
import { addRegistryCandidate, applyRegistryAction, initializeRegistrySandbox, undoRegistryAction } from "./sandbox";
import { exportPortableProject, importPortableProject } from "./portable";
import { normalizedCountyIds, resolveScope, selectedCountyIds, summarizeScope } from "./geo-scope";

const fixture = getTennesseeSyntheticFixture();
const start = () => initializeRegistrySandbox(fixture.election, fixture.units);
const chosen = ["47157", "47037", "47093"];
const ids = normalizedCountyIds(chosen);
const transfer = (scope: Adjustment["scope"], points=5, id="geo-scope"): Adjustment =>
  ({ id, type:"TRANSFER_PP", scope, fromCandidateId:"aster", toCandidateId:"cedar", points });
function assertAtomicConservation(before: ReturnType<typeof start>, after: ReturnType<typeof start>, selected: readonly string[], turnout=false) {
  const selection = new Set(selected);
  let asterDelta=0, cedarDelta=0;
  for (const row of after.result.units) {
    const prev = before.result.units.find(x=>x.geoId===row.geoId)!;
    expect(row.ballots).toBe(row.otherBallots + after.election.candidates.reduce((sum,c)=>sum + row.votes[c.id]!,0));
    if (!selection.has(row.geoId)) {
      expect(row).toEqual(prev);
    } else {
      if (!turnout) expect(row.ballots).toBe(prev.ballots);
      asterDelta+=row.votes.aster! - prev.votes.aster!;
      cedarDelta+=row.votes.cedar! - prev.votes.cedar!;
    }
  }
  if (!turnout) {
    expect(asterDelta).toBeGreaterThan(0);
    expect(asterDelta).toBe(cedarDelta);
    expect(after.result.national.ballots).toBe(before.result.national.ballots);
    expect(after.result.byState["47"]!.votes.aster).toBe(before.result.byState["47"]!.votes.aster! - asterDelta);
    expect(after.result.byState["47"]!.votes.cedar).toBe(before.result.byState["47"]!.votes.cedar! + cedarDelta);
  }
  for(const c of after.election.candidates) {
    expect(after.result.byState["47"]!.votes[c.id]).toBe(
      after.result.units.reduce((sum,row)=>sum + row.votes[c.id]!,0)
    );
  }
  expect(after.result.byState["47"]!.ballots).toBe(after.result.units.reduce((sum,row)=>sum+row.ballots,0));
}

describe("Round Four geographic scope isolation and contextual totals", () => {
  it("normalizes unique five-character FIPS without losing leading zeroes", () => {
    expect(normalizedCountyIds(["47093","47037","47037","47157"])).toEqual(ids);
    expect(selectedCountyIds("multi", "47037", chosen, start().result)).toEqual(ids);
    expect(selectedCountyIds("county", "47037", chosen, start().result)).toEqual(["47037"]);
    expect(selectedCountyIds("county", null, chosen, start().result)).toEqual([]);
    expect(resolveScope("county", null, chosen, start().result)).toBeNull();
    expect(resolveScope("multi", null, [], start().result)).toBeNull();
    expect(()=>resolveScope("multi",null,["47000"],start().result)).toThrow(/unknown GEOID/);
  });

  it("three selected counties get one canonical sorted countyIds transfer, others unchanged", () => {
    const before=start();
    const scope=resolveScope("multi", null, chosen, before.result)!;
    expect(scope).toEqual({kind:"county",countyIds:ids});
    const after=applyRegistryAction(before,transfer(scope));
    assertAtomicConservation(before,after,ids);
    const previous=summarizeScope(before.result,ids,before.election.candidates);
    const current=summarizeScope(after.result,ids,after.election.candidates);
    expect(current.countyCount).toBe(3);
    expect(current.candidateBallots).toBe(previous.candidateBallots);
    expect(current.ballots).toBe(previous.ballots);
    expect(current.votes.aster).toBeLessThan(previous.votes.aster!);
    expect(current.votes.cedar! - previous.votes.cedar!).toBe(previous.votes.aster! - current.votes.aster!);
    expect(current.otherBallots).toBe(previous.otherBallots);
    expect(undoRegistryAction(after).result).toEqual(before.result);
    const restored=importPortableProject(exportPortableProject(after,fixture.election,fixture.units),fixture.election,fixture.units);
    expect(restored.scenario.actions[0]!.scope).toEqual(scope);
    expect(restored.result).toEqual(after.result);
  });

  it("the entire loaded state emits state 47, changes geographically without pretending to be national", () => {
    const before=start();
    const scope=resolveScope("state", null,[],before.result)!;
    expect(scope).toEqual({kind:"state",stateId:"47"});
    const all=selectedCountyIds("state",null,[],before.result);
    expect(all).toHaveLength(95);
    const after=applyRegistryAction(before,transfer(scope,1));
    assertAtomicConservation(before,after,all);
    expect(after.result.units.filter((row,i)=>row.votes.aster !== before.result.units[i]?.votes.aster).length).toBeGreaterThan(1);
    const current=summarizeScope(after.result,all,after.election.candidates);
    expect(current.ballots).toBe(after.result.byState["47"]!.ballots);
    for (const candidate of after.election.candidates) {
      expect(current.votes[candidate.id]).toBe(after.result.byState["47"]!.votes[candidate.id]);
    }
    expect(current.otherBallots).toBe(after.result.byState["47"]!.otherBallots);
  });

  it("multiple-county turnout is isolated and allows different ballot counts only inside selection", () => {
    const before=start();
    const scope=resolveScope("multi",null,chosen,before.result)!;
    const after=applyRegistryAction(before,{ id:"multi-turnout",type:"TURNOUT_SCALE",scope,
      factor:1.01,allocation:"proportional-candidates"});
    assertAtomicConservation(before,after,ids,true);
    expect(after.result.units.some(row=>ids.includes(row.geoId) &&
      row.ballots !== before.result.units.find(prev=>prev.geoId===row.geoId)!.ballots)).toBe(true);
    expect(undoRegistryAction(after).result).toEqual(before.result);
  });

  it("rejects impossible donor transfer without silently mutating any selected county or state", () => {
    const before=start();
    for (const scope of [resolveScope("multi",null,chosen,before.result)!, resolveScope("state",null,[],before.result)!]) {
      expect(()=>applyRegistryAction(before,transfer(scope,100,"too-much"))).toThrow();
      expect(before.scenario.actions).toHaveLength(0);
      expect(before.result).toEqual(start().result);
    }
  });

  it("source-verified v2 project replays mixed scoped actions with added hypothetical candidate", () => {
    let state=addRegistryCandidate(start(),{id:"area-option",name:"Area Option",color:"#BA23A1"});
    state=applyRegistryAction(state,{ id:"area-share", type:"SET_SHARE",
      scope: resolveScope("multi",null,chosen,state.result)!, candidateId:"area-option",
      targetPercent:9,redistribution:{kind:"proportional-other"} });
    state=applyRegistryAction(state,transfer(resolveScope("state",null,[],state.result)!,1,"state-second"));
    const json=exportPortableProject(state,fixture.election,fixture.units);
    const restored=importPortableProject(json,fixture.election,fixture.units);
    expect(restored.result).toEqual(state.result);
    expect(restored.election).toEqual(state.election);
    expect(restored.scenario).toEqual(state.scenario);
    expect(restored.scenario.actions[0]!.scope).toEqual({kind:"county",countyIds:ids});
    expect(restored.scenario.actions[1]!.scope).toEqual({kind:"state",stateId:"47"});
    const reset=start();
    expect(reset.scenario.actions).toHaveLength(0);
    expect(reset.election.candidates).toHaveLength(3);
  });

  it("real Census map leader colors remain derived from final engine rows after multi-scope changes", () => {
    const before=start();
    const after=applyRegistryAction(before,transfer(resolveScope("multi",null,chosen,before.result)!,7));
    const shapes=getTennesseeRealCountyGeoJSON();
    expect(shapes.features).toHaveLength(95);
    const painted=paintCounties(shapes,after.result,after.election.candidates);
    for (const f of painted.features) {
      const unit=after.result.units.find(row=>row.geoId===f.properties.geoId)!;
      expect(unit).toBeDefined();
      expect(f.properties.winnerCandidateId).toBe(unit.votes.aster === unit.votes.cedar && unit.votes.aster > unit.votes.briar
        ? null : f.properties.winnerCandidateId);
    }
    const outsideBefore=paintCounties(shapes,before.result,before.election.candidates)
      .features.find(f=>f.properties.geoId==="47001")!;
    const outsideAfter=painted.features.find(f=>f.properties.geoId==="47001")!;
    expect(outsideAfter.properties.fill).toBe(outsideBefore.properties.fill);
    expect(outsideAfter.properties.winnerCandidateId).toBe(outsideBefore.properties.winnerCandidateId);
  });
});
