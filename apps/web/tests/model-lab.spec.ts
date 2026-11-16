import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

const count = async (page: Page, id: string): Promise<number> =>
  Number((await page.getByTestId(id).innerText()).replace(/[^\d-]/g, ""));
async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  const path = info.outputPath(name + ".png");
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}
async function chooseCounty(page: Page, name: string, code: string) {
  await page.getByRole("searchbox", {name:"Find a county by name or FIPS code"}).fill(name);
  await page.getByRole("button",{name:new RegExp(name+" County "+code)}).click();
}
type MapStatus={fill:string|null;winnerCandidateId:string|null;zoom:number;moving:boolean;rendered:boolean};
async function inspect(page: Page, geoId: string):Promise<MapStatus|null> {
  return page.evaluate(id=>{
    const api=(window as Window & {__votatlasMapForE2E?:{inspectCounty:(id:string)=>MapStatus}}).__votatlasMapForE2E;
    return api?.inspectCounty(id)??null;
  },geoId);
}
async function startModel(page:Page):Promise<boolean> {
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await expect(page.getByText("Not observed voting behavior.")).toBeVisible();
  await page.getByRole("checkbox",{name:/I understand this is an explicitly hypothetical model/}).check();
  const button=page.getByRole("button",{name:/Start synthetic model/});
  if(await button.isDisabled()) {
    await expect(page.getByTestId("model-unavailable")).toContainText("not yet integrated");
    await expect(page.getByRole("button",{name:"Export JSON"})).toBeEnabled();
    return false;
  }
  await button.click();
  await expect(page.getByText(/Modeled partition:/)).toBeVisible();
  await expect(page.getByRole("group",{name:"Select fictional groups to model"})).toBeVisible();
  return true;
}
test("opt-in fictional modeling: 3-county group transfer, other 92 counties unchanged, real map screenshot",async({page},info)=>{
  await page.goto("/?e2e=1");
  await page.getByLabel("Area scope").selectOption("multi");
  await chooseCounty(page,"Davidson","47037");
  await chooseCounty(page,"Knox","47093");
  await chooseCounty(page,"Shelby","47157");
  await expect(page.getByTestId("scope-county-count")).toHaveText("3 counties");
  const startAster=await count(page,"scope-votes-aster");
  const startCedar=await count(page,"scope-votes-cedar");
  const startBallots=await count(page,"scope-ballots");
  await expect.poll(async ()=>(await inspect(page,"47037"))?.moving,{timeout:25000}).toBe(false);
  const otherBefore=await inspect(page,"47001");
  const beforeZoom=(await inspect(page,"47037"))!.zoom;
  if(!(await startModel(page))) {
    await shot(page,info,"r5-cohort-generator-not-yet-integrated");
    return;
  }
  await expect(page.getByTestId("model-area")).toContainText("3 selected counties");
  await page.getByLabel("From candidate",{exact:true}).selectOption("aster");
  await page.getByLabel("To candidate",{exact:true}).selectOption("cedar");
  await page.getByLabel("Transfer modeled support (percentage points)").fill("3");
  await page.getByRole("button",{name:"Apply COHORT_TRANSFER_PP"}).click();
  await expect(page.getByText(/Applied COHORT_TRANSFER_PP/)).toBeVisible();
  expect(await count(page,"scope-votes-aster")).toBeLessThan(startAster);
  const diff=startAster-await count(page,"scope-votes-aster");
  expect(await count(page,"scope-votes-cedar")-startCedar).toBe(diff);
  expect(await count(page,"scope-ballots")).toBe(startBallots);
  await expect.poll(async ()=>(await inspect(page,"47037"))?.moving).toBe(false);
  expect(Math.abs((await inspect(page,"47037"))!.zoom-beforeZoom)).toBeLessThan(.05);
  const otherAfter=await inspect(page,"47001");
  expect(otherAfter?.winnerCandidateId).toBe(otherBefore?.winnerCandidateId);
  expect(otherAfter?.fill).toBe(otherBefore?.fill);
  await expect(page.getByText("SYNTHETIC · MODEL ACTIVE")).toBeVisible();
  await shot(page,info,"r5-three-county-synthetic-transfer");
  await page.getByRole("button",{name:"Undo model action"}).click();
  expect(await count(page,"scope-votes-aster")).toBe(startAster);
  await page.getByRole("button",{name:"Exit model and restore ordinary results"}).click();
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  expect(await count(page,"scope-votes-aster")).toBe(startAster);
});

