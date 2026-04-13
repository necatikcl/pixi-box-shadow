import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const PERF_TAB_SELECTOR = '.tab-btn[data-tab="perf"]';
const BACKEND_SUBTAB_SELECTOR = '.sub-tab-btn[data-subtab="backend"]';
const URL = process.env.BENCH_URL ?? 'http://localhost:5173/';
const INITIAL_WARMUP_MS = 7000;
const OUTPUT_PREFIX = process.env.BENCH_OUTPUT_PREFIX ?? 'texture-backend-benchmark-run-1';

async function runBenchmark() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    await page.goto(URL, { waitUntil: 'networkidle' });

    await page.click(PERF_TAB_SELECTOR);
    await page.click(BACKEND_SUBTAB_SELECTOR);

    await page.waitForTimeout(INITIAL_WARMUP_MS);

    const result = await page.evaluate(async () => {
      const run = window.__runTextureBackendBenchmark;
      if (!run) return null;
      return run({
        rounds: 3,
        warmupFrames: 24,
        measuredFrames: 120,
        workMultiplier: 1,
      });
    });

    if (!result) {
      throw new Error('Unable to collect benchmark result from page helper.');
    }

    const output = {
      url: URL,
      ...result,
    };
    writeFileSync(`/opt/cursor/artifacts/${OUTPUT_PREFIX}.json`, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    // Keep one JSON line for easier parsing in CI/logs.
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
  }
}

runBenchmark().catch((error) => {
  console.error(error);
  process.exit(1);
});
