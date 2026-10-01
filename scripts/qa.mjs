import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { X_URL } from "../src/config.mjs";
const production = process.argv.includes("--production"),
  base = production
    ? "https://beacon-watch.vercel.app"
    : "http://127.0.0.1:5250",
  root = new URL("../", import.meta.url),
  out = new URL("artifacts/qa/", root);
await mkdir(out, { recursive: true });
const status = await fetch(base + "/api/status").then((r) => r.json());
assert.ok(status.stations.length);
assert.equal(status.identity.x, X_URL);
assert.ok(
  status.runs.some((r) => r.snapshot),
  "Provision real observations before QA.",
);
for (const route of ["/api/operator", "/api/tick", "/api/watch"]) {
  const r = await fetch(base + route);
  assert.equal(r.status, 401);
  await r.body?.cancel();
}
assert.ok(!JSON.stringify(status).includes("Bearer "));
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
    fullPage: true,
  });
async function layout(name) {
  const social = page.getByRole("link", { name: "Follow on X", exact: true });
  assert.equal(await social.getAttribute("href"), X_URL);
  assert.equal(await social.getAttribute("target"), "_blank");
  assert.match(await social.getAttribute("rel"), /noopener/);
  const socialBox = await social.boundingBox();
  assert.ok(socialBox?.width >= 15 && socialBox?.height >= 17, `${name}: X link visible`);
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll("button,input,h1,h2,.details dd")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          (r.left < -1 || r.right > innerWidth + 1)
        );
      })
      .map((el) => el.textContent.slice(0, 70)),
  }));
  assert.ok(
    result.scroll <= result.width + 1,
    `${name}: ${JSON.stringify(result)}`,
  );
  assert.deepEqual(result.overflow, [], name);
  checks.push(name);
}
const nav = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
const close = () =>
  page.getByRole("button", { name: "Close", exact: true }).click();
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector(".intro"));
  await page.locator(".reading-row").first().waitFor();
  await layout("desktop");
  await shot("desktop");
  const colorPixels = await page.locator(".landscape-canvas").evaluate((c) => {
    const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < p.length; i += 4)
      if (
        Math.max(p[i], p[i + 1], p[i + 2]) -
          Math.min(p[i], p[i + 1], p[i + 2]) >
        40
      )
        n++;
    return n;
  });
  assert.ok(colorPixels > 600);
  await page
    .getByRole("button", { name: "Replay opening", exact: true })
    .click();
  await page.waitForTimeout(500);
  const frame1 = await page
    .locator(".intro>canvas")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(650);
  const frame2 = await page
    .locator(".intro>canvas")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(frame1, frame2);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("video").count(), 0);
  await page
    .getByRole("button", { name: "Inspect Solana", exact: true })
    .click();
  await page
    .locator(".station-name h2")
    .filter({ hasText: "Solana" })
    .waitFor();
  await page.getByRole("button", { name: "Observation", exact: true }).click();
  await page.getByRole("dialog", { name: "Solana observation" }).waitFor();
  await layout("observation");
  await shot("observation");
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const dl = await d,
    payload = JSON.parse(await readFile(await dl.path(), "utf8"));
  assert.ok(
    status.runs.some((r) => r.snapshot?.inputHash === payload.inputHash),
  );
  assert.equal(payload.stationId, "solana");
  await close();
  await page
    .getByRole("button", { name: "Replay recorded workflow", exact: true })
    .click();
  await page.getByText("Historical workflow replay", { exact: true }).waitFor();
  const run1 = await page
    .locator(".landscape-canvas")
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(450);
  const run2 = await page
    .locator(".landscape-canvas")
    .evaluate((c) => c.toDataURL());
  assert.notEqual(run1, run2);
  await nav("Journal");
  await page
    .getByRole("button", { name: "Collection failed", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Collection failed", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "All checks", exact: true }).click();
  await page
    .getByLabel("Search station", { exact: true })
    .fill("missing-station");
  assert.equal(await page.locator(".journal-list>button").count(), 0);
  await page.getByLabel("Search station", { exact: true }).fill("");
  await page.locator(".journal-list>button").first().click();
  await page.getByRole("dialog", { name: "Recorded workflow" }).waitFor();
  assert.equal(await page.locator(".steps li").count(), 3);
  await close();
  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export observation history", exact: true })
    .click();
  assert.equal(
    (await exported).suggestedFilename(),
    "beacon-observations.json",
  );
  await nav("Stations");
  await page
    .getByRole("button", { name: "Connect station", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Operator access" }).waitFor();
  await page
    .getByLabel("Operator key", { exact: true })
    .fill("wrong-key-longer-than-thirty-two-characters");
  await page
    .getByRole("button", { name: "Unlock controls", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Operator access required" })
    .waitFor();
  await close();
  if (!production) {
    const keys = JSON.parse(
      await readFile(new URL(".local/dev-access.json", root), "utf8"),
    );
    const r = await fetch(base + "/api/operator", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.operator}`,
        Origin: "https://untrusted.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pause", paused: true }),
    });
    assert.equal(r.status, 403);
    await r.body?.cancel();
    await page
      .getByRole("button", { name: "Operator access", exact: true })
      .click();
    await page.getByLabel("Operator key", { exact: true }).fill(keys.operator);
    await page
      .getByRole("button", { name: "Unlock controls", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Operator session", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Connect station", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Connect a station" }).waitFor();
    assert.equal(await page.locator(".catalog button").count(), 4);
    await close();
    await page
      .getByRole("button", { name: "Remove GitHub", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Disconnect station" }).waitFor();
    await close();
    await page
      .getByRole("button", { name: "Operator session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lock controls", exact: true })
      .click();
    await page.waitForTimeout(4500);
  }
  await page.locator("footer").getByRole("button").click();
  await page.getByRole("dialog", { name: "Token monitor" }).waitFor();
  if (!status.identity.wallet)
    await page
      .getByText("Awaiting a development wallet", { exact: true })
      .waitFor();
  await close();
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1080 });
    for (const view of ["Overview", "Stations", "Journal", "Field guide"]) {
      await nav(view);
      await page.waitForTimeout(100);
      await layout(`${view}-${width}`);
      if (view === "Overview") await shot("overview-" + width);
    }
    await nav("Overview");
    await page
      .getByRole("button", { name: "Observation", exact: true })
      .click();
    await layout("dialog-" + width);
    if (width === 390) await shot("observation-mobile");
    await close();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Replay opening", exact: true })
    .click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".intro").count(), 0);
  const img = await sharp(
    fileURLToPath(new URL("overview-390.png", out)),
  ).stats();
  assert.ok(img.channels.some((c) => c.stdev > 15));
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(
      {
        base,
        at: new Date().toISOString(),
        layouts: checks,
        colorPixels,
        sourceHash: payload.inputHash,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ok: true,
      base,
      layouts: checks.length,
      colorPixels,
      sourceHash: payload.inputHash,
    }),
  );
} finally {
  await browser.close();
}
