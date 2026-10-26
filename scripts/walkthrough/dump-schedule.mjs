import { attach } from './cdp.mjs';
const stage = process.env.STAGE || 'stage.html';
const url = 'http://127.0.0.1:7788/' + stage;
const page = await attach({ url });
await page.viewport(1920, 1080, 1);
await page.go(url, 3000);
const out = await page.js(`await window.ready; return { total: window.TOTAL, schedule: window.SCHEDULE }`);
console.log(JSON.stringify(out));
await page.close();
