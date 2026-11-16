import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTennesseeSyntheticFixture } from "@votatlas/data";
import { simulateCohortPartition } from "@votatlas/sim-core";
import type { CohortAction, SyntheticCohortPartition } from "@votatlas/sim-core";
import { addRegistryCandidate, applyRegistryAction, initializeRegistrySandbox } from "./sandbox";
import {
  appendModelAction, beginSyntheticModel, canonicalV3Ready, exportProjectWithModel,
  importCanonicalProject, modelGeneratorReady, resetModelActions, undoModelAction,
} from "./model-lab";
import type { SyntheticModelSession } from "./model-lab";
import { ModelLab } from "./ModelLab";
import { normalizedCountyIds } from "./geo-scope";

const original = getTennesseeSyntheticFixture();
const start = () => initializeRegistrySandbox(original.election, original.units);

/** Test-only synthetic disjoint split, NOT a production partition generator.
 * Each candidate/other/eligibility category reconstructs the trusted baseline exactly. */
function testPartition(ordinary = start()): SyntheticCohortPartition {
  return {
    schemaVersion:1, dataStatus:"synthetic", partitionId:"unit-test-disjoint-synthetic",
    kind:"single", dimensionIds:["fictional-group"], universe:"modeled-ballots",
    cohorts:[
      {id:"fiction-a",label:"Invented A",dimensions:{"fictional-group":"invented-a"}},
      {id:"fiction-b",label:"Invented B",dimensions:{"fictional-group":"invented-b"}},
    ],
    counties:ordinary.result.units.map(row => {
      const a = Object.fromEntries(ordinary.election.candidates.map(c => [c.id,Math.floor(row.votes[c.id]! / 2)]));
      const b = Object.fromEntries(ordinary.election.candidates.map(c => [c.id,row.votes[c.id]! - a[c.id]!]));
      const e = row.eligibleVoters === null ? null : Math.floor(row.eligibleVoters / 2);
      return {geoId:row.geoId,cells:[
        {cohortId:"fiction-a",eligibleVoters:e,votes:a,otherBallots:Math.floor(row.otherBallots/2)},
        {cohortId:"fiction-b",eligibleVoters:row.eligibleVoters === null ? null : row.eligibleVoters-e!,
         votes:b,otherBallots:row.otherBallots-Math.floor(row.otherBallots/2)}
      ]};
    })
  };
}
function testModel(ordinary=start()): SyntheticModelSession {
  const partition=testPartition(ordinary);
  return {partition,actions:[],output:simulateCohortPartition(ordinary.election,ordinary.result.units,partition),seed:"test-only"};
}
const multi = normalizedCountyIds(["47157","47093","47037"]);
function transfer(id="fictional-model-1"): CohortAction {
  return {id,type:"COHORT_TRANSFER_PP",scope:{kind:"county",countyIds:multi},
    cohortIds:["fiction-a"],fromCandidateId:"aster",toCandidateId:"cedar",points:1};
}
function checkCounties(ordinary: ReturnType<typeof start>, model: SyntheticModelSession, affected: readonly string[], isTurnout=false) {
  const set=new Set(affected);
  let lost=0, gained=0;
  for (const unit of model.output.result.units) {
    const prev=ordinary.result.units.find(row=>row.geoId===unit.geoId)!;
    if (!set.has(unit.geoId)) expect(unit).toEqual(prev);
    else {
      if (!isTurnout) expect(unit.ballots).toBe(prev.ballots);
      lost+=prev.votes.aster!-unit.votes.aster!;
      gained+=unit.votes.cedar!-prev.votes.cedar!;
    }
    expect(unit.ballots).toBe(unit.otherBallots+ordinary.election.candidates.reduce((sum,c)=>sum+unit.votes[c.id]!,0));
  }
  if (!isTurnout) {
    expect(lost).toBeGreaterThan(0);
    expect(gained).toBe(lost);
    expect(model.output.result.byState["47"]!.ballots).toBe(ordinary.result.byState["47"]!.ballots);
  }
  expect(model.output.result.byState["47"]!.ballots)
    .toBe(model.output.result.units.reduce((sum,row)=>sum+row.ballots,0));
}
describe("R5 Model Lab engine integration without a second voting algorithm", () => {
  it("one disjoint 95-county test partition reconstructs exact classic source candidate counts", () => {
    const ordinary=start(), model=testModel(ordinary);
    expect(model.output.result.units).toEqual(ordinary.result.units);
    expect(model.output.cells).toHaveLength(190);
    expect(model.partition.counties).toHaveLength(95);
    expect(model.output.deltas.every(d=>d.deltaBallots===0)).toBe(true);
  });
  it("three-county fictional-group support transfer is isolated, conserved and undo/reset exact", () => {
    const ordinary=start(), before=testModel(ordinary), after=appendModelAction(ordinary,before,transfer());
    expect(after.actions[0]?.scope).toEqual({kind:"county",countyIds:multi});
    checkCounties(ordinary,after,multi);
    for (const cell of after.output.cells) {
      if (cell.cohortId!=="fiction-a" || !multi.includes(cell.geoId))
        expect(cell).toEqual(before.output.cells.find(c=>c.cohortId===cell.cohortId&&c.geoId===cell.geoId));
    }
    expect(undoModelAction(ordinary,after).output.result).toEqual(ordinary.result);
    expect(resetModelActions(ordinary,after).output.result).toEqual(ordinary.result);
  });
  it("state 47 model turnout operates only on selected cohort, never all US and respects eligibility", () => {
    const ordinary=start(), before=testModel(ordinary);
    const action:CohortAction={id:"tn-turnout",type:"COHORT_TURNOUT_SCALE",scope:{kind:"state",stateId:"47"},cohortIds:["fiction-a"],factor:0.97};
    const after=appendModelAction(ordinary,before,action);
    expect(after.actions[0]?.scope).toEqual({kind:"state",stateId:"47"});
    expect(after.output.result.units.some((r,i)=>r.ballots!==ordinary.result.units[i]?.ballots)).toBe(true);
    for(const cell of after.output.cells)
      if(cell.cohortId==="fiction-b") expect(cell).toEqual(before.output.cells.find(c=>c.geoId===cell.geoId&&c.cohortId===cell.cohortId));
    checkCounties(ordinary,after,ordinary.result.units.map(c=>c.geoId),true);
    expect(undoModelAction(ordinary,after).output.result).toEqual(before.output.result);
  });
  it("atomic errors reject overcapacity donors, excessive turnout and duplicate IDs", () => {
    const ordinary=start(), before=testModel(ordinary);
    const impossible={...transfer(),points:100};
    expect(()=>appendModelAction(ordinary,before,impossible)).toThrow();
    expect(()=>appendModelAction(ordinary,before,{id:"turnout-over",type:"COHORT_TURNOUT_SCALE",
      scope:{kind:"state",stateId:"47"},cohortIds:["fiction-a"],factor:100})).toThrow();
    const once=appendModelAction(ordinary,before,transfer());
    expect(()=>appendModelAction(ordinary,once,transfer())).toThrow(/Duplicate/);
    expect(before.actions).toHaveLength(0);
    expect(before.output.result).toEqual(ordinary.result);
  });
  it("source-verified imported legacy formats retain source mismatch guards", () => {
    expect(()=>importCanonicalProject(
      JSON.stringify({schemaVersion:1,electionId:"not-the-verified-election",actions:[]}),
      original.election,original.units)).toThrow();
  });
  it("canonical generator + v3 codec are a strict dependency, never browser-made substitutes", () => {
    const ordinary=start();
    if (!modelGeneratorReady) {
      expect(()=>beginSyntheticModel(ordinary)).toThrow(/not yet integrated/);
    } else {
      const generated=beginSyntheticModel(ordinary,"seed-round-five");
      expect(generated.output.result.units).toEqual(ordinary.result.units);
      expect(generated.output.cells.length).toBeGreaterThan(95);
      const changed=appendModelAction(ordinary,generated,{
        id:"integration-transfer",type:"COHORT_TRANSFER_PP",scope:{kind:"county",countyIds:multi},
        cohortIds:[generated.partition.cohorts[0]!.id],fromCandidateId:"aster",toCandidateId:"cedar",points:1});
      checkCounties(ordinary,changed,multi);
      if (canonicalV3Ready) {
        const json=exportProjectWithModel(ordinary,changed,original.election,original.units);
        expect(JSON.parse(json).schemaVersion).toBe(3);
        const restored=importCanonicalProject(json,original.election,original.units);
        expect(restored.model?.output.result).toEqual(changed.output.result);
        expect(restored.model?.actions).toEqual(changed.actions);
      }
    }
  });
  it("v3 saving is blocked when absent and never emits an incomplete v2 project", () => {
    const ordinary=start(), model=testModel(ordinary);
    if (!canonicalV3Ready) expect(()=>exportProjectWithModel(ordinary,model,original.election,original.units))
      .toThrow(/not yet integrated/);
  });
  it("candidate-neutral test partition preserves expanded registry before modeling", () => {
    let ordinary=addRegistryCandidate(start(),{id:"group-independent",name:"Fictional Extra",color:"#BB55CC"});
    ordinary=applyRegistryAction(ordinary,{id:"ordinary-share",type:"SET_SHARE",scope:{kind:"county",countyIds:["47037"]},
      candidateId:"group-independent",targetPercent:6,redistribution:{kind:"proportional-other"}});
    const model=testModel(ordinary);
    expect(model.output.result.units).toEqual(ordinary.result.units);
    expect(model.output.cells.every(c=>Object.hasOwn(c.votes,"group-independent"))).toBe(true);
  });
  it("SSR Model Lab is explicit about observed-vs-synthetic and offers keyboard-group controls", () => {
    const ordinary=start(), model=testModel(ordinary);
    const props={candidates:ordinary.election.candidates,selectedIds:multi,
      scope:{kind:"county" as const,countyIds:multi},scopeLabel:"3 selected counties",
      model,generatorReady:true,canonicalSaveReady:false,onStart:()=>true,
      onApply:()=>true,onUndo:()=>{},onResetEdits:()=>{},onExit:()=>{}};
    const html=renderToStaticMarkup(createElement(ModelLab,props));
    expect(html).toContain("Not observed voting behavior");
    expect(html).toContain("fictional");
    expect(html).toContain('aria-label="Selected modeled subgroup results"');
    expect(html).toContain("Select fictional groups");
    expect(html).toContain("Model save/load is DISABLED");
    const inactive=renderToStaticMarkup(createElement(ModelLab,{...props,model:null,generatorReady:false}));
    expect(inactive).toContain("canonical fictional cohort generator");
    expect(inactive).toContain("disabled");
  });
});
