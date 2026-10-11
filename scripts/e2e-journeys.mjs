// End-to-end journeys for MediVault, against the LOCAL dev stack only.
//
// Drives the real frontend in a real (headless) Chrome by clicking through it,
// against backend/scripts/dev_server.py (in-memory database, fake OCR/LLM).
// It never touches Supabase or Groq. Prints PASS/FAIL per journey and saves
// screenshots.
//
//   1. cd backend && python scripts/dev_server.py         (fresh seed each run)
//   2. cd frontend && npm start                           (port 3100)
//   3. chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
//   4. node scripts/e2e-journeys.mjs <out-dir> [width] [height]
//
// Restart the dev server between runs: the journeys change its data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'journeys';
const W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 844);
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9333;
const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const consoleErrors = []; const failedRequests = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.text);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') consoleErrors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 500) failedRequests.push(m.params.response.status + ' ' + m.params.response.url);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'js error');
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

// Helpers that run inside the page.
const HELPERS = `
window.$$ = (s) => [...document.querySelectorAll(s)];
window.sleep = (ms) => new Promise(r => setTimeout(r, ms));
window.until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); } return null; };
window.btn = (re, root = document) => [...root.querySelectorAll('button')].find(b => re.test(b.getAttribute('aria-label') || '') || re.test(b.textContent.trim()));
window.typeInto = (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
window.pick = async (names) => { const input = document.querySelector('[data-testid=add-files]'); const dt = new DataTransfer(); for (const n of names) { const b = await (await fetch('http://localhost:8787/__dev/sample/' + n)).blob(); dt.items.add(new File([b], n, { type: 'image/png', lastModified: 1 })); } input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
window.idx = (word) => $$('.stat').find(b => new RegExp(word + '$', 'i').test(b.getAttribute('aria-label') || ''));
window.rows = () => $$('.rec-row').map(r => r.getAttribute('aria-label'));
window.home = async () => { $$('.tab-i').find(b => /Home$/.test(b.textContent)).click(); await sleep(400); };
window.pendingRow = () => document.querySelector('.attention [role=status]');
window.failedDocs = () => $$('.att-doc');
window.stats = async () => (await fetch('http://localhost:8787/__dev/stats')).json();
`;

await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 });
await send('Page.navigate', { url: 'http://localhost:3100/' });
await sleep(2500);
const token = await js(`return fetch('http://localhost:8787/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dev@example.com',password:'local-dev-only-password'})}).then(r=>r.json()).then(j=>j.access_token)`);
await js(`localStorage.clear(); localStorage.setItem('token', ${JSON.stringify(token)}); history.replaceState(null,'')`);
const reload = async () => { await send('Page.reload'); await sleep(2500); await js(HELPERS); await js(`await until(() => document.querySelector('.hello h1') || document.querySelector('.ph-title'))`); };
await reload();
await shot('01-file');

// 1. Counts match the lists they open.
{
  const v = await js(`
    const counts = Object.fromEntries($$('.stat[aria-label]').filter(b => /^[0-9]/.test(b.getAttribute('aria-label'))).map(b => [b.getAttribute('aria-label').split(' ').slice(1).join(' '), +b.getAttribute('aria-label').split(' ')[0]]));
    idx('medicines').click(); await sleep(400);
    const medList = $$('.list-row-title').length;
    history.back(); await sleep(400);
    idx('prescriptions').click(); await sleep(400);
    const rxList = $$('.rec-row').length;
    history.back(); await sleep(400);
    return { counts, medList, rxList };`);
  check('1 dashboard counts match their lists', v.counts.medicines === v.medList && v.counts.prescriptions === v.rxList, JSON.stringify(v));
}

// 2-3. Upload a readable prescription; it appears exactly once and survives refresh.
{
  const before = await js(`return (await stats()).rows.records`);
  await js(`document.querySelector('.tab-add').click(); await sleep(400); await pick(['rx_readable.png']); await sleep(300);`);
  await shot('02-add-with-page');
  await js(`const s = btn(/^save prescription/i); s.click(); s.click();`);
  const done = await js(`return await until(() => rows().filter(r => /Meera Rao/.test(r)).length === 1 && !pendingRow(), 20000) ? true : false`);
  const after = await js(`return (await stats()).rows.records`);
  check('2 readable prescription uploads and is read', done && after === before + 1, `records ${before}→${after}`);
  await shot('03-after-upload');
  await reload();
  const n = await js(`return rows().filter(r => /Meera Rao/.test(r)).length`);
  check('3 it appears exactly once after refresh', n === 1, `rows=${n}`);
}

