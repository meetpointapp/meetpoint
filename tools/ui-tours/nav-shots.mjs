// Alt menü görünümü: farklı sekmelerde ve dar ekranda (360 px) ekran görüntüsü.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB } from './lib.mjs';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const email = process.env.TOUR_EMAIL ?? 'mert6@meetpoint.dev';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [w, h] of [[390, 844], [360, 740]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
  await page.goto(WEB);
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
  await page.getByRole('textbox', { name: 'Şifre' }).click();
  await page.keyboard.type('password123', { delay: 30 });
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Atla' }).click({ timeout: 3000 }).catch(() => {});
  for (const [name, route] of [['discover', '/discover'], ['chats', '/chats'], ['feed', '/feed'], ['me', '/me']]) {
    await page.goto(`${WEB}/#${route}`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}nav-${w}-${name}.png`, clip: { x: 0, y: h - 110, width: w, height: 110 } });
  }
  await page.goto(`${WEB}/#/chats`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}nav-chats-full.png` });
}
await browser.close();
