import {test,expect} from "@playwright/test";
import {compositionPartitionId} from "@votatlas/sim-core";
import type {Page,TestInfo} from "@playwright/test";
async function screenshot(page:Page,info:TestInfo,name:string){
  const path=info.outputPath(name+".png");
  await page.screenshot({path,fullPage:true});
  await info.attach(name,{path,contentType:"image/png"});
}
const number=async(page:Page,testId:string):Promise<number>=>
  Number((await page.getByTestId(testId).innerText()).replace(/[^\d-]/g,""));
async function choose(page:Page,name:string,id:string){
  await page.getByRole("searchbox",{name:"Find a county by name or FIPS code"}).fill(name);
  await page.getByRole("button",{name:new RegExp(name+" County "+id)}).click();
}
type Inspect={fill:string|null;winnerCandidateId:string|null;zoom:number;moving:boolean;rendered:boolean};
const inspect=(page:Page,id:string)=>page.evaluate(geoId=>{
  const api=(window as Window & {__votatlasMapForE2E?:{inspectCounty:(id:string)=>Inspect}}).__votatlasMapForE2E;
  return api?.inspectCounty(geoId)??null;
},id);
async function startFictional(page:Page){
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await expect(page.getByRole("button",{name:"Fictional demo"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("checkbox",{name:/I understand this is an explicitly hypothetical model/}).check();
  await page.getByRole("button",{name:/Start synthetic model/}).click();
  await expect(page.getByText(/Modeled partition:/)).toBeVisible();
}
async function raiseCedar(page:Page,pp:number){
  await page.getByLabel("Draw increased support from").selectOption("aster");
  const now=Number((await page.getByTestId("current-support-cedar").innerText()).replace(/[^\d.]/g,""));
  const proposal=Math.min(100,Math.round((now+pp)*10)/10);
  await page.getByRole("spinbutton",{name:/Proposed support percent for Cedar Vale/}).fill(String(proposal));
  await expect(page.getByTestId("support-delta-cedar")).toContainText("proposed");
  await page.getByRole("button",{name:/Apply modeled support for Cedar Vale/}).click();
  await expect(page.getByText(/Applied COHORT_TRANSFER_PP/)).toBeVisible();
}
test("R6 Age/Education source tabs disclose correct adult Census denominators and fail closed until verified",async({page},info)=>{
  await page.goto("/");
  await page.getByLabel("Area scope").selectOption("state");
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await expect(page.getByText("Not observed voting behavior.")).toBeVisible();
  await page.getByRole("button",{name:"Age · 18+"}).click();
  await expect(page.getByRole("button",{name:"Age · 18+"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByText(/2024 ACS 5-year population estimate/)).toBeVisible();
  await expect(page.getByText(/Adults age 18\+/)).toBeVisible();
  await expect(page.getByText("Census population ≠ voting behavior.")).toBeVisible();
  const age=page.getByTestId("acs-source-unavailable");
  if(await age.count()) {
    await expect(age).toContainText(/Census|source|ACS|verif/i);
    await expect(page.getByRole("button",{name:"Start source-labeled hypothetical age model"})).toBeDisabled();
    await expect(page.getByTestId("acs-population-denominator")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("acs-source-metadata")).toContainText("2024 ACS 5-year");
    expect(await number(page,"acs-population-denominator")).toBeGreaterThan(0);
    await expect(page.getByLabel("Census population composition")).toContainText("NOT eligible voters");
  }
  await screenshot(page,info,"r6-age-source-metadata-or-verification-gate");
  await page.getByRole("button",{name:"Education · 25+"}).click();
  await expect(page.getByRole("button",{name:"Education · 25+"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByText(/People age 25\+/)).toBeVisible();
  await expect(page.getByText("B15003").first()).toBeVisible();
  const edu=page.getByTestId("acs-source-unavailable");
  if(await edu.count()) {
    await expect(edu).toContainText(/Census|source|ACS|verif/i);
    await expect(page.getByRole("button",{name:"Start source-labeled hypothetical education model"})).toBeDisabled();
    await expect(page.getByTestId("acs-population-denominator")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("acs-source-metadata")).toContainText("B15003");
    expect(await number(page,"acs-population-denominator")).toBeGreaterThan(0);
  }
  await screenshot(page,info,"r6-education-source-metadata-or-verification-gate");
});
test("R6 modeled candidate support slider changes three selected counties and conserves exact ballots",async({page},info)=>{
  await page.goto("/?e2e=1");
  await page.getByLabel("Area scope").selectOption("multi");
  await choose(page,"Davidson","47037");
  await choose(page,"Knox","47093");
  await choose(page,"Shelby","47157");
  const beforeAster=await number(page,"scope-votes-aster");
  const beforeCedar=await number(page,"scope-votes-cedar");
  const beforeBallots=await number(page,"scope-ballots");
  await expect.poll(async()=> (await inspect(page,"47037"))?.moving,{timeout:25000}).toBe(false);
  const outsideBefore=await inspect(page,"47001");
  const zoom=(await inspect(page,"47037"))!.zoom;
  await startFictional(page);
  await expect(page.getByLabel("Hypothetical candidate support sliders")).toBeVisible();
  await raiseCedar(page,2);
  const lost=beforeAster-await number(page,"scope-votes-aster");
  const gained=await number(page,"scope-votes-cedar")-beforeCedar;
  expect(lost).toBeGreaterThan(0);
  expect(lost).toBe(gained);
  expect(await number(page,"scope-ballots")).toBe(beforeBallots);
  expect((await inspect(page,"47001"))?.fill).toBe(outsideBefore?.fill);
  expect((await inspect(page,"47001"))?.winnerCandidateId).toBe(outsideBefore?.winnerCandidateId);
  await expect.poll(async()=> (await inspect(page,"47037"))?.moving).toBe(false);
  expect(Math.abs((await inspect(page,"47037"))!.zoom-zoom)).toBeLessThan(0.05);
  await screenshot(page,info,"r6-three-county-candidate-support-sliders");
  await page.getByRole("button",{name:"Undo model action"}).click();
  expect(await number(page,"scope-votes-aster")).toBe(beforeAster);
  expect(await number(page,"scope-votes-cedar")).toBe(beforeCedar);
});
test("R6 styled turnout slider supports Tennessee statewide model changes and canonical v3 replay",async({page},info)=>{
  await page.goto("/");
  await page.getByLabel("Area scope").selectOption("state");
  const before=await number(page,"scope-ballots");
  await startFictional(page);
  await expect(page.getByLabel("Hypothetical turnout factor slider")).toBeVisible();
  await page.getByLabel("Modeled turnout multiplier").fill("0.92");
  await expect(page.getByText("92% of present modeled group ballots")).toBeVisible();
  await page.getByRole("button",{name:"Apply COHORT_TURNOUT_SCALE"}).click();
  await expect(page.getByText(/Applied COHORT_TURNOUT_SCALE/)).toBeVisible();
  const after=await number(page,"scope-ballots");
  expect(after).toBeLessThan(before);
  expect(await number(page,"scope-ballots")).toBe(await number(page,"scope-ballots"));
  await screenshot(page,info,"r6-tennessee-statewide-turnout-slider");
  const saved=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export JSON"}).click();
  await saved;
  const raw=await page.getByLabel("Canonical model project JSON · v3").inputValue();
  expect(JSON.parse(raw).schemaVersion).toBe(3);
  expect(JSON.parse(raw).cohort.actions[0].scope).toEqual({kind:"state",stateId:"47"});
  await page.reload();
  await page.getByLabel("Scenario project JSON · v2 or legacy v1").fill(raw);
  await page.getByRole("button",{name:"Import JSON"}).click();
  await page.getByLabel("Area scope").selectOption("state");
  expect(await number(page,"scope-ballots")).toBe(after);
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await expect(page.getByText(/Modeled partition:/)).toBeVisible();
  await page.getByRole("button",{name:"Reset model edits"}).click();
  expect(await number(page,"scope-ballots")).toBe(before);
});
test("R6 real Davidson Census polygon winner fill changes after full-cohort modeled support slider",async({page},info)=>{
  await page.goto("/?e2e=1");
  await choose(page,"Davidson","47037");
  await expect.poll(async()=> (await inspect(page,"47037"))?.rendered,{timeout:25000}).toBe(true);
  await expect.poll(async()=> (await inspect(page,"47037"))?.winnerCandidateId).toBe("aster");
  const before=(await inspect(page,"47037"))!;
  await startFictional(page);
  for(const checkbox of await page.locator(".model-cohort-choices input[type=checkbox]").all())await checkbox.check();
  await raiseCedar(page,9);
  await expect.poll(async()=> (await inspect(page,"47037"))?.winnerCandidateId,{timeout:15000}).toBe("cedar");
  const after=(await inspect(page,"47037"))!;
  expect(after.fill).toBe("#B47F15");
  expect(before.fill).toBe("#7544A6");
  await screenshot(page,info,"r6-real-map-davidson-winner-flip");
});

test("R6 sourced ACS age population → E2 hypothetical cohort fit → 3-county transfer and canonical v3, or explicit integration gate",async({page},info)=>{
  await page.goto("/?e2e=1");
  await page.getByLabel("Area scope").selectOption("multi");
  await choose(page,"Davidson","47037");
  await choose(page,"Knox","47093");
  await choose(page,"Shelby","47157");
  const beforeBallots=await number(page,"scope-ballots");
  const beforeAster=await number(page,"scope-votes-aster");
  const beforeCedar=await number(page,"scope-votes-cedar");
  await expect.poll(async()=> (await inspect(page,"47037"))?.moving,{timeout:25000}).toBe(false);
  const outsideBefore=await inspect(page,"47001");
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await page.getByRole("checkbox",{name:/I understand this is an explicitly hypothetical model/}).check();
  await page.getByRole("button",{name:"Age · 18+"}).click();
  const sourceUnavailable=page.getByTestId("acs-source-unavailable");
  if(await sourceUnavailable.isVisible()){
    await expect(sourceUnavailable).toContainText(/verified|source|ACS|Census/i);
    await expect(page.getByTestId("acs-population-denominator")).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Start source-labeled hypothetical age model"})).toBeDisabled();
    await screenshot(page,info,"r6-acs-age-not-integrated-no-fabricated-shares");
  } else {
    await expect(page.getByTestId("acs-source-metadata")).toContainText("B01001");
    await expect(page.getByTestId("acs-source-sha256")).toContainText("SHA-256");
    expect(await number(page,"acs-population-denominator")).toBeGreaterThan(0);
    await expect(page.getByText("Census population ≠ voting behavior.")).toBeVisible();
    const start=page.getByRole("button",{name:"Start source-labeled hypothetical age model"});
    if(await start.isDisabled()){
      await expect(page.getByTestId("acs-fit-unavailable")).toContainText("E2");
      await screenshot(page,info,"r6-source-ready-fit-not-yet-integrated");
    }else{
      await page.getByRole("slider",{name:/Hypothetical electorate weight for/}).first().focus();
      await page.keyboard.press("ArrowRight");
      await start.click();
      await expect(page.getByText(/Modeled partition:/)).toBeVisible();
      await expect(page.getByText(/Census population ≠ voting behavior/)).toBeVisible();
      await expect(page.getByTestId("model-area")).toContainText("3 selected counties");
      await raiseCedar(page,1);
      const lost=beforeAster-await number(page,"scope-votes-aster");
      const gained=await number(page,"scope-votes-cedar")-beforeCedar;
      expect(lost).toBeGreaterThan(0);
      expect(lost).toBe(gained);
      expect(await number(page,"scope-ballots")).toBe(beforeBallots);
      expect((await inspect(page,"47001"))?.fill).toBe(outsideBefore?.fill);
      await screenshot(page,info,"r6-acs-backed-hypothetical-age-model");
      const download=page.waitForEvent("download");
      await page.getByRole("button",{name:"Export JSON"}).click();
      await download;
      const saved=await page.getByLabel("Canonical model project JSON · v3").inputValue();
      const parsed=JSON.parse(saved);
      expect(parsed.schemaVersion).toBe(3);
      expect(parsed.cohort.model.modelId).not.toBe("fictional-cohort-demo");
      expect(parsed.cohort.actions).toHaveLength(1);
      await page.reload();
      await page.getByLabel("Scenario project JSON · v2 or legacy v1").fill(saved);
      await page.getByRole("button",{name:"Import JSON"}).click();
      await page.getByLabel("Area scope").selectOption("multi");
      await choose(page,"Davidson","47037");
      await choose(page,"Knox","47093");
      await choose(page,"Shelby","47157");
      expect(await number(page,"scope-votes-cedar")).toBe(beforeCedar+gained);
      await page.getByRole("button",{name:"Model Lab",exact:true}).click();
      await expect(page.getByText(/Modeled partition:/)).toBeVisible();
      await screenshot(page,info,"r6-acs-model-restored-v3");
      parsed.source.digest="sha256:"+"0".repeat(64);
      await page.getByLabel("Canonical model project JSON · v3").fill(JSON.stringify(parsed));
      await page.getByRole("button",{name:"Import JSON"}).click();
      await expect(page.locator(".scenario-error")).toContainText("SOURCE_MISMATCH");
      expect(await number(page,"scope-votes-cedar")).toBe(beforeCedar+gained);
      const staleProfile=JSON.parse(saved);
      const assumptionDigest=staleProfile.cohort.model.seed.split(".")[1];
      const staleSeed="sha256:"+"0".repeat(64)+"."+assumptionDigest;
      staleProfile.cohort.model.seed=staleSeed;
      staleProfile.cohort.partition.partitionId=compositionPartitionId(staleSeed);
      await page.getByLabel("Canonical model project JSON · v3").fill(JSON.stringify(staleProfile));
      await page.getByRole("button",{name:"Import JSON"}).click();
      await expect(page.locator(".scenario-error")).toContainText("different ACS population profile");
      expect(await number(page,"scope-votes-cedar")).toBe(beforeCedar+gained);
    }
  }
});
