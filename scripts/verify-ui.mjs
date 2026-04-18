import { chromium, devices } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const outputDir = process.env.OUTPUT_DIR ?? "/tmp/fride-ui-check";

async function ensureDir(path) {
  const fs = await import("node:fs/promises");
  await fs.mkdir(path, { recursive: true });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
}

async function openPage(page, url, eventText) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('h1, [dir="rtl"]', { timeout: 60000 });
  if (eventText) {
    await page.waitForSelector(`text=${eventText}`, { timeout: 60000 });
  }
  await page.waitForTimeout(1200);
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function runDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await openPage(page, baseUrl, "ארוחת בוקר רגועה עם המשפחה");
  await screenshot(page, "desktop-public-weeks");

  await clickIfVisible(page, 'button:has-text("שבוע אג׳נדה")');
  await page.waitForTimeout(700);
  await screenshot(page, "desktop-public-agenda");

  await clickIfVisible(page, 'button:has-text("ארוחת בוקר רגועה עם המשפחה")');
  await screenshot(page, "desktop-public-event-details");

  await clickIfVisible(page, 'button:has-text("בקשת שינוי")');
  await screenshot(page, "desktop-public-change-request");
  await page.keyboard.press("Escape").catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});

  await openPage(page, `${baseUrl}/admin`, "ארוחת בוקר רגועה עם המשפחה");
  await screenshot(page, "desktop-admin");

  await clickIfVisible(page, 'button:has-text("ארוחת בוקר רגועה עם המשפחה")');
  await screenshot(page, "desktop-admin-event-details");

  await page.close();
}

async function runMobile(browser) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });
  const page = await context.newPage();

  await openPage(page, baseUrl, "ארוחת בוקר רגועה עם המשפחה");
  await screenshot(page, "mobile-public-weeks");

  await clickIfVisible(page, 'button:has-text("שבוע אג׳נדה")');
  await page.waitForTimeout(700);
  await screenshot(page, "mobile-public-agenda");

  await clickIfVisible(page, 'button:has-text("ארוחת בוקר רגועה עם המשפחה")');
  await screenshot(page, "mobile-public-event-details");

  await clickIfVisible(page, 'button:has-text("בקשת הסרה")');
  await screenshot(page, "mobile-public-remove-request");
  await page.keyboard.press("Escape").catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});

  await openPage(page, `${baseUrl}/admin`, "ארוחת בוקר רגועה עם המשפחה");
  await screenshot(page, "mobile-admin");

  await context.close();
}

async function main() {
  await ensureDir(outputDir);
  const browser = await chromium.launch({ headless: true });

  try {
    await runDesktop(browser);
    await runMobile(browser);
    console.log(`Saved screenshots to ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
