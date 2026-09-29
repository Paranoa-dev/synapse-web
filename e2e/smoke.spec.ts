import { expect, test } from "@playwright/test";

/**
 * Deliberately minimal smoke coverage: the point of this suite today is to give
 * the cross-engine matrix something real to run and to prove the app boots and
 * every tab renders in each engine. Behavioural coverage belongs in the Vitest
 * suite; this is the layer Vitest cannot reach.
 */

test("dashboard shell renders the connect control", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("SYNAPSE", { exact: true })).toBeVisible();
  await expect(page.getByText("TESTNET").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "connect wallet" })).toBeVisible();
});

test("every tab in the nav renders without hitting a tab error boundary", async ({ page }) => {
  await page.goto("/");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);

  // Text unique to each tab, used to prove the tab actually swapped its content
  // rather than falling back to the TabErrorBoundary recovery screen.
  const markers: Record<string, string> = {
    dashboard: "TOTAL TXS",
    transactions: "TRANSACTION LOOKUP",
    admin: "PRIVILEGED ZONE",
    docs: "CONTRACT ABI REFERENCE",
  };

  for (const [name, marker] of Object.entries(markers)) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByText(marker).first()).toBeVisible();
    // TabErrorBoundary's own copy, not the boundary's `title` prop.
    await expect(page.getByText("Recovery screen")).toHaveCount(0);
  }
});

test("docs tab renders the contract ABI reference", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "docs" }).click();

  // Spot-check endpoints from lib/constants.ts :: ABI_ENDPOINTS. If the
  // reference ever stops rendering, this fails rather than silently shipping an
  // empty docs tab in one engine only.
  for (const endpoint of ["initialize", "register_transaction", "health"]) {
    await expect(page.getByText(endpoint, { exact: true }).first()).toBeVisible();
  }
});

test("an unknown route renders the 404 page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Route not found" })).toBeVisible();
});
