// MeetPoint uygulama ikonu: mercan->turuncu gradyan üzerinde beyaz konum iğnesi, içinde kalp.
// Üç PNG üretir: tam ikon (iOS/genel), Android adaptive arka plan ve ön plan.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const outDir = `${REPO}/app/assets/icon`;
fs.mkdirSync(outDir, { recursive: true });

const pin = (scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -540)">
    <path d="M512 150c-176 0-300 128-300 292 0 214 246 408 284 436a28 28 0 0 0 32 0c38-28 284-222 284-436 0-164-124-292-300-292z"
          fill="#fff"/>
    <path d="M512 610c-8 0-15-3-21-8-58-48-129-104-129-178 0-50 38-88 86-88 28 0 49 12 64 32 15-20 36-32 64-32 48 0 86 38 86 88 0 74-71 130-129 178-6 5-13 8-21 8z"
          fill="url(#g)"/>
  </g>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FF4D6D"/><stop offset="1" stop-color="#FF8A5B"/></linearGradient></defs>`;
const svg = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}${body}</svg>`;

const variants = {
  'icon.png': svg(true, pin(1.0)),
  'icon_bg.png': svg(true, ''),
  // Adaptive ön plan: güvenli alan için daha küçük (%66 daire içinde kalmalı)
  'icon_fg.png': svg(false, pin(0.62)),
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const [name, markup] of Object.entries(variants)) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.screenshot({ path: `${outDir}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  console.log('wrote', name);
}
await browser.close();
