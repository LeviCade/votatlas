import { test, expect } from "@playwright/test";

type Inspection = {
  geoId: string; sourceFeatureCount: number; fill: string | null;
  winnerCandidateId: string | null; layerColorExpression: unknown;
  rendered: boolean; zoom: number; moving: boolean;
};
async function inspect(page: import("@playwright/test").Page): Promise<Inspection | null> {
  return page.evaluate(() => {
    const win = window as Window & {
      __votatlasMapForE2E?: { inspectCounty: (geoId: string) => Inspection }
    };
    return win.__votatlasMapForE2E?.inspectCounty("47037") ?? null;
  });
}
async function selectDavidson(page: import("@playwright/test").Page) {
  await page.getByRole("searchbox", { name: "Find a county by name or FIPS code" }).fill("Davidson");
  const county = page.getByRole("button", { name: /Davidson County 47037/ });
  await county.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "County details" }).getByRole("heading", { name: "Davidson County" })).toBeVisible();
}

test("REAL Census MapLibre geometry: Aster to Cedar winner flip recolors source with stable zoom", async ({ page }, info) => {
  await page.goto("/?e2e=1");
  await expect(page.getByTestId("county-map-real")).toBeVisible();
  await expect(page.locator(".map-disclaimer")).toContainText("US Census boundaries");
  await selectDavidson(page);
  // The e2e query flag enables read-only MapLibre source inspection, not a
  // DOM-only scoreboard assertion or a fabricated SVG/color swatch.
  await expect.poll(async () => (await inspect(page))?.fill, { timeout: 25000 }).toBe("#7544A6");
  await expect.poll(async () => (await inspect(page))?.rendered).toBe(true);
  await expect.poll(async () => (await inspect(page))?.moving, { timeout: 10000 }).toBe(false);
  const before = (await inspect(page))!;
  expect(before.winnerCandidateId).toBe("aster");
  await expect(page.getByTestId("selected-county-leader")).toContainText("Aster Rowan");
  expect(before.sourceFeatureCount).toBeGreaterThan(0);
  expect(before.layerColorExpression).toEqual(["get", "fill"]);
  await page.screenshot({ path: info.outputPath("davidson-aster-real-map.png"), fullPage: true });
  await info.attach("davidson-aster-real-map", {
    path: info.outputPath("davidson-aster-real-map.png"), contentType: "image/png",
  });

  await page.getByLabel("From candidate").selectOption("aster");
  await page.getByLabel("To candidate").selectOption("cedar");
  await page.getByLabel("Transfer (percentage points of candidate ballots)").fill("7");
  await page.getByRole("button", { name: "Apply TRANSFER_PP" }).click();
  await expect.poll(async () => (await inspect(page))?.fill, { timeout: 25000 }).toBe("#B47F15");
  await expect.poll(async () => (await inspect(page))?.moving, { timeout: 10000 }).toBe(false);
  const after = (await inspect(page))!;
  expect(after.winnerCandidateId).toBe("cedar");
  await expect(page.getByTestId("selected-county-leader")).toContainText("Cedar Vale");
  expect(after.rendered).toBe(true);
  expect(after.layerColorExpression).toEqual(["get", "fill"]);
  expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.05);
  await expect(page.getByTestId("county-delta-cedar")).not.toHaveText("baseline");
  await page.screenshot({ path: info.outputPath("davidson-cedar-flip-real-map.png"), fullPage: true });
  await info.attach("davidson-cedar-flip-real-map", {
    path: info.outputPath("davidson-cedar-flip-real-map.png"), contentType: "image/png",
  });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await inspect(page))?.fill).toBe("#7544A6");
});

test("candidate editor: add, rename, reject unsafe removal, portable project roundtrip and reset", async ({ page }, info) => {
  await page.goto("/");
  await selectDavidson(page);
  await page.getByRole("button", { name: "Candidates", exact: true }).click();
  await page.getByLabel("Stable candidate ID").fill("new-future");
  await page.getByLabel("Candidate name", { exact: true }).fill("Future Choice");
  await page.getByLabel("Affiliation (optional)").fill("Nonpartisan");
  await page.getByLabel("Candidate map color").fill("#E05B6C");
  await page.getByRole("button", { name: "Add candidate" }).click();
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");
  await page.getByRole("button", { name: "Rename Future Choice" }).click();
  await page.getByLabel("Rename Future Choice").fill("Future Choice Renamed");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("region", { name: "Candidate registry editor" }).getByText("Future Choice Renamed", { exact: true })).toBeVisible();

  await page.getByLabel("Target candidate", { exact: true }).selectOption("new-future");
  await page.getByLabel("Target candidate-ballot share (%)").fill("15");
  await page.getByRole("button", { name: "Apply SET_SHARE" }).click();
  await expect(page.getByRole("button", { name: "Remove Future Choice Renamed" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Future Choice Renamed" }).click();
  await expect(page.getByRole("alert")).toContainText(/history|votes/i);
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("votatlas-project.json");
  const saved = await page.getByLabel("Scenario project JSON · v2 or legacy v1").inputValue();
  expect(JSON.parse(saved).schemaVersion).toBe(2);
  await page.screenshot({ path: info.outputPath("custom-candidate-editor.png"), fullPage: true });
  await info.attach("custom-candidate-editor", {
    path: info.outputPath("custom-candidate-editor.png"), contentType: "image/png",
  });

  await page.reload();
  await page.getByLabel("Scenario project JSON · v2 or legacy v1").fill(saved);
  await page.getByRole("button", { name: "Import JSON" }).click();
  await page.getByRole("button", { name: "Candidates", exact: true }).click();
  await expect(page.getByTestId("registry-count")).toHaveText("4 candidates");
  await expect(page.getByRole("region", { name: "Candidate registry editor" }).getByText("Future Choice Renamed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("state-votes-new-future")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("registry-count")).toHaveText("3 candidates");
  await expect(page.getByTestId("candidate-score")).toHaveCount(3);
});

test("ten-candidate UI remains accessible and all names are selectable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Candidates", exact: true }).click();
  for (let i = 4; i <= 10; i++) {
    await page.getByLabel("Stable candidate ID").fill("future-" + i);
    await page.getByLabel("Candidate name", { exact: true }).fill("Future " + i);
    await page.getByRole("button", { name: "Add candidate" }).click();
  }
  await expect(page.getByTestId("registry-count")).toHaveText("10 candidates");
  await expect(page.getByTestId("candidate-score")).toHaveCount(10);
  await page.getByRole("button", { name: "Local", exact: true }).click();
  const options = page.getByLabel("To candidate").locator("option");
  await expect(options).toHaveCount(10);
  await page.getByLabel("To candidate").selectOption("future-10");
  await expect(page.getByLabel("To candidate")).toHaveValue("future-10");
});
