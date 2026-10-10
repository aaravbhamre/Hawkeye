import { expect, test } from "@playwright/test";
import { samples } from "../../lib/fixtures";
test("real backend demo: duplicate invariant, source evidence, market context, and export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("FIX Detective | Hawkeye");
  const analyzed = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Load clean sample" }).click();
  expect((await analyzed).status()).toBe(200);
  await expect(page.getByTestId("filled-total")).toHaveText("150");
  await page.getByRole("button", { name: "Inject duplicate fill" }).click();
  await expect(
    page.getByText("DUPLICATE EXECUTION", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("filled-total")).toHaveText("150");
  await page.getByRole("button", { name: "ORD-1001", exact: true }).click();
  await page.locator(".evidence").first().click();
  await expect(page.locator("details[open] .source-detail code")).toBeVisible();
  await page
    .getByLabel("Execution", { exact: true })
    .selectOption({ label: "15:32:10.000 · 60 @ 191" });
  await page.getByRole("button", { name: "Check execution price" }).click();
  await expect(
    page.getByText("SYNTHETIC FIXTURE · synthetic-demo", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("39.421813 bps", { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.analysis.summary.observedFilledQty).toBe("150");
  expect(exported.marketComparisons[0].provider).toBe("fixture");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
});
test("faults and edited uploads remain real input; mobile fits viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Load clean sample" }).click();
  await expect(page.getByTestId("filled-total")).toHaveText("150");
  await page.getByRole("button", { name: "Shuffle delivery" }).click();
  await expect(
    page.getByText("No anomalies in supported evidence"),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "uploaded.fix",
      mimeType: "text/plain",
      buffer: Buffer.from(samples[0].text),
    });
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByText("uploaded.fix:1", { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove acknowledgment" }).click();
  await expect(
    page.getByText("MISSING ACK", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByText("No anomalies in supported evidence"),
  ).toBeVisible();
  await page.getByLabel("FIX messages").fill("malformed message");
  await expect(
    page.getByRole("button", { name: "Export JSON" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByText("MALFORMED FIELD", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
});
test("API rejects forged market evidence and unavailable AI remains transparent", async ({
  request,
}) => {
  const ai = await request.post("/api/investigate", {
    data: { text: "bad", question: "Explain" },
  });
  expect([401, 503]).toContain(ai.status());
  const market = await request.post("/api/market", {
    data: {
      text: "bad",
      provider: "fixture",
      sourceId: "made-up",
      referencePrice: "1",
    },
  });
  expect(market.status()).toBe(400);
});
