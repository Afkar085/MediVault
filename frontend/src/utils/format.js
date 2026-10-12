export const isNil = d => !d || d === 'null' || d === 'undefined';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A Date from what the API sends, parsed the same way in every browser.
 *
 * It used to append "Z" to anything without a zone. Chrome accepts
 * "2024-01-25Z"; iOS Safari does not, so on an iPhone every document date
 * came back invalid: a record said "No date on record" while its edit form
 * showed the date, and the dashboard printed "last visit null".
 *
 * A document date (YYYY-MM-DD) is a calendar day, not an instant, so it is
 * built as a local date: no timezone can move it to the day before. Timestamps
 * are stored in UTC without a zone, so they are read as UTC, normalised to a
 * form Safari parses (a "T" separator, at most millisecond precision).
 */
export const parseDate = d => {
  if (isNil(d)) return null;
  const s = String(d).trim();
  const day = s.match(DATE_ONLY);
  if (day) {
    const dt = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  let iso = s.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += 'Z';
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
};

/**
 * Today's date as YYYY-MM-DD in the person's own timezone: the latest date a
 * document can carry. toISOString() is UTC, so in India until 05:30 it still
 * said yesterday, and a document dated today could not be picked.
 */
export const todayISO = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

/** Milliseconds for sorting; an unparseable value sorts as oldest instead of breaking the order. */
export const timeOf = d => parseDate(d)?.getTime() || 0;

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
    a.sort((a, b) => timeOf(b.document_date || b.created_at) - timeOf(a.document_date || a.created_at))
  );
  const sortedDocs = Object.keys(docGroups)
    .filter(k => k !== 'unassigned')
    .sort((a, b) => timeOf(docGroups[b][0].created_at) - timeOf(docGroups[a][0].created_at));
  if (docGroups['unassigned']) sortedDocs.push('unassigned');
  return { docGroups, docNameMap, sortedDocs };
};

// Two documents from one visit (e.g. a handwritten AND a printed copy of the same
// prescription) usually list the same drugs, so a raw union shows each medicine
// twice — once as "AZEE" and once as "AZEE 500MG TABLET". Collapse by brand (the
// first word of the name), keeping whichever entry carries the most detail.
const _medScore = m => {
  const fields = ['strength', 'dosage', 'frequency', 'duration', 'type', 'morning', 'afternoon', 'night'];
  return fields.reduce((n, k) => n + (m[k] ? 1 : 0), 0) + ((m.name || '').length * 0.01);
};

export const dedupeMedicines = meds => {
  const byKey = new Map();
  const singles = [];
  (meds || []).forEach(m => {
    const key = (m.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0];
    if (!key) { singles.push(m); return; }
    const existing = byKey.get(key);
    if (!existing || _medScore(m) > _medScore(existing)) byKey.set(key, m);
  });
  return [...byKey.values(), ...singles];
};

export const isPending = r => r.status === 'processing' || r.status === 'extracting';
export const isFailed = r => r.status === 'failed';

const _medKey = name => (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Every distinct medicine across the given records, newest prescription first.
 *
 * What the dashboard's Medicines count is a count OF, and what the Medicines
 * list shows, so the number on the tile always matches the list behind it. The
 * old count summed every row on every record, so one medicine prescribed at
 * three visits counted three times. Matching is on the whole name: "AZEE 250"
 * and "AZEE 500" are different instructions, not duplicates.
 */
export const uniqueMedicines = records => {
  const byKey = new Map();
  const ordered = [...(records || [])]
    .filter(r => r.status === 'done')
    .sort((a, b) => String(getRecordDate(b) || '').localeCompare(String(getRecordDate(a) || '')));
  ordered.forEach(r => (r.medicines || []).forEach(m => {
    const key = _medKey(m.name);
    if (!key) return;
    const entry = byKey.get(key);
    if (entry) { entry.count += 1; if (!entry.records.includes(r)) entry.records.push(r); return; }
    byKey.set(key, { key, name: m.name, medicine: m, latest: r, count: 1, records: [r] });
  }));
  return [...byKey.values()];
};

/**
 * What a saved record is still missing, in words. A record the reader could only
 * partly make out (no date, no doctor or hospital) is saved, but it is not right
 * yet, and it would sit in the wrong place in the file until someone fixes it.
 * Nothing is guessed: this only reports absences.
 */
export const reviewReasons = r => {
  if (r.status !== 'done') return [];
  const reasons = [];
  if (!r.document_date) reasons.push('date');
  // Only what the record cannot do without: a prescription is from someone;
  // a lab report or general document may have neither, and that is fine.
  if (r.document_category === 'prescription' && !r.doctor_name && !r.hospital_name) reasons.push('doctor');
  if (r.document_category === 'bill' && r.bill_amount == null) reasons.push('amount');
  return reasons;
};
export const needsReview = r => reviewReasons(r).length > 0;

/**
 * Groups of records that may be the same document saved twice, for a person to
 * look at. Deliberately strict (same type, same date, same doctor, and the same
 * medicines or diagnosis) and never acted on automatically: two visits to one
 * doctor on one day can be genuinely different records.
 */
export const possibleDuplicates = (records, dismissed = []) => {
  const groups = new Map();
  (records || []).filter(r => r.status === 'done' && r.document_date).forEach(r => {
    const meds = (r.medicines || []).map(m => _medKey(m.name)).filter(Boolean).sort().join('|');
    const content = meds || (r.diagnosis || '').trim().toLowerCase();
    if (!content) return;
    const key = [r.document_category, getRecordDate(r), normalizeDrKey(r.doctor_name), content].join('#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()]
    .filter(g => g.length > 1)
    .filter(g => !dismissed.includes(g.map(r => r.id).sort().join(',')));
};
export const duplicateGroupId = group => group.map(r => r.id).sort().join(',');

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

// Only files with a usable signed URL are returned. Signed URLs are minted per
// request and can be absent if signing failed, so every caller would otherwise
// have to guard against rendering an image with no source.
export const getRecordFiles = r => {
  if (r.files && r.files.length > 0) return r.files.filter(f => f.file_url);
  if (r.file_url) return [{ file_url: r.file_url, file_path: r.file_path, page_number: 1 }];
  return [];
};

export const hasStoredDocument = r => Boolean((r.files && r.files.length > 0) || r.file_path || r.file_url);

const CAT_ICON = {
  prescription: 'description',
  lab_report: 'science',
  bill: 'receipt_long',
  discharge_summary: 'assignment',
};
export const catIcon = c => CAT_ICON[c] || 'folder';

export const drInitial = name => {
  if (!name || name === 'Unassigned') return '?';
  const stripped = name.replace(/^dr\.?\s*/i, '').trim();
  return (stripped[0] || name[0]).toUpperCase();
};
