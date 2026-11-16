import { describe, expect, it } from "vitest";
import { getTennesseeSyntheticFixture, getTennesseeRealCountyGeoJSON } from "@votatlas/data";
import type { Adjustment, BaseUnitResult, Candidate, ElectionDefinition } from "@votatlas/contracts";
import { paintCounties } from "@votatlas/map";
import {
  addRegistryCandidate, applyRegistryAction, hydrateRegistrySandbox, importLegacyRegistryScenario,
  initializeRegistrySandbox, removeRegistryCandidate, renameRegistryCandidate, undoRegistryAction
} from "./sandbox";
import { exportPortableProject, importPortableProject } from "./portable";

const source = getTennesseeSyntheticFixture();
const start = () => initializeRegistrySandbox(source.election, source.units);
const transfer = (points: number, id="flip-county"): Adjustment => ({
  id, type:"TRANSFER_PP", scope: {kind:"county", countyIds:["47037"]},
  fromCandidateId:"aster", toCandidateId:"cedar", points
});
const candidate = (id: string) => ({ id, name: `Hypothetical ${id}`, color: "#D4388B" });

describe("Round Three atomic candidate registry", () => {
  it("preserves original 95-county source totals after 3→5→10 additions", () => {
    const original = start();
    let expanded = original;
    for (let i = 4; i <= 10; i++) {
      expanded = addRegistryCandidate(expanded, candidate("future-" + i));
      if (i === 5 || i === 10) {
        expect(expanded.election.candidates).toHaveLength(i);
        for (const row of expanded.result.units) {
          const previous = original.result.units.find(x => x.geoId === row.geoId)!;
          for (const sourceCandidate of source.election.candidates)
            expect(row.votes[sourceCandidate.id]).toBe(previous.votes[sourceCandidate.id]);
          expect(row.ballots).toBe(previous.ballots);
        }
        expect(expanded.result.national.ballots).toBe(original.result.national.ballots);
      }
    }
    expect(original.election.candidates).toHaveLength(3);
    expect(original.baseUnits).toEqual(source.units);
  });

  it("handles 2-candidate neutral inputs without third-party or ballot-order assumptions", () => {
    const two: ElectionDefinition = {...source.election, id:"two-candidate-test",
      candidates: [{id:"one",name:"One",color:"#AABBCC",ballotOrder:9},
        {id:"two",name:"Two",color:"#223344",ballotOrder:2}]};
    const rows: BaseUnitResult[] = source.units.map(row => ({
      ...row, eligibleVoters:null, otherBallots:row.otherBallots,
      votes:{one:row.votes.aster!,two:row.votes.briar!}
    }));
    let state=initializeRegistrySandbox(two,rows);
    expect(state.election.candidates).toHaveLength(2);
    state=addRegistryCandidate(state,candidate("third"));
    expect(state.election.candidates).toHaveLength(3);
    expect(state.result.national.votes.third).toBe(0);
    expect(state.election.candidates.at(-1)?.ballotOrder).toBe(10);
  });

  it("renames by stable candidate ID with byte-identical results, and permits removing an unused hypothetical", () => {
    let state=addRegistryCandidate(start(),candidate("added"));
    state=renameRegistryCandidate(state,"added","Renamed Candidate");
    expect(state.election.candidates.find(c=>c.id==="added")?.name).toBe("Renamed Candidate");
    const removed=removeRegistryCandidate(state,"added",source.election);
    expect(removed.election).toEqual(source.election);
    expect(removed.baseUnits).toEqual(source.units);
    expect(removed.result).toEqual(start().result);
  });

  it("protects source candidates, positive votes, action references, and existing action donor shares", () => {
    const original=start();
    expect(()=>removeRegistryCandidate(original,"aster",source.election)).toThrow(/protected/);
    const share: Adjustment={id:"old-share",type:"SET_SHARE",scope:{kind:"county",countyIds:["47037"]},
      candidateId:"cedar",targetPercent:45,redistribution:{kind:"proportional-other"}};
    const previous=applyRegistryAction(original,share);
    const extended=addRegistryCandidate(previous,candidate("newcomer"));
    for(const id of ["aster","briar","cedar"])
      expect(extended.result.national.votes[id]).toBe(previous.result.national.votes[id]);
    const active=applyRegistryAction(extended,{id:"credit",type:"TRANSFER_PP",
      scope:{kind:"county",countyIds:["47037"]},fromCandidateId:"aster",toCandidateId:"newcomer",points:1});
    expect(active.result.national.votes.newcomer).toBeGreaterThan(0);
    expect(()=>removeRegistryCandidate(active,"newcomer",source.election)).toThrow(/history|votes/);
    expect(active.election.candidates).toHaveLength(4);
    expect(()=>removeRegistryCandidate(extended,"newcomer",source.election)).not.toThrow();
  });

  it("changes real Census Davidson county winner and its GeoJSON fill to Cedar", () => {
    const before=start();
    const after=applyRegistryAction(before,transfer(7));
    const geometry=getTennesseeRealCountyGeoJSON();
    const davidsonBefore=paintCounties(geometry,before.result,before.election.candidates)
      .features.find(f=>f.properties.geoId==="47037")!;
    const davidsonAfter=paintCounties(geometry,after.result,after.election.candidates)
      .features.find(f=>f.properties.geoId==="47037")!;
    expect(geometry.features).toHaveLength(95);
    expect(davidsonBefore.properties.winnerCandidateId).toBe("aster");
    expect(davidsonAfter.properties.winnerCandidateId).toBe("cedar");
    expect(davidsonBefore.properties.fill.toUpperCase()).toBe("#7544A6");
    expect(davidsonAfter.properties.fill.toUpperCase()).toBe("#B47F15");
    const untouched=after.result.units.find(u=>u.geoId==="47157")!;
    expect(untouched).toEqual(before.result.units.find(u=>u.geoId==="47157"));
    expect(undoRegistryAction(after).result).toEqual(before.result);
  });

  it("exports/imports a portable custom-candidate project with actions and metadata", () => {
    const original=start();
    let state=addRegistryCandidate(original,candidate("custom"));
    state=renameRegistryCandidate(state,"custom","Renamed Custom");
    state=applyRegistryAction(state,{id:"set-custom",type:"SET_SHARE",
      scope:{kind:"county",countyIds:["47037"]}, candidateId:"custom",
      targetPercent:15,redistribution:{kind:"proportional-other"}});
    const json=exportPortableProject(state,source.election,source.units);
    const restored=importPortableProject(json,source.election,source.units);
    expect(restored.election).toEqual(state.election);
    expect(restored.scenario).toEqual(state.scenario);
    expect(restored.result).toEqual(state.result);
    expect(restored.result.units).toHaveLength(95);
    expect(restored.result.national.ballots).toBe(original.result.national.ballots);
    const replay=hydrateRegistrySandbox(restored.election,restored.baseUnits,restored.scenario);
    expect(replay.result).toEqual(state.result);
    expect(()=>importPortableProject('{"schemaVersion":99}',source.election,source.units)).toThrow();
    expect(()=>importPortableProject("{bad json",source.election,source.units)).toThrow();
  });

  it("imports legacy v1 scenarios against unmodified trusted source", () => {
    const legacy=JSON.stringify({schemaVersion:1,electionId:source.election.id,
      actions:[transfer(5,"legacy-transfer")]});
    const loaded=importLegacyRegistryScenario(source.election,source.units,legacy);
    expect(loaded.election).toEqual(source.election);
    expect(loaded.scenario.actions).toHaveLength(1);
    expect(importPortableProject(legacy,source.election,source.units).result).toEqual(loaded.result);
  });
});
