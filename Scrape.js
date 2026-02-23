const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto("https://usstrikeradar.com/", { waitUntil: "networkidle" });

  // Give the dashboard time to render its JS-loaded numbers
  await page.waitForTimeout(8000);

  const result = await page.evaluate(() => {
    const text = (el) => (el?.innerText || "").trim();

    const heading = [...document.querySelectorAll("*")]
      .find(e => text(e) === "US Strike on Iran Probability");

    let root = heading?.parentElement || document.body;

    const candidates = [...root.querySelectorAll("*")]
      .map(e => text(e))
      .filter(t => /^\d{1,3}%$/.test(t));

    const fallback = [...document.querySelectorAll("*")]
      .map(e => text(e))
      .filter(t => /^\d{1,3}%$/.test(t));

    const prob = (candidates[0] || fallback[0] || null);

    const updatedLine = [...document.querySelectorAll("*")]
      .map(e => text(e))
      .find(t => t.startsWith("Updated"));

    return { prob, updatedLine };
  });

  await browser.close();

  const out = {
    source: "https://usstrikeradar.com/",
    scraped_at_utc: new Date().toISOString(),
    strike_on_iran_probability: result.prob,      // e.g. "42%"
    site_updated_line: result.updatedLine || null // e.g. "Updated 13:30"
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
