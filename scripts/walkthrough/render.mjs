// Step the stage one video frame at a time and write a PNG sequence.
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { attach, sleep } from './cdp.mjs';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const OUT = join(ROOT, 'frames');
const FPS = Number(process.env.FPS || 30);
const FROM = Number(process.env.FROM || 0);          // seconds, for spot checks
const TO = Number(process.env.TO || 0);              // 0 = to the end

if (!process.env.KEEP) { rmSync(OUT, { recursive: true, force: true }); }
mkdirSync(OUT, { recursive: true });

const page = await attach({ url: 'http://127.0.0.1:7788/stage.html' });
await page.viewport(1920, 1080, 1);
await page.go('http://127.0.0.1:7788/stage.html', 3000);

const total = await page.js(`await window.ready; return window.TOTAL`);
console.log('timeline', (total / 1000).toFixed(2) + 's');

const from = Math.round(FROM * 1000);
const to = TO ? Math.round(TO * 1000) : total;
const count = Math.ceil((to - from) / 1000 * FPS);
const t0 = Date.now();

for (let i = 0; i < count; i++) {
  const t = from + i * 1000 / FPS;
  await page.js(`await window.seek(${t.toFixed(2)})`);
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(OUT, `v${String(i).padStart(6, '0')}.png`), Buffer.from(r.result.data, 'base64'));
  if (i % 60 === 0) {
    const pct = ((i + 1) / count * 100).toFixed(1);
    const rate = (i + 1) / ((Date.now() - t0) / 1000);
    console.log(`${pct}%  ${i + 1}/${count}  ${rate.toFixed(1)} fps  eta ${Math.round((count - i) / rate)}s`);
  }
}

console.log('rendered', count, 'frames in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
console.log('ERRORS', page.errors.slice(0, 8));
await page.close();
