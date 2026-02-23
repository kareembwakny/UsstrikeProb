const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Be generous with timeouts
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  // Set a normal browser user-agent (sometimes helps with bot checks)
  await page.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  });

  // IMPORTANT: don't use networkidle (some sites keep connections open forever)
  await page.goto("https://usstrikeradar.com/", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  // Wait for the dashboard heading to appear (JS-rendered)
  await page.waitForSelector('text=US Strike on Iran Probability', { timeout: 120000 });

  // Give the site a bit more time to paint the numbers
  await page.waitForTimeout(8000);

  const result = await page.evaluate(() => {
    const txt = (el) => (el?.innerText || "").trim();

    const heading = [...document.querySelectorAll("*")]
      .find(e => txt(e) === "US Strike on Iran Probability");

    // Search in a nearby container first
    let root = heading?.parentElement || document.body;

    const findPercent = (scope) =>
      [...scope.querySelectorAll("*")]
        .map(e => txt(e))
        .find(t => /^\d{1,3}%$/.test(t)) || null;

    const probNear = findPercent(root);
    const probAny = findPercent(document);

    const updatedLine =
      [...document.querySelectorAll("*")]
        .map(e => txt(e))
        .find(t => t.startsWith("Updated")) || null;

    return {
      prob: probNear || probAny,
      updatedLine
    };
  });

  await browser.close();

  const out = {
    source: "https://usstrikeradar.com/",
    scraped_at_utc: new Date().toISOString(),
    strike_on_iran_probability: result.prob,      // e.g. "42%"
    site_updated_line: result.updatedLine
  };

  if (!out.strike_on_iran_probability) {
    // Force a failure so you notice if parsing broke
    throw new Error("Could not find probability percentage on page.");
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("SCRAPE FAILED:", e?.message || e);
  process.exit(1);
});
