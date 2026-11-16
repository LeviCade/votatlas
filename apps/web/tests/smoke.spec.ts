import { test, expect } from "@playwright/test";

const votes = async (page: import("@playwright/test").Page, id: string): Promise<number> => {
  const text = await page.getByTestId(id).innerText();
  return Number(text.replace(/[^\d-]/g, ""));
};
async function selectDavidson(page: import("@playwright/test").Page) {
  const input = page.getByRole("searchbox", { name: "Find a county by name or FIPS code" });
  await input.fill("Davidson");
  const county = page.getByRole("button", { name: /Davidson County 47037/ });
  await county.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Davidson County" })).toBeVisible();
}

test("95-county live transfer, undo, reset, JSON replay + screenshot", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  const tileCount = await page.getByTestId("county-map-tile").count();
  if (tileCount) {
    expect(tileCount).toBe(95); // Explicit non-geographic fallback before E3 merges.
  } else {
    await expect(page.getByTestId("county-map-real")).toBeVisible(); // E3's real county polygons.
    await expect(page.locator(".map-disclaimer")).toContainText("US Census");
  }
  await expect(page.locator('[data-testid="candidate-score"]')).toHaveCount(3);
  await selectDavidson(page);
  const beforeAster = await votes(page, "county-votes-aster");
  const beforeCedar = await votes(page, "county-votes-cedar");
  const beforeState = await votes(page, "state-votes-aster");
  await page.getByLabel("From candidate").selectOption("aster");
  await page.getByLabel("To candidate").selectOption("cedar");
  await page.getByLabel("Transfer (percentage points of candidate ballots)").fill("5");
  await page.getByRole("button", { name: "Apply TRANSFER_PP" }).click();

  const afterAster = await votes(page, "county-votes-aster");
  const afterCedar = await votes(page, "county-votes-cedar");
  const afterState = await votes(page, "state-votes-aster");
  expect(afterAster).toBeLessThan(beforeAster);
  expect(afterCedar - beforeCedar).toBe(beforeAster - afterAster);
  expect(beforeState - afterState).toBe(beforeAster - afterAster);
  await expect(page.getByText("1 applied")).toBeVisible();
  await page.screenshot({ path: info.outputPath("votatlas-after-transfer.png"), fullPage: true });
  await info.attach("votatlas-after-transfer", { path: info.outputPath("votatlas-after-transfer.png"), contentType: "image/png" });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("votatlas-scenario.json");
  const exported = await page.getByLabel("Scenario JSON · schema v1").inputValue();
  expect(JSON.parse(exported).actions).toHaveLength(1);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await votes(page, "county-votes-aster")).toBe(beforeAster);
  expect(await votes(page, "state-votes-aster")).toBe(beforeState);
  await page.getByRole("button", { name: "Import JSON" }).click();
  expect(await votes(page, "county-votes-aster")).toBe(afterAster);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  expect(await votes(page, "county-votes-aster")).toBe(beforeAster);
  expect(await votes(page, "county-votes-cedar")).toBe(beforeCedar);
  expect(await votes(page, "state-votes-aster")).toBe(beforeState);
  await page.getByLabel("Import scenario JSON file").setInputFiles({
    name: "saved-scenario.json", mimeType: "application/json", buffer: Buffer.from(exported),
  });
  await expect(page.getByText(/Imported 1 action/)).toBeVisible();
  expect(await votes(page, "county-votes-aster")).toBe(afterAster);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  expect(await votes(page, "county-votes-aster")).toBe(beforeAster);
  await page.screenshot({ path: info.outputPath("votatlas-live-sandbox.png"), fullPage: true });
  await info.attach("votatlas-live-sandbox", { path: info.outputPath("votatlas-live-sandbox.png"), contentType: "image/png" });
});

test("rejected impossible transfer and malformed import do not change results", async ({ page }) => {
  await page.goto("/");
  await selectDavidson(page);
  const beforeAster = await votes(page, "county-votes-aster");
  await page.getByLabel("To candidate").selectOption("cedar");
  await page.getByLabel("Transfer (percentage points of candidate ballots)").fill("100");
  await page.getByRole("button", { name: "Apply TRANSFER_PP" }).click();
  await expect(page.getByRole("alert")).toContainText("INSUFFICIENT_SUPPORT");
  expect(await votes(page, "county-votes-aster")).toBe(beforeAster);
  await page.getByLabel("Scenario JSON · schema v1").fill('{"schemaVersion":1,"electionId":"wrong","actions":[]}');
  await page.getByRole("button", { name: "Import JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("INVALID_SCENARIO");
  expect(await votes(page, "county-votes-aster")).toBe(beforeAster);
  await expect(page.getByRole("button", { name: "Demographics" })).toBeDisabled();
});