// 4-6. Unreadable upload, retry without duplicates, remove it and the warning updates.
{
  const failedBefore = await js(`return failedDocs().length`);
  await js(`document.querySelector('.tab-add').click(); await sleep(400); btn(/lab report/i, document.querySelector('.add-sheet')).click(); await pick(['unreadable.png']); await sleep(300); btn(/^save lab report/i).click();`);
  const failedNow = await js(`return await until(() => failedDocs().length === ${failedBefore + 1} && !pendingRow(), 20000) ? failedDocs().length : failedDocs().length`);
  check('4 unreadable document is reported with its original kept', failedNow === failedBefore + 1, `failed ${failedBefore}→${failedNow}`);
  await shot('04-failed');
  const recs = await js(`return (await stats()).rows.records`);
  await js(`const b = btn(/^try again/i); b.click(); b.click();`);
  const sawPending = await js(`return !!(await until(() => pendingRow(), 4000))`);
  await js(`await until(() => !pendingRow(), 20000)`);
  const after = await js(`const s = await stats(); return { recs: s.rows.records, failed: failedDocs().length }`);
  check('5 retry re-reads without creating a duplicate', sawPending && after.recs === recs && after.failed === failedNow, JSON.stringify({ sawPending, ...after, recsBefore: recs }));
  const storageBefore = await js(`return (await stats()).storage_objects`);
  await js(`$$('.att-doc-open').find(b => /lab report/i.test(b.getAttribute('aria-label'))).click(); await sleep(600);
    btn(/^delete$/i, document.querySelector('.record')).click(); await sleep(300);
    btn(/^delete$/i, document.querySelector('.confirm-box')).click(); await until(() => !document.querySelector('.record'));`);
  await reload();
  const end = await js(`const s = await stats(); return { failed: failedDocs().length, storage: s.storage_objects, label: document.querySelector('.att-text b')?.textContent || null }`);
  check('6 removing it updates the warning, also after refresh, and deletes its file', end.failed === failedNow - 1 && end.storage === storageBefore - 1, JSON.stringify(end));
}

// 7. Edit a record and verify persistence (and the edited mark).
{
  await js(`btn(/^prescription, dr\\. meera rao/i).click(); await sleep(700); btn(/edit details/i).click(); await sleep(300);
    const ta = $$('.record textarea').find(t => t.value === 'Acute pharyngitis'); typeInto(ta, 'Acute tonsillitis');
    btn(/^save$/i, document.querySelector('.record')).click(); await until(() => !document.querySelector('.record .edit-grid'));`);
  await sleep(800);
  await shot('07-edited');
  await reload();
  const v = await js(`btn(/^prescription, dr\\. meera rao/i).click(); await sleep(900);
    const row = $$('.dl-row').find(r => r.querySelector('dt').firstChild.textContent === 'Diagnosis');
    return { value: row.querySelector('dd').textContent, edited: !!row.querySelector('.edited-tag'), sub: rows().find(r => /Meera/.test(r)) }`);
  check('7 edit persists after refresh and is marked as edited', v.value === 'Acute tonsillitis' && v.edited, JSON.stringify(v));
  await shot('07b-record');
  await js(`document.querySelector('.record-bar .icon-btn').click(); await sleep(400);`);
}

// 8-9. Delete a record; it stays deleted; its medicines and file go too.
{
  const s0 = await js(`return await stats()`);
  await js(`btn(/^prescription, dr\\. meera rao/i).click(); await sleep(700);
    btn(/^delete$/i, document.querySelector('.record')).click(); await sleep(300);
    btn(/^delete$/i, document.querySelector('.confirm-box')).click(); await until(() => !document.querySelector('.record'));`);
  await reload();
  const s1 = await js(`return { s: await stats(), n: rows().filter(r => /Meera/.test(r)).length }`);
  check('8 deleted record stays deleted after refresh', s1.n === 0, `rows=${s1.n}`);
  check('9 its medicines, pages and stored file are removed',
    s1.s.rows.records === s0.rows.records - 1 && s1.s.rows.medicines === s0.rows.medicines - 2 && s1.s.rows.record_files === s0.rows.record_files - 1 && s1.s.storage_objects === s0.storage_objects - 1,
    JSON.stringify({ before: s0.rows, after: s1.s.rows }));
}

// 10-11. Search a doctor, medicine and diagnosis; open a result and come back.
{
  const found = {};
  await js(`$$('.tab-i').find(b => /Search$/.test(b.textContent)).click(); await sleep(400);`);
  for (const [k, q] of [['doctor', 'Shetty'], ['medicine', 'montelukast'], ['diagnosis', 'rhinitis']]) {
    found[k] = await js(`typeInto(document.querySelector('.search-input'), ${JSON.stringify(q)}); await sleep(900); return rows()`);
  }
  check('10 search finds by doctor, medicine and diagnosis', ['doctor', 'medicine', 'diagnosis'].every(k => found[k].some(r => /Anil Shetty/.test(r))), JSON.stringify(found));
  await shot('10-search');
  const back = await js(`$$('.rec-row')[0].click(); await sleep(600); const opened = !!document.querySelector('.record');
    history.back(); await sleep(500);
    return { opened, q: document.querySelector('.search-input')?.value, rows: rows().length, modal: !!document.querySelector('.record') }`);
  check('11 opening a result and going back keeps the search', back.opened && back.q === 'rhinitis' && back.rows > 0 && !back.modal, JSON.stringify(back));
}

