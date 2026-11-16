import { test, expect } from "@playwright/test";

test("synthetic map, scoreboard, keyboard selection, and controls render", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  await expect(page.locator('[data-testid="candidate-score"]')).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Find a county by name or FIPS code" }).fill("Davidson");
  const county = page.getByRole("button", { name: /Davidson 47037/ });
  await county.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Davidson" })).toBeVisible();
  await page.getByLabel("Apply adjustment to").selectOption("county");
  await page.getByRole("button", { name: /Queue TRANSFER_PP action/ }).click();
  await expect(page.getByText("1 pending")).toBeVisible();
  await expect(page.getByText(/Demo vote totals remain unchanged/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("votatlas-smoke.png"), fullPage: true });
  await info.attach("votatlas-screen", { path: info.outputPath("votatlas-smoke.png"), contentType: "image/png" });
});
test("demographic controls are not executable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Demographics" })).toBeDisabled();
  await expect(page.getByText("Requires overlap-safe cohort data", { exact: false })).toBeVisible();
});
