import { chromium } from 'playwright-core';

const PORT = 5299;
const URL = `http://127.0.0.1:${PORT}/`;

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="city-canvas"]', { timeout: 30_000 });
await page.waitForFunction('document.querySelector("#app").getAttribute("data-app-ready") === "true"', null, { timeout: 30_000 });
await page.waitForFunction('document.querySelector("#app").getAttribute("data-era-transitioning") === "false"', null, { timeout: 30_000 });

const probe = async (label, fn) => {
  const before = await page.evaluate(() => ({
    era: document.querySelector('#app')?.getAttribute('data-era'),
    tr: document.querySelector('#app')?.getAttribute('data-era-transitioning'),
    val: document.querySelector('[data-testid="era-timeline-thumb"]')?.value,
    active: document.activeElement?.getAttribute('data-testid'),
  }));
  await fn();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    era: document.querySelector('#app')?.getAttribute('data-era'),
    tr: document.querySelector('#app')?.getAttribute('data-era-transitioning'),
    val: document.querySelector('[data-testid="era-timeline-thumb"]')?.value,
    active: document.activeElement?.getAttribute('data-testid'),
  }));
  console.log(label, JSON.stringify(before), '->', JSON.stringify(after));
};

await probe('focus-thumb', async () => {
  await page.focus('[data-testid="era-timeline-thumb"]');
});
await probe('press-End', async () => {
  await page.keyboard.press('End');
});
await page.waitForTimeout(3000);
console.log('after End+3s:', await page.evaluate(() => ({
  era: document.querySelector('#app')?.getAttribute('data-era'),
  tr: document.querySelector('#app')?.getAttribute('data-era-transitioning'),
})));
await probe('press-Home', async () => {
  await page.keyboard.press('Home');
});
await page.waitForTimeout(3000);
console.log('after Home+3s:', await page.evaluate(() => ({
  era: document.querySelector('#app')?.getAttribute('data-era'),
  tr: document.querySelector('#app')?.getAttribute('data-era-transitioning'),
})));

// Try clicking the 2025 chip for comparison
await probe('click-2025-chip', async () => {
  await page.click('[data-testid="era-stop-2025"]');
});
await page.waitForTimeout(3000);
console.log('after chip-2025+3s:', await page.evaluate(() => ({
  era: document.querySelector('#app')?.getAttribute('data-era'),
  tr: document.querySelector('#app')?.getAttribute('data-era-transitioning'),
})));

console.log('pageerrors:', errors);
await browser.close();