// 12-13. Ask with sources; missing information; AI service failure.
{
  const a = await js(`btn(/Ask$/).click(); await sleep(300);
    const input = document.querySelector('.ask-input'); typeInto(input, 'What was prescribed for allergic rhinitis?');
    document.querySelector('.ask-form').requestSubmit(); await until(() => document.querySelector('.ask-a, .ask-empty, .notice-error'));
    return { answer: document.querySelector('.ask-a')?.textContent, sources: $$('.ask-src-title').map(e => e.textContent), hdr: document.querySelector('.ask-src-hdr')?.textContent.trim() }`);
  check('12 ask answers with the records it cites', !!a.answer && a.sources.length > 0 && a.sources.every(s => /Shetty|Lakeside|Record/.test(s)), JSON.stringify(a));
  await shot('12-ask');
  const miss = await js(`const input = document.querySelector('.ask-input'); typeInto(input, 'zebra crossing accident');
    document.querySelector('.ask-form').requestSubmit(); await sleep(300); await until(() => !document.querySelector('.ask-card-thinking'));
    return { empty: document.querySelector('.ask-empty')?.textContent, sources: $$('.ask-src').length }`);
  await js(`await fetch('http://localhost:8787/__dev/models?fail=true', { method: 'POST' })`);
  const fail = await js(`const input = document.querySelector('.ask-input'); typeInto(input, 'What was prescribed for allergic rhinitis now?');
    document.querySelector('.ask-form').requestSubmit(); await sleep(300); await until(() => !document.querySelector('.ask-card-thinking'));
    return { error: document.querySelector('.notice-error')?.textContent, answer: document.querySelector('.ask-a')?.textContent || null }`);
  await shot('13-ask-failure');
  await js(`await fetch('http://localhost:8787/__dev/models?fail=false', { method: 'POST' })`);
  check('13 missing information and service failure are told apart', !!miss.empty && miss.sources === 0 && /try again/i.test(fail.error || '') && !fail.answer, JSON.stringify({ miss, fail }));
}

// 14. Switch member; nothing of the other member shows.
{
  const v = await js(`await home(); document.querySelector('.member-chip').click(); await sleep(400); btn(/switch to ravi/i).click(); await until(() => /Ravi/.test(document.querySelector('.hello h1')?.textContent || ''));
    await sleep(800); return { name: document.querySelector('.hello h1').textContent, rows: rows(), needs: !!document.querySelector('.attention') }`);
  check('14 switching member shows only their file', v.rows.length === 1 && /Kiran Patel/.test(v.rows[0]) && !v.needs, JSON.stringify(v));
  await shot('14-ravi');
  await js(`document.querySelector('.member-chip').click(); await sleep(400); btn(/switch to asha/i).click(); await sleep(1200);`);
}

// 15. Back and Forward through nested screens.
{
  const trail = await js(`const t = () => document.querySelector('.record') ? 'record' : (document.querySelector('.ph-title')?.textContent || (document.querySelector('.hello') ? 'Home' : '?'));
    const seen = [];
    idx('doctors').click(); await sleep(400); seen.push(t());
    $$('.list-row').find(r => /Shetty/.test(r.textContent)).click(); await sleep(400); seen.push(t());
    $$('.list-row')[0].click(); await sleep(400); seen.push(t());
    document.querySelector('.doc-card-main').click(); await sleep(600); seen.push(t());
    for (let i = 0; i < 4; i++) { history.back(); await sleep(450); seen.push(t()); }
    history.forward(); await sleep(450); seen.push('fwd:' + t());
    return seen`);
  const want = ['Doctors', 'Dr. Anil Shetty', '12 Aug 2026', 'record', '12 Aug 2026', 'Dr. Anil Shetty', 'Doctors', 'Home', 'fwd:Doctors'];
  check('15 back and forward walk the screens in order', JSON.stringify(trail) === JSON.stringify(want), JSON.stringify(trail));
}

// Duplicate review: compare, keep both, nothing deleted.
{
  const s0 = await js(`await home(); return (await stats()).rows.records`);
  const v = await js(`btn(/^compare$/i).click(); await sleep(500); const groups = $$('.compare').length;
    btn(/keep both/i).click(); await sleep(300); return { groups, after: $$('.compare').length }`);
  await shot('16-review');
  const s1 = await js(`return (await stats()).rows.records`);
  check('duplicates can be compared, and keeping both deletes nothing', v.groups === 1 && v.after === 0 && s0 === s1, JSON.stringify({ ...v, s0, s1 }));
}

// The one 503 from /ask while models were switched off in journey 13 is the
// failure being tested; anything else is a real problem.
const unexpected = (list) => list.filter(x => !/503.*\/ask/.test(x) && !/\/ask.*503|503 \(Service Unavailable\).*\/ask/.test(x));
check('no unexpected console errors or 5xx responses', unexpected(consoleErrors).length === 0 && unexpected(failedRequests).length === 0,
  JSON.stringify({ consoleErrors: unexpected(consoleErrors), failedRequests: unexpected(failedRequests), expected: consoleErrors.length - unexpected(consoleErrors).length }));

await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`);
ws.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} journeys passed`);
process.exit(0);
