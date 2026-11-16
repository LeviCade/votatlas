import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const counts = async (page: Page, id: string) => {
  const text = await page.getByTestId(id).innerText();
  return Number(text.replace(/[^\d-]/g, ""));
};
async function choose(page: Page, name: string, geoId: string): Promise<void> {
  await page.getByRole("searchbox", { name: "Find a county by name or FIPS code" }).fill(name);
  await page.getByRole("button", { name: new RegExp(name + " County " + geoId) }).click();
}
type MapDiag = {
  zoom: number; moving: boolean; selectedFilter: unknown;
  fill: string | null; winnerCandidateId: string | null; rendered: boolean;
};
async function inspect(page: Page, geoId: string): Promise<MapDiag | null> {
  return page.evaluate(id => {
    const api = (window as Window & { __votatlasMapForE2E?: { inspectCounty: (id: string) => MapDiag } }).__votatlasMapForE2E;
    return api?.inspectCounty(id) ?? null;
  },geoId);
}
async function screenshot(page: Page, info: import("@playwright/test").TestInfo, name: string) {
  const path = info.outputPath(name + ".png");
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test("three searched counties: multi-select, transfer isolation, stable real map zoom, portable replay", async ({ page }, info) => {
  await page.goto("/?e2e=1");
  await page.getByLabel("Area scope").selectOption("multi");
  await choose(page,"Davidson","47037");
  await choose(page,"Knox","47093");
  await choose(page,"Shelby","47157");
  await expect(page.getByTestId("scope-county-count")).toHaveText("3 counties");
  await expect(page.getByTestId("active-scope")).toContainText("3 selected counties");
  await expect(page.getByTestId("active-adjustment-scope")).toContainText("3 selected counties");
  const beforeArea = await counts(page, "scope-votes-aster");
  const beforeState = await counts(page, "state-votes-aster");
  const beforeBallots = await counts(page, "scope-ballots");
  await expect.poll(async () => (await inspect(page,"47037"))?.zoom, {timeout: 25000}).toBeGreaterThan(0);
  await expect.poll(async () => (await inspect(page,"47037"))?.moving).toBe(false);
  const beforeZoom = (await inspect(page,"47037"))!.zoom;
  const outsideBefore = await inspect(page,"47001");
  await page.getByLabel("From candidate").selectOption("aster");
  await page.getByLabel("To candidate").selectOption("cedar");
  await page.getByLabel("Transfer (percentage points of candidate ballots)").fill("5");
  await page.getByRole("button", { name: "Apply TRANSFER_PP" }).click();
  const afterArea = await counts(page, "scope-votes-aster");
  const afterState = await counts(page, "state-votes-aster");
  expect(afterArea).toBeLessThan(beforeArea);
  expect(beforeArea - afterArea).toBe(beforeState - afterState);
  expect(await counts(page,"scope-ballots")).toBe(beforeBallots);
  await expect.poll(async () => (await inspect(page,"47037"))?.moving).toBe(false);
  const afterZoom = (await inspect(page,"47037"))!.zoom;
  expect(Math.abs(afterZoom - beforeZoom)).toBeLessThan(0.05);
  const outsideAfter = await inspect(page,"47001");
  expect(outsideAfter?.fill).toBe(outsideBefore?.fill);
  expect(outsideAfter?.winnerCandidateId).toBe(outsideBefore?.winnerCandidateId);
  await screenshot(page,info,"three-county-transfer-real-map");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name:"Export JSON"}).click();
  await downloadPromise;
  const saved=await page.getByLabel("Scenario project JSON · v2 or legacy v1").inputValue();
  const action=JSON.parse(saved).scenario.actions[0];
  expect(action.scope).toEqual({kind:"county",countyIds:["47037","47093","47157"]});
  await page.getByRole("button", {name:"Undo",exact:true}).click();
  expect(await counts(page,"scope-votes-aster")).toBe(beforeArea);
  await page.getByRole("button", {name:"Import JSON"}).click();
  expect(await counts(page,"scope-votes-aster")).toBe(afterArea);
  await page.getByRole("button", {name:"Reset",exact:true}).click();
  expect(await counts(page,"scope-votes-aster")).toBe(beforeArea);
});

