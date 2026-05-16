import { expect, test } from 'playwright/test';
import type { Page } from 'playwright/test';
import type { CacheScenarioResult } from './fixtures/cache-as-texture';

interface ScenarioOptions {
  shape: 'rect' | 'rotatedRect' | 'circle';
  shapeMode?: 'box' | 'texture';
  cache: boolean;
  cacheTarget?: 'self' | 'parent';
}

declare global {
  interface Window {
    runCacheAsTextureScenario: (options: ScenarioOptions) => Promise<CacheScenarioResult>;
  }
}

async function runScenario(page: Page, options: ScenarioOptions): Promise<CacheScenarioResult> {
  return page.evaluate((scenario) => window.runCacheAsTextureScenario(scenario), options);
}

function expectCachedShadowToMatchUncached(cached: CacheScenarioResult, uncached: CacheScenarioResult): void {
  expect(cached.centerAlpha).toBeGreaterThan(230);
  expect(cached.shadowProbeAlpha).toBeGreaterThan(12);
  expect(cached.shadowProbeAlpha).toBeGreaterThanOrEqual(uncached.shadowProbeAlpha * 0.35);
  expect(cached.alphaBounds.width).toBeGreaterThanOrEqual(uncached.alphaBounds.width * 0.75);
  expect(cached.alphaBounds.height).toBeGreaterThanOrEqual(uncached.alphaBounds.height * 0.75);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/cache-as-texture.html');
  await page.waitForFunction(() => typeof window.runCacheAsTextureScenario === 'function');
});

test('preserves box-mode shadows when the filtered object is cached as a texture', async ({ page }) => {
  const uncached = await runScenario(page, { shape: 'rect', cache: false });
  const cached = await runScenario(page, { shape: 'rect', cache: true });

  expect(cached.cacheTextureBounds).not.toBeNull();
  expect(cached.cacheTextureBounds!.width).toBeGreaterThanOrEqual(80 + cached.filterPadding * 2);
  expect(cached.cacheTextureBounds!.height).toBeGreaterThanOrEqual(50 + cached.filterPadding * 2);
  expectCachedShadowToMatchUncached(cached, uncached);
});

test('preserves rotated box-mode shadows when the filtered object is cached', async ({ page }) => {
  const uncached = await runScenario(page, { shape: 'rotatedRect', cache: false });
  const cached = await runScenario(page, { shape: 'rotatedRect', cache: true });

  expect(cached.cacheTextureBounds).not.toBeNull();
  expect(cached.cacheTextureBounds!.width).toBeGreaterThan(80);
  expect(cached.cacheTextureBounds!.height).toBeGreaterThan(50);
  expectCachedShadowToMatchUncached(cached, uncached);
});

test('preserves texture-mode shadows when the filtered object is cached', async ({ page }) => {
  const uncached = await runScenario(page, { shape: 'circle', shapeMode: 'texture', cache: false });
  const cached = await runScenario(page, { shape: 'circle', shapeMode: 'texture', cache: true });

  expect(cached.cacheTextureBounds).not.toBeNull();
  expect(cached.cacheTextureBounds!.width).toBeGreaterThanOrEqual(64 + cached.filterPadding * 2);
  expect(cached.cacheTextureBounds!.height).toBeGreaterThanOrEqual(64 + cached.filterPadding * 2);
  expectCachedShadowToMatchUncached(cached, uncached);
});

test('preserves child shadows when the parent container is cached as a texture', async ({ page }) => {
  const uncached = await runScenario(page, { shape: 'rect', cache: false, cacheTarget: 'parent' });
  const cached = await runScenario(page, { shape: 'rect', cache: true, cacheTarget: 'parent' });

  expect(cached.cacheTextureBounds).not.toBeNull();
  expect(cached.cacheTextureBounds!.width).toBeGreaterThanOrEqual(80 + cached.filterPadding * 2);
  expect(cached.cacheTextureBounds!.height).toBeGreaterThanOrEqual(50 + cached.filterPadding * 2);
  expectCachedShadowToMatchUncached(cached, uncached);
});
