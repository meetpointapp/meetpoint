import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(800);
await page.getByRole('textbox', { name: 'E-posta' }).fill('test@meetpoint.dev');
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(3000);
await page.mouse.click(351, 800);
await page.waitForTimeout(2000);
const labels = await page.locator('flt-semantics[role], flt-semantics [role]').evaluateAll((els) =>
  els.map((e) => `${e.getAttribute('role')}:${e.getAttribute('aria-label') ?? e.textContent?.trim()}`).filter((s) => s.length < 60),
);
console.log(labels.join(' | '));
await page.getByText('EN', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}22-profile-en.png` });
await page.mouse.click(273, 800);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}23-wallet-en.png` });
await browser.close();