test("entire loaded Tennessee state: typed state scope, 95-county totals and conservation", async ({ page }, info) => {
  await page.goto("/");
  await page.getByLabel("Area scope").selectOption("state");
  await expect(page.getByTestId("active-scope")).toContainText("All Tennessee");
  await expect(page.getByTestId("scope-county-count")).toHaveText("95 counties");
  await expect(page.getByTestId("selection-help")).toContainText("never to the entire United States");
  const before=await counts(page,"state-votes-aster");
  const ballots=await counts(page,"scope-ballots");
  expect(await counts(page,"scope-votes-aster")).toBe(before);
  await page.getByLabel("From candidate").selectOption("aster");
  await page.getByLabel("To candidate").selectOption("cedar");
  await page.getByLabel("Transfer (percentage points of candidate ballots)").fill("1");
  await page.getByRole("button", {name:"Apply TRANSFER_PP"}).click();
  const after=await counts(page,"state-votes-aster");
  expect(after).toBeLessThan(before);
  expect(await counts(page,"scope-votes-aster")).toBe(after);
  expect(await counts(page,"scope-ballots")).toBe(ballots);
  await screenshot(page,info,"tennessee-statewide-transfer");
  const download=page.waitForEvent("download");
  await page.getByRole("button", {name:"Export JSON"}).click();
  await download;
  const raw=await page.getByLabel("Scenario project JSON · v2 or legacy v1").inputValue();
  expect(JSON.parse(raw).scenario.actions[0].scope).toEqual({kind:"state",stateId:"47"});
  await page.getByRole("button", {name:"Undo", exact:true}).click();
  expect(await counts(page,"scope-votes-aster")).toBe(before);
});

test("real map click toggles multi selection; clearing prevents accidental adjustments", async ({page}, info) => {
  await page.goto("/?e2e=1");
  await page.getByLabel("Area scope").selectOption("multi");
  await expect.poll(async () => (await inspect(page,"47037"))?.rendered, {timeout:25000}).toBe(true);
  const point=await page.evaluate(() => {
    const api=(window as Window & {
      __votatlasMapForE2E?: {projectPoint:(lon:number,lat:number)=>{x:number;y:number}}
    }).__votatlasMapForE2E;
    return api?.projectPoint(-86.78,36.17) ?? null;
  });
  expect(point).not.toBeNull();
  await page.locator(".maplibregl-canvas").click({ position: point!, force: true });
  await expect(page.getByTestId("scope-county-count")).toHaveText("1 counties");
  await expect(page.getByTestId("active-scope")).toContainText("1 selected counties");
  await choose(page,"Shelby","47157");
  await expect(page.getByTestId("scope-county-count")).toHaveText("2 counties");
  await screenshot(page,info,"map-click-multi-selection");
  await page.getByRole("button", {name:"Clear selection"}).click();
  await expect(page.getByTestId("active-scope")).toContainText("0 selected counties");
  await expect(page.getByRole("region",{name:"Selected geographic area results"})).toContainText("Choose counties");
  await page.getByRole("button", {name:"Apply TRANSFER_PP"}).click();
  await expect(page.getByRole("status").last()).toContainText("Select one or more counties");
  await expect(page.getByText("0 applied").last()).toBeVisible();
});

test("custom candidate adjustments remain portable when scoped to multiple counties", async ({page},info) => {
  await page.goto("/");
  await page.getByRole("button",{name:"Candidates",exact:true}).click();
  await page.getByLabel("Stable candidate ID").fill("regional-choice");
  await page.getByLabel("Candidate name",{exact:true}).fill("Regional Choice");
  await page.getByRole("button",{name:"Add candidate"}).click();
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");
  await page.getByLabel("Area scope").selectOption("multi");
  await choose(page,"Davidson","47037");
  await choose(page,"Shelby","47157");
  await page.getByLabel("Target candidate",{exact:true}).selectOption("regional-choice");
  await page.getByLabel("Target candidate-ballot share (%)").fill("10");
  await page.getByRole("button",{name:"Apply SET_SHARE"}).click();
  expect(await counts(page,"scope-votes-regional-choice")).toBeGreaterThan(0);
  await screenshot(page,info,"multi-area-custom-candidate");
  await page.getByRole("button",{name:"Export JSON"}).click();
  const raw=await page.getByLabel("Scenario project JSON · v2 or legacy v1").inputValue();
  const project=JSON.parse(raw);
  expect(project.registry.additions).toHaveLength(1);
  expect(project.scenario.actions[0].scope).toEqual({kind:"county",countyIds:["47037","47157"]});
  await page.reload();
  await page.getByLabel("Scenario project JSON · v2 or legacy v1").fill(raw);
  await page.getByRole("button",{name:"Import JSON"}).click();
  await page.getByRole("button",{name:"Candidates",exact:true}).click();
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");
  await expect(page.getByTestId("state-votes-regional-choice")).toBeVisible();
});