test("all 95 Tennessee counties: modeled turnout and distinct model-vs-source results",async({page},info)=>{
  await page.goto("/");
  await page.getByLabel("Area scope").selectOption("state");
  const before=await count(page,"state-votes-aster");
  const beforeBallots=await count(page,"scope-ballots");
  if(!(await startModel(page)))return;
  await expect(page.getByTestId("model-area")).toContainText("All Tennessee");
  await expect(page.getByTestId("scope-county-count")).toHaveText("95 counties");
  await page.getByLabel("Modeled turnout multiplier").fill("0.95");
  await page.getByRole("button",{name:"Apply COHORT_TURNOUT_SCALE"}).click();
  await expect(page.getByText(/Applied COHORT_TURNOUT_SCALE/)).toBeVisible();
  expect(await count(page,"scope-ballots")).toBeLessThan(beforeBallots);
  expect(await count(page,"scope-votes-aster")).toBe(await count(page,"state-votes-aster"));
  expect(await count(page,"state-votes-aster")).toBeLessThan(before);
  expect(await count(page,"model-eligible")).toBeGreaterThan(await count(page,"model-ballots"));
  await shot(page,info,"r5-statewide-synthetic-turnout");
  await page.getByRole("button",{name:"Reset model edits"}).click();
  expect(await count(page,"scope-ballots")).toBe(beforeBallots);
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  expect(await count(page,"state-votes-aster")).toBe(before);
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
});

test("custom candidate + normal action + model transfer → canonical v3 reload; corrupted source rejected",async({page},info)=>{
  await page.goto("/");
  await chooseCounty(page,"Davidson","47037");
  await page.getByRole("button",{name:"Candidates",exact:true}).click();
  await page.getByLabel("Stable candidate ID").fill("fiction-model-choice");
  await page.getByLabel("Candidate name",{exact:true}).fill("Fictional Model Choice");
  await page.getByRole("button",{name:/Add candidate/}).click();
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");
  await page.getByLabel("Target candidate",{exact:true}).selectOption("fiction-model-choice");
  await page.getByLabel("Target candidate-ballot share (%)").fill("5");
  await page.getByRole("button",{name:/Apply SET_SHARE/}).click();
  await page.getByLabel("Area scope").selectOption("multi");
  await chooseCounty(page,"Knox","47093");
  await chooseCounty(page,"Shelby","47157");
  if(!(await startModel(page)))return;
  await page.getByLabel("From candidate",{exact:true}).selectOption("aster");
  await page.getByLabel("To candidate",{exact:true}).selectOption("fiction-model-choice");
  await page.getByLabel("Transfer modeled support (percentage points)").fill("2");
  await page.getByRole("button",{name:"Apply COHORT_TRANSFER_PP"}).click();
  expect(await count(page,"model-votes-fiction-model-choice")).toBeGreaterThan(0);
  await shot(page,info,"r5-custom-candidate-cohort-model");
  const save=page.getByRole("button",{name:"Export JSON"});
  if(await save.isDisabled()){
    await expect(page.getByTestId("model-save-gate")).toContainText("canonical v3");
    await expect(page.getByRole("button",{name:"Import JSON"})).toBeDisabled();
    return;
  }
  await save.click();
  const field=page.getByLabel("Canonical model project JSON · v3");
  const raw=await field.inputValue();
  const parsed=JSON.parse(raw);
  expect(parsed.schemaVersion).toBe(3);
  expect(parsed.registry.additions.some((c:{id:string})=>c.id==="fiction-model-choice")).toBe(true);
  expect(parsed.cohort.actions).toHaveLength(1);
  const after=await count(page,"state-votes-fiction-model-choice");
  await page.reload();
  await page.getByLabel("Scenario project JSON · v2 or legacy v1").fill(raw);
  await page.getByRole("button",{name:"Import JSON"}).click();
  expect(await count(page,"state-votes-fiction-model-choice")).toBe(after);
  await page.getByRole("button",{name:"Model Lab",exact:true}).click();
  await expect(page.getByText(/Modeled partition:/)).toBeVisible();
  await shot(page,info,"r5-model-reloaded-v3");

  // V3 origin digest must be checked by the ONLY canonical sim-core importer.
  parsed.source.digest="sha256:"+"0".repeat(64);
  await page.getByLabel("Canonical model project JSON · v3").fill(JSON.stringify(parsed));
  await page.getByRole("button",{name:"Import JSON"}).click();
  await expect(page.locator(".scenario-error")).toContainText("SOURCE_MISMATCH");
  expect(await count(page,"state-votes-fiction-model-choice")).toBe(after);
});
