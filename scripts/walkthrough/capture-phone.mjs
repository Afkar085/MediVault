// The same walkthrough, driven through the phone layout: bottom tab bar, the
// raised add button, bottom sheets. 390x788 leaves room for a browser bar above
// the page inside a 390x844 phone screen.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { attach, login, sleep, HELPERS } from './cdp.mjs';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const OUT = join(ROOT, 'capture-phone');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const W = 390, H = 788, SCALE = 2;

const page = await attach({ url: 'about:blank' });
await page.viewport(W, H, SCALE);
await login(page);

// ---------------------------------------------------------------- recorder
const scenes = [];
let scene = null, n = 0;
const startScene = (id) => { scene = { id, frames: [], cursor: [], marks: [], t0: Date.now() }; scenes.push(scene); };
const now = () => Date.now() - scene.t0;

async function frame() {
  const t = now();
  const r = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = `p${String(n++).padStart(5, '0')}.png`;
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'));
  scene.frames.push({ file, t });
  return t;
}
async function record(ms) { const end = now() + ms; while (now() < end) await frame(); await frame(); }
async function hold(ms) { await frame(); await sleep(ms); await frame(); }

const ui = (expr) => page.js(expr);
const helpers = () => page.js(HELPERS);
const settle = async (ms = 500) => { await sleep(ms); await helpers(); };

async function find(expr, ms = 10000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    await helpers();
    const b = await page.js(`try { return box(${expr}); } catch (e) { return null; }`);
    if (b && b.w > 0) return b;
    await sleep(250);
  }
  throw new Error('not found: ' + expr);
}

// A finger tap: the overlay ring lands on the element, then it is really clicked.
async function tap(expr, { click = true, lead = 560, after = 0 } = {}) {
  const b = await find(expr);
  scene.cursor.push({ t: now(), x: b.cx, y: b.cy, lead, click, box: b });
  if (click) { await frame(); await page.js(`${expr}.click()`); if (after) await record(after); }
  return b;
}
async function mark(name, expr) {
  try { const b = await find(expr, 5000); scene.marks.push({ name, t: now(), ...b }); return b; }
  catch { console.warn('mark missing: ' + name); return null; }
}

async function scrollTo(y, ms = 900) {
  const from = await page.js(`return window.scrollY`);
  const t0 = now(), end = t0 + ms;
  while (now() < end) {
    const k = Math.min(1, (now() - t0) / ms);
    const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    await page.js(`window.scrollTo(0, ${Math.round(from + (y - from) * e)})`);
    await frame();
  }
  await page.js(`window.scrollTo(0, ${y})`);
  await frame();
}
async function scrollSheet(to, ms = 1300) {
  const t0 = now();
  while (now() - t0 < ms) {
    const k = (now() - t0) / ms;
    const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    await ui(`{const s=document.querySelector('.sheet-scroll'); if(s) s.scrollTop = ${Math.round(e * to)};}`);
    await frame();
  }
  await frame();
}

async function goHome() {
  await helpers();
  await ui(`{ const c = document.querySelector('.record .icon-btn, .sheet .icon-btn'); if (c) c.click(); }`);
  await sleep(500);
  await helpers();
  await ui(`$$('.tab-i').find(b => /Home$/.test(b.textContent))?.click() || byText(/MediVault home/)?.click()`);
  await sleep(800);
  await helpers();
  const ok = await page.js(`return await until(() => document.querySelector('.hello h1'), 8000) ? true : false`);
  if (!ok) { await page.go('http://localhost:3100/', 2600); await helpers(); }
  await ui(`window.scrollTo(0,0)`);
  await sleep(300);
  await helpers();
}

async function dropUploaded() {
  for (let i = 0; i < 4; i++) {
    await helpers();
    const left = await page.js(`return $$('.rec-row').filter(r => /Meera Rao/.test(r.getAttribute('aria-label')||'')).length`);
    if (!left) return i;
    await ui(`byText(/Meera Rao/, '.rec-row').click()`);
    await settle(1200);
    await ui(`byText(/^Delete$/, '.record button').click()`);
    await settle(600);
    await ui(`byText(/^Delete$/, '.confirm-box button').click()`);
    await settle(1400);
  }
  return 4;
}

{
  await page.go('http://localhost:3100/', 2600);
  await helpers();
  console.log('pre-clean removed', await dropUploaded(), 'record(s)');
  await ui(`$$('.toast button, .toast .icon-btn, [class*=toast] button').forEach(b => b.click())`);
  await sleep(6500);
  await helpers();
}

