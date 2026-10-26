// Drive the real MediVault app and record, per scene, a timestamped PNG sequence
// plus the on-screen box of anything clicked. Everything the video shows of the
// product comes from here: real DOM, real API, real rendering.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { attach, login, sleep, HELPERS } from './cdp.mjs';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const OUT = join(ROOT, 'capture');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const W = 1360, H = 850, SCALE = 2;

const page = await attach({ url: 'about:blank' });
await page.viewport(W, H, SCALE);
await login(page);

// ---------------------------------------------------------------- recorder
const scenes = [];
let scene = null;
let n = 0;

const startScene = (id) => { scene = { id, frames: [], cursor: [], marks: [], t0: Date.now() }; scenes.push(scene); };
const now = () => Date.now() - scene.t0;

async function frame() {
  const t = now();
  const r = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = `f${String(n++).padStart(5, '0')}.png`;
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'));
  scene.frames.push({ file, t });
  return t;
}
async function record(ms) { const end = now() + ms; while (now() < end) await frame(); await frame(); }
async function hold(ms) { await frame(); await sleep(ms); await frame(); }

const ui = (expr) => page.js(expr);
const helpers = () => page.js(HELPERS);

// Wait for an element expression to resolve, re-injecting helpers first.
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

// Point the overlay cursor at an element, then (optionally) click it for real.
async function tap(expr, { click = true, lead = 640, after = 0 } = {}) {
  const b = await find(expr);
  scene.cursor.push({ t: now(), x: b.cx, y: b.cy, lead, click, box: b });
  if (click) {
    await frame();
    await page.js(`${expr}.click()`);
    if (after) await record(after);
  }
  return b;
}

async function mark(name, expr) {
  try {
    const b = await find(expr, 4000);
    scene.marks.push({ name, t: now(), ...b });
    return b;
  } catch { console.warn('mark missing: ' + name); return null; }
}

const settle = async (ms = 500) => { await sleep(ms); await helpers(); };

async function scrollTo(y, ms = 900) {
  const from = await page.js(`return window.scrollY`);
  const t0 = now(), end = t0 + ms;
  while (now() < end) {
    const k = Math.min(1, (now() - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
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
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
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
  await ui(`byText(/MediVault home/)?.click()`);
  await sleep(800);
  await helpers();
  const ok = await page.js(`return await until(() => document.querySelector('.hello h1'), 8000) ? true : false`);
  if (!ok) { await page.go('http://localhost:3100/', 2600); await helpers(); }
  await ui(`window.scrollTo(0,0)`);
  await sleep(300);
  await helpers();
}

// Start from the seed: drop anything a previous run uploaded.
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
  // let every toast from the clean-up expire before the first frame
  await ui(`$$('.toast button, .toast .icon-btn, [class*=toast] button').forEach(b => b.click())`);
  await sleep(6500);
  await helpers();
}

// ================================================================= 1. home
startScene('home');
await goHome();
await hold(900);
await mark('stats', `document.querySelector('.stats')`);
await hold(1200);
await scrollTo(340, 1000);
await hold(900);
await mark('recent', `document.querySelector('.rec-list')`);
await hold(1000);
await scrollTo(0, 700);
await hold(400);

// ================================================================= 2. upload
startScene('upload');
await hold(400);
await tap(`byText(/Add a document to the records/)`, { after: 1300 });
await settle(400);
await hold(800);
await tap(`byText(/Prescription$/, '.add-sheet .choice-opt')`, { after: 500 });
await hold(500);
await tap(`byText(/Choose file/, '.page-add')`, { click: false });
await frame();
await ui(`await pick(['rx_readable.png'])`);
await record(1500);
await settle(400);
await hold(1400);
await tap(`document.querySelector('.sheet-actions .btn-primary')`, { click: false });
await hold(600);

// ================================================================= 3. read
startScene('read');
await helpers();
await ui(`document.querySelector('.sheet-actions .btn-primary').click()`);
await record(3000);
await settle(400);
await ui(`await until(() => !document.querySelector('.attention [role=status]'), 30000)`);
await settle(700);
await record(1000);
await hold(1200);
await mark('newrow', `byText(/Meera Rao/, '.rec-row')`);
await hold(1400);

// ================================================================= 4. record
startScene('record');
await tap(`byText(/Meera Rao/, '.rec-row')`, { after: 1700 });
await settle(500);
await hold(1400);
await mark('details', `document.querySelector('.record .dl')`);
await hold(1100);
await scrollSheet(560, 1500);
await hold(1800);

// ================================================================= 5. timeline
startScene('timeline');
await goHome();
await hold(400);
await tap(`document.querySelector('.stat-journey')`, { after: 1700 });
await settle(500);
await hold(1600);
await scrollTo(400, 1200);
await hold(1500);
await scrollTo(0, 800);

// ================================================================= 6. family
startScene('family');
await goHome();
await hold(500);
await tap(`byText(/Switch family member/)`, { after: 1200 });
await settle(400);
await hold(900);
try {
  await tap(`byText(/Ravi/, '.sheet button, [role=menu] button, .menu button, button')`, { after: 2400 });
  await settle(700);
  await hold(1800);
} catch { console.warn('no second member in the switcher'); }

// Back to Asha, whose records the rest of the story is about.
await goHome();
await helpers();
await ui(`byText(/Switch family member/)?.click()`);
await settle(900);
await ui(`byText(/Asha/, '.sheet button, [role=menu] button, .menu button, button')?.click()`);
await settle(1600);

// ================================================================= 7. search
startScene('search');
await goHome();
await helpers();
await ui(`byText(/Search the records/)?.click()`);
await settle(1000);
await hold(700);
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

// ---------------------------------------------------------------- manifest
for (const s of scenes) {
  s.duration = s.frames.length ? s.frames[s.frames.length - 1].t : 0;
  delete s.t0;
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ width: W, height: H, scale: SCALE, scenes }, null, 1));
console.log(scenes.map(s => `${s.id.padEnd(10)} ${String(s.frames.length).padStart(4)} frames  ${String(s.duration).padStart(6)}ms  ${s.cursor.length} taps  ${s.marks.length} marks`).join('\n'));
console.log('TOTAL FRAMES', n);
console.log('PAGE ERRORS', page.errors.slice(0, 6));
await page.close();
