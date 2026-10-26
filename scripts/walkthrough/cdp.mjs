// Minimal CDP driver over the DevTools WebSocket. No dependencies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function attach({ port = 9333, url = 'about:blank' } = {}) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
  });
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });

  const api = {
    send, errors, targetId: target.id,
    async js(expr) {
      const r = await send('Runtime.evaluate', {
        expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true,
      });
      if (r.result?.exceptionDetails) {
        throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails));
      }
      return r.result?.result?.value;
    },
    async viewport(width, height, scale = 2) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: scale, mobile: width < 700,
      });
    },
    async go(u, wait = 2200) { await send('Page.navigate', { url: u }); await sleep(wait); },
    async reload(wait = 2200) { await send('Page.reload'); await sleep(wait); },
    async shot(dir, name) {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      mkdirSync(dir, { recursive: true });
      const p = join(dir, name.endsWith('.png') ? name : name + '.png');
      writeFileSync(p, Buffer.from(r.result.data, 'base64'));
      return p;
    },
    async close(port2 = port) { await fetch(`http://127.0.0.1:${port2}/json/close/${target.id}`); ws.close(); },
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');
  return api;
}

export const HELPERS = `
window.$$ = (s, root = document) => [...root.querySelectorAll(s)];
window.sleep = (ms) => new Promise(r => setTimeout(r, ms));
window.until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(120); } return null; };
window.byText = (re, sel = 'button, a, [role=button]') => $$(sel).find(b => re.test(b.getAttribute('aria-label') || '') || re.test(b.textContent.trim()));
window.typeInto = (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
window.box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; };
window.pick = async (names, origin = 'http://localhost:8787') => {
  const input = document.querySelector('[data-testid=add-files]');
  const dt = new DataTransfer();
  for (const n of names) {
    const b = await (await fetch(origin + '/__dev/sample/' + n)).blob();
    dt.items.add(new File([b], n, { type: 'image/png', lastModified: 1 }));
  }
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
`;

export async function login(page, { api = 'http://localhost:8787', app = 'http://localhost:3100' } = {}) {
  await page.go(app + '/', 2600);
  const token = await page.js(`return fetch('${api}/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dev@example.com',password:'local-dev-only-password'})}).then(r=>r.json()).then(j=>j.access_token)`);
  if (!token) throw new Error('login failed');
  await page.js(`localStorage.clear(); localStorage.setItem('token', ${JSON.stringify(token)}); history.replaceState(null,'','/')`);
  await page.reload(2800);
  await page.js(HELPERS);
  await page.js(`await until(() => document.querySelector('.hello h1') || document.querySelector('.ph-title') || document.querySelector('main'))`);
  return token;
}