// ================================================================= 1. home
startScene('home');
await goHome();
await hold(1000);
await mark('stats', `document.querySelector('.stats')`);
await hold(1200);
await scrollTo(430, 1100);
await hold(1100);
await mark('recent', `document.querySelector('.rec-list')`);
await hold(1000);
await scrollTo(0, 800);
await hold(400);

// ================================================================= 2. upload
startScene('upload');
await hold(400);
await tap(`document.querySelector('.tab-add')`, { after: 1400 });
await settle(400);
await hold(900);
await tap(`byText(/Prescription$/, '.add-sheet .choice-opt')`, { after: 600 });
await hold(500);
await tap(`byText(/Choose file/, '.page-add')`, { click: false });
await frame();
await ui(`await pick(['rx_readable.png'])`);
await record(1600);
await settle(400);
await hold(1400);
await scrollSheet(300, 900);
await tap(`document.querySelector('.sheet-actions .btn-primary')`, { click: false });
await hold(700);

// ================================================================= 3. read
startScene('read');
await helpers();
await ui(`document.querySelector('.sheet-actions .btn-primary').click()`);
await record(3200);
await settle(400);
await ui(`await until(() => !document.querySelector('.attention [role=status]'), 30000)`);
await settle(700);
await record(1000);
await hold(1200);
await mark('newrow', `byText(/Meera Rao/, '.rec-row')`);
await hold(1400);

// ================================================================= 4. record
startScene('record');
await tap(`byText(/Meera Rao/, '.rec-row')`, { after: 1800 });
await settle(500);
await hold(1400);
await mark('details', `document.querySelector('.record .dl')`);
await hold(1100);
await scrollSheet(700, 1600);
await hold(1200);
await scrollSheet(1250, 1200);
await hold(1500);

// ================================================================= 5. timeline
startScene('timeline');
await goHome();
await hold(400);
await tap(`document.querySelector('.stat-journey')`, { after: 1800 });
await settle(500);
await hold(1600);
await scrollTo(500, 1300);
await hold(1500);
await scrollTo(0, 800);

// ================================================================= 6. family
startScene('family');
await goHome();
await hold(500);
await tap(`byText(/Switch family member/)`, { after: 1300 });
await settle(400);
await hold(1000);
await tap(`byText(/Ravi Kumar/, '.sheet button, [role=menu] button, button')`, { after: 2600 });
await settle(700);
await hold(1800);

// back to Asha for the search payoff
await goHome();
await helpers();
await ui(`byText(/Switch family member/)?.click()`);
await settle(1000);
await ui(`byText(/Asha Kumar/, '.sheet button, [role=menu] button, button')?.click()`);
await settle(1800);

// ================================================================= 7. search
startScene('search');
await goHome();
await helpers();
await ui(`$$('.tab-i').find(b => /Search$/.test(b.textContent))?.click()`);
await settle(1100);
await hold(800);
await tap(`document.querySelector('.search-input')`, { click: false });
await ui(`document.querySelector('.search-input').focus()`);
await frame();
for (const q of ['P', 'Pa', 'Par', 'Para', 'Parac', 'Paracet', 'Paraceta', 'Paracetam', 'Paracetamol']) {
  await ui(`typeInto(document.querySelector('.search-input'), ${JSON.stringify(q)})`);
  await frame(); await sleep(70); await frame();
}
await record(2600);
await settle(500);
await hold(2000);

// ================================================================= 8. attention
startScene('attention');
await goHome();
await sleep(900);
await helpers();
await hold(700);
await mark('attention', `document.querySelector('.attention')`);
await hold(2200);

// ---------------------------------------------------------------- cleanup
try { await goHome(); console.log('cleanup removed', await dropUploaded(), 'record(s)'); }
catch (e) { console.warn('cleanup skipped: ' + e.message); }

for (const s of scenes) {
  s.duration = s.frames.length ? s.frames[s.frames.length - 1].t : 0;
  delete s.t0;
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ width: W, height: H, scale: SCALE, scenes }, null, 1));
console.log(scenes.map(s => `${s.id.padEnd(10)} ${String(s.frames.length).padStart(4)} frames  ${String(s.duration).padStart(6)}ms  ${s.cursor.length} taps  ${s.marks.length} marks`).join('\n'));
console.log('TOTAL FRAMES', n);
console.log('PAGE ERRORS', page.errors.slice(0, 6));
await page.close();
