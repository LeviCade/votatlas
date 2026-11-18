import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTennesseeSyntheticFixture } from "@votatlas/data";
import type { Candidate, GeoScope } from "@votatlas/contracts";
import { addRegistryCandidate, initializeRegistrySandbox } from "./sandbox";
import { appendModelAction, beginSyntheticModel, beginCompositionModel, assertCompositionModelSourceCurrent, exportProjectWithModel, importCanonicalProject, undoModelAction } from "./model-lab";
import { selectedModeledSupport, supportTargetAction, DemographicSliders } from "./DemographicSliders";
import { readTennesseeAcs, acsUniverseLabel, sumSelectedAcsPopulation } from "./acs-source";

const fixture=getTennesseeSyntheticFixture();
const initial=()=>initializeRegistrySandbox(fixture.election,fixture.units);
const selected=["47037","47093","47157"];
const scope:GeoScope={kind:"county",countyIds:selected};
describe("R6 candidate-neutral modeled preference slider contracts",()=>{
  it("converts the exact proposed candidate share into a real 3-county engine transfer",()=>{
    const ordinary=initial(),model=beginSyntheticModel(ordinary,"round-six-ranges");
    const groupIds=[model.partition.cohorts[0]!.id];
    const before=selectedModeledSupport(model,selected,groupIds,ordinary.election.candidates);
    const cedar=100*before.votes.cedar!/before.candidateBallots;
    const action=supportTargetAction(before,"cedar",cedar+1.5,"aster","briar",
      scope,groupIds,ordinary.election.candidates);
    expect(action.type).toBe("COHORT_TRANSFER_PP");
    expect(action.scope).toEqual(scope);
    if(action.type!=="COHORT_TRANSFER_PP")throw Error("unexpected action");
    expect(action.fromCandidateId).toBe("aster");
    expect(action.toCandidateId).toBe("cedar");
    expect(action.points).toBeCloseTo(1.5,8);
    const after=appendModelAction(ordinary,model,action);
    let donorLost=0,recipientGained=0;
    for (const current of after.output.result.units){
      const previous=ordinary.result.units.find(x=>x.geoId===current.geoId)!;
      if(!selected.includes(current.geoId))expect(current).toEqual(previous);
      else {
        donorLost+=previous.votes.aster!-current.votes.aster!;
        recipientGained+=current.votes.cedar!-previous.votes.cedar!;
        expect(current.ballots).toBe(previous.ballots);
      }
      expect(current.ballots).toBe(current.otherBallots+ordinary.election.candidates.reduce((n,c)=>n+current.votes[c.id]!,0));
    }
    expect(donorLost).toBeGreaterThan(0);
    expect(recipientGained).toBe(donorLost);
    expect(after.output.result.byState["47"]!.ballots).toBe(ordinary.result.byState["47"]!.ballots);
    expect(undoModelAction(ordinary,after).output.result).toEqual(ordinary.result);
    const json=exportProjectWithModel(ordinary,after,fixture.election,fixture.units);
    expect(JSON.parse(json).schemaVersion).toBe(3);
    const restored=importCanonicalProject(json,fixture.election,fixture.units);
    expect(restored.model?.output.result).toEqual(after.output.result);
  });
  it("rejects donor capacity and same-candidate requests before the engine",()=>{
    const ordinary=initial(),model=beginSyntheticModel(ordinary);
    const group=[model.partition.cohorts[0]!.id];
    const totals=selectedModeledSupport(model,selected,group,ordinary.election.candidates);
    const current=100*totals.votes.cedar!/totals.candidateBallots;
    expect(()=>supportTargetAction(totals,"cedar",current+50,"aster","briar",scope,group,ordinary.election.candidates))
      .toThrow(/capacity/);
    expect(()=>supportTargetAction(totals,"cedar",current+1,"cedar","briar",scope,group,ordinary.election.candidates))
      .toThrow(/different donor/);
    expect(()=>supportTargetAction(totals,"cedar",current,"aster","briar",scope,group,ordinary.election.candidates))
      .toThrow(/Move a support slider/);
    expect(()=>supportTargetAction(totals,"cedar",110,"aster","briar",scope,group,ordinary.election.candidates))
      .toThrow(/between 0 and 100/);
    expect(model.actions).toHaveLength(0);
    expect(model.output.result).toEqual(ordinary.result);
  });
  it("supports 2/3/5/10 candidate-neutral UI without inferring source preferences",()=>{
    const ordinary=initial(),model=beginSyntheticModel(ordinary);
    const group=[model.partition.cohorts[0]!.id];
    for (const count of [2,3,5,10]){
      const candidates:Candidate[]=Array.from({length:count},(_,i)=>({id:`c-${i}`,name:`Hypothetical ${i}`,color:"#123abc",ballotOrder:i}));
      const mock={...model,output:{...model.output,cells:model.output.cells.map(c=>({
        ...c,votes:Object.fromEntries(candidates.map((x,i)=>[x.id,i+1]))
      }))}};
      const markup=renderToStaticMarkup(createElement(DemographicSliders,{
        model:mock,candidates,selectedIds:selected,cohortIds:group,scope,onApply:()=>true
      }));
      expect((markup.match(/type="range"/g)??[]).length).toBe(count);
      expect(markup).toContain("not observed subgroup voting preferences");
      for(const candidate of candidates)expect(markup).toContain(`Hypothetical support for ${candidate.name}`);
    }
  });
  it("regenerates cohort partition after a custom candidate was added, retaining all candidate IDs",()=>{
    let ordinary=initial();
    ordinary=addRegistryCandidate(ordinary,{id:"fictional-independent",name:"Independent Choice",color:"#BC54C2"});
    const model=beginSyntheticModel(ordinary,"candidate-neutral-r6");
    const ids=new Set(ordinary.election.candidates.map(c=>c.id));
    expect(ids.size).toBe(4);
    expect(model.output.cells.every(c=>ids.size===Object.keys(c.votes).length)).toBe(true);
    const markup=renderToStaticMarkup(createElement(DemographicSliders,{
      model,candidates:ordinary.election.candidates,selectedIds:selected,
      cohortIds:[model.partition.cohorts[0]!.id],scope,onApply:()=>true
    }));
    expect(markup).toContain("Independent Choice");
  });
});
describe("R6 source-bound hypothetical composition projects",()=>{
  it("fits both official ACS universes, replays v3, and rejects a stale Census profile fingerprint",()=>{
    for(const dimension of ["age","education"] as const){
      const source=readTennesseeAcs(dimension);
      expect(source.status).toBe("available");
      if(source.status!=="available")throw new Error("Expected verified ACS source to be available after E3 integration.");
      const weights=Object.fromEntries(source.rows[0]!.categories.map(group=>[group.id,1]));
      const ordinary=initial();
      const model=beginCompositionModel(ordinary,source,weights);
      expect(model.dimension).toBe(dimension);
      expect(model.output.result.units).toHaveLength(95);
      expect(model.provenance?.modelId).toBe("acs-population-composition-hypothesis");
      assertCompositionModelSourceCurrent(model.provenance!,source);
      const staleSource={...source,compositionProvenance:{
        ...source.compositionProvenance,sourceDigest:"sha256:"+"0".repeat(64)
      }};
      expect(()=>assertCompositionModelSourceCurrent(model.provenance!,staleSource))
        .toThrow(/different ACS population profile/);
      const json=exportProjectWithModel(ordinary,model,fixture.election,fixture.units);
      const restored=importCanonicalProject(json,fixture.election,fixture.units);
      expect(restored.model?.dimension).toBe(dimension);
      expect(restored.model?.output.result).toEqual(model.output.result);
    }
  });
});
describe("R6 verified-source safety versus fictional simulated ballots",()=>{
  it("never silently substitutes invented ACS shares when verified data are unavailable",()=>{
    for(const dimension of ["age","education"] as const){
      const source=readTennesseeAcs(dimension);
      if(source.status==="unavailable"){
        expect(source.reason.length).toBeGreaterThan(20);
        expect(source.reason).toMatch(/source|ACS|Census|integrat|verif/i);
      } else {
        expect(source.rows).toHaveLength(95);
        const totals=sumSelectedAcsPopulation(source,selected);
        expect(totals.countyCount).toBe(3);
        expect(totals.categoryTotals.reduce((sum,c)=>sum+c.estimate,0)).toBe(totals.universeEstimate);
        expect(totals.categoryTotals.some(c=>c.sourceVariables.length>0)).toBe(true);
      }
    }
    expect(acsUniverseLabel("age")).toContain("18");
    expect(acsUniverseLabel("education")).toContain("25");
    expect(acsUniverseLabel("age")).not.toBe(acsUniverseLabel("education"));
  });
});
