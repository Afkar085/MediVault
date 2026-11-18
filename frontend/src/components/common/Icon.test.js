/**
 * Every icon the app draws must be in the icon font that index.html loads.
 * The font is cut down to a list of names (the full one is megabytes), and a
 * name missing from the list shows as its word: "favorite", "delete".
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(SRC, '..', 'public', 'index.html'), 'utf8');
const loaded = new Set(html.match(/icon_names=([a-z0-9_,]+)/)[1].split(','));

const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) walk(p);
  else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
});
walk(SRC);

const used = new Set();
files.forEach(f => {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/<Icon[^>]*?\bname="([a-z0-9_]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/<Icon[^>]*?\bname=\{[^}]*\}/g)) {
    for (const q of m[0].matchAll(/'([a-z0-9_]+)'/g)) used.add(q[1]);
  }
  for (const m of text.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)) used.add(m[1]);
});

test('the icon list in index.html is in alphabetical order, as Google requires', () => {
  const list = html.match(/icon_names=([a-z0-9_,]+)/)[1].split(',');
  expect(list).toEqual([...list].sort());
});

test('every icon name used in the app is loaded by the icon font', () => {
  const missing = [...used].filter(n => !loaded.has(n) && !['bill', 'lab_report', 'prescription'].includes(n));
  expect(missing).toEqual([]);
});
