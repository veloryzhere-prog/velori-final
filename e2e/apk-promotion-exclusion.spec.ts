import { expect, test } from "@playwright/test";

test("website visitors cannot access APK-only referral promotions or tools", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
  });
  try {
    const page = await context.newPage();
    const referralRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /velori_(?:validate_referral_code|qualify_my_referral|my_referral_dashboard)/.test(
          request.url(),
        )
      ) {
        referralRequests.push(request.url());
      }
    });

    await page.goto("/forge/rewards", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Referrals aren’t available here" }),
    ).toBeVisible();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width < 520 ? 844 : 1000 });
      await expect(
        page.getByRole("heading", { name: "Referrals aren’t available here" }),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
    }
    expect(referralRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
