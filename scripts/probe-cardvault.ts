#!/usr/bin/env npx tsx
import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls: string[] = [];
  page.on('response', (r) => {
    const ct = r.headers()['content-type'] ?? '';
    if (ct.includes('json')) apiCalls.push(`${r.status()}  ${r.url().slice(0, 110)}`);
  });

  await page.goto('https://cardvault.fabtcg.com/results/?q=1HP218', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const altsBefore = await page.$$eval('img', els => els.map(e => (e as HTMLImageElement).alt).filter(a => !!a));
  console.log('Search page alts:', altsBefore);
  console.log('Search page URL:', page.url());

  // Click first non-UI tile
  const UI = new Set(['Flesh and Blood','menu','Small Grid','Medium Grid','Large Grid','List View','Flip','search','Advanced Search','Syntax Guide','Products','Random Card','language switcher','lang icon down']);
  const candidate = altsBefore.find(a => !UI.has(a));
  console.log('Clicking:', JSON.stringify(candidate));
  if (candidate) {
    await page.locator(`img[alt="${candidate.replace(/"/g, '\\"')}"]`).first().click();
    await page.waitForTimeout(5000);
    console.log('After-click URL:', page.url());
  }

  console.log();
  console.log('All JSON API calls:');
  apiCalls.forEach(c => console.log(' ', c));

  await browser.close();
})();
