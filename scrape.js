const fs = require("fs");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  try {
    await page.goto("https://usstrikeradar.com/", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    // wait for the dashboard heading to exist somewhere
    await page.waitForSelector('text=US Strike on Iran Probability', { timeout: 60000 });

    // give JS time to render numbers
    await page.waitForTimeout(8000);

    const result = await page.evaluate(() => {
      const txt = (el) => (el?.innerText || "").trim();

      const heading = [...document.querySelectorAll("*")]
        .find(e => txt(e) === "US Strike on Iran Probability");

      const scope = heading?.parentElement || document.body;

      const findPercent = (root) =>
        [...root.querySelectorAll("*")]
          .map(e => txt(e))
          .find(t => /^\d{1,3}%$/.test(t)) || null;

      const probNear = findPercent(scope);
      const probAny  = findPercent(document);

      const updatedLine =
        [...document.querySelectorAll("*")]
          .map(e => txt(e))
          .find(t => t.startsWith("Updated")) || null;

      return { prob: probNear || probAny, updatedLine };
    });

    const out = {
      source: "https://usstrikeradar.com/",
      scraped_at_utc: new Date().toISOString(),
      strike_on_iran_probability: result.prob,
      site_updated_line: result.updatedLine
    };

    if (!out.strike_on_iran_probability) {
      // Save debug artifacts even if parse fails
      throw new Error("Could not find probability percentage on page.");
    }

    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    // Debug: save screenshot + HTML so we can see what the runner actually got
    try {
      await page.screenshot({ path: "debug.png", fullPage: true });
      const html = await page.content();
      fs.writeFileSync("debug.html", html, "utf8");
    } catch (_) {}

    console.error("SCRAPE FAILED:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
