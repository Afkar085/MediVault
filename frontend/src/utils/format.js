export const isNil = d => !d || d === 'null' || d === 'undefined';

export const parseDate = d => {
  if (isNil(d)) return null;
  const s = String(d);
  const dt = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  return isNaN(dt.getTime()) ? null : dt;
};

export const fmt = d => {
  if (isNil(d)) return null;
  const dt = parseDate(d);
  if (!dt) return null;
  try { return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return null; }
};

export const fmtDt = d => {
  if (isNil(d)) return '';
  const dt = parseDate(d);
  if (!dt) return '';
  try { return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

export const fmtRel = d => {
  if (isNil(d)) return '';
  const dt = parseDate(d);
  if (!dt) return '';
  const diff = Date.now() - dt.getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), dy = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (h < 24) return h + 'h ago';
  if (dy < 7) return dy + 'd ago';
  return fmt(d) || '';
};

export const dateVal = d => {
  if (isNil(d)) return '';
  const s = String(d);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

export const cur = n => n == null ? '---' : '₹' + Number(n).toLocaleString('en-IN');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const fmtMo = k => {
  if (!k || k === 'Unknown') return 'Unknown';
  const [y, m] = k.split('-');
  return MONTHS[parseInt(m, 10) - 1] + ' ' + y;
};

export const normalizeDrKey = n => {
  if (!n || n === 'null') return '';
  return n.toLowerCase().replace(/^dr\.?\s*/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
};

export const drN = n => {
  if (!n || n === 'null') return 'Unknown';
  return n.match(/^dr\.?\s/i) ? n : 'Dr. ' + n;
};

export const buildDocGroups = records => {
  const docGroups = {};
  const docNameMap = {};
  records.forEach(r => {
    const raw = r.doctor_name || 'Unassigned';
    const key = normalizeDrKey(raw) || 'unassigned';
    if (!docNameMap[key]) docNameMap[key] = raw;
    if (!docGroups[key]) docGroups[key] = [];
    docGroups[key].push(r);
  });
  Object.values(docGroups).forEach(a =>
    a.sort((a, b) => new Date(b.document_date || b.created_at) - new Date(a.document_date || a.created_at))
  );
  const sortedDocs = Object.keys(docGroups)
    .filter(k => k !== 'unassigned')
    .sort((a, b) => new Date(docGroups[b][0].created_at) - new Date(docGroups[a][0].created_at));
  if (docGroups['unassigned']) sortedDocs.push('unassigned');
  return { docGroups, docNameMap, sortedDocs };
};

export const getRecordDate = r => r.document_date?.slice(0, 10) || r.created_at?.slice(0, 10) || null;

export const getActivityLabel = r => {
  const cat = r.document_category || '';
  if (cat === 'prescription') return 'Prescription uploaded';
  if (cat === 'lab_report') return 'Lab Report uploaded';
  if (cat === 'bill') return 'Bill added';
  if (cat === 'discharge_summary') return 'Discharge summary uploaded';
  if (r.doctor_name) return 'Visited ' + drN(r.doctor_name);
  return 'Record added';
};

export const getRecordFiles = r => {
  if (r.files && r.files.length > 0) return r.files;
  if (r.file_url) return [{ file_url: r.file_url, file_path: r.file_path, page_number: 1 }];
  return [];
};

export const drInitial = name => {
  if (!name || name === 'Unassigned') return '?';
  const stripped = name.replace(/^dr\.?\s*/i, '').trim();
  return (stripped[0] || name[0]).toUpperCase();
};
