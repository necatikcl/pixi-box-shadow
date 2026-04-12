import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for the page to render fully
  await page.waitForTimeout(3000);

  // Take a full page screenshot first
  await page.screenshot({ path: 'screenshots/full-page.png', fullPage: true });
  console.log('Full page screenshot saved');

  // Get the page height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Page height: ${pageHeight}px`);

  // Get the column header text
  const headerText = await page.evaluate(() => {
    const headers = document.querySelectorAll('h2, h3, th, .header, [class*="header"]');
    return Array.from(headers).map(h => h.textContent.trim());
  });
  console.log('Headers found:', JSON.stringify(headerText));

  // Get all text on the page that contains "CSS"
  const cssTexts = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const texts = [];
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent.includes('CSS')) {
        texts.push(el.textContent.trim());
      }
    }
    return [...new Set(texts)];
  });
  console.log('CSS-related text:', JSON.stringify(cssTexts));

  // Get all labels/test case names
  const allLabels = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const labels = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (el.children.length === 0 && (text.includes('TEXTURE') || text.includes('texture'))) {
        labels.push(text);
      }
    }
    return [...new Set(labels)];
  });
  console.log('TEXTURE-related labels:', JSON.stringify(allLabels.slice(0, 30)));

  // Get all test case labels
  const testLabels = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const labels = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (el.children.length <= 2 && (text.includes('TEXTURE:') || text.includes('drop-shadow'))) {
        labels.push({ text, tag: el.tagName });
      }
    }
    return labels.slice(0, 50);
  });
  console.log('Test labels with TEXTURE/drop-shadow:', JSON.stringify(testLabels.slice(0, 30)));

  // Scroll to find TEXTURE test cases and take screenshots
  // First, find the position of the first TEXTURE element
  const texturePos = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.includes('TEXTURE:')) {
        const rect = walker.currentNode.parentElement.getBoundingClientRect();
        return { top: rect.top + window.scrollY, found: true };
      }
    }
    return { found: false };
  });
  console.log('TEXTURE position:', JSON.stringify(texturePos));

  if (texturePos.found) {
    // Scroll to just above the first TEXTURE test case
    await page.evaluate((y) => window.scrollTo(0, y - 100), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-start.png' });
    console.log('Screenshot of TEXTURE start saved');

    // Scroll down more to see more texture tests
    await page.evaluate((y) => window.scrollTo(0, y + 700), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-mid1.png' });
    console.log('Screenshot of TEXTURE mid1 saved');

    await page.evaluate((y) => window.scrollTo(0, y + 1500), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-mid2.png' });
    console.log('Screenshot of TEXTURE mid2 saved');

    await page.evaluate((y) => window.scrollTo(0, y + 2300), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-mid3.png' });
    console.log('Screenshot of TEXTURE mid3 saved');

    await page.evaluate((y) => window.scrollTo(0, y + 3100), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-mid4.png' });
    console.log('Screenshot of TEXTURE mid4 saved');

    await page.evaluate((y) => window.scrollTo(0, y + 3900), texturePos.top);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/texture-end.png' });
    console.log('Screenshot of TEXTURE end saved');
  }

  // Also take screenshot of the very top of the page (column headers)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/page-top.png' });
  console.log('Screenshot of page top saved');

  // Report console messages and errors
  console.log('\n=== Console Messages ===');
  for (const msg of consoleMessages) {
    console.log(`[${msg.type}] ${msg.text}`);
  }
  console.log('\n=== Page Errors ===');
  for (const err of errors) {
    console.log(`ERROR: ${err}`);
  }
  if (errors.length === 0) {
    console.log('No page errors found');
  }

  await browser.close();
})();
