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

/**
 * Whether the document itself defeated us, or we never managed to read it.
 *
 * These used to look the same on screen: whatever went wrong, people were told
 * their document couldn't be read and advised to take a clearer photo. While
 * the reading service was down that advice was shown for perfectly clear
 * prescriptions, and no photo could ever have fixed it.
 *
 * Records from before the backend recorded a reason have none; those keep the
 * original wording.
 */
export const failedOnService = r => r.failure_reason === 'service_unavailable';

export const failureTitle = r => (failedOnService(r)
  ? 'Couldn’t read this document yet'
  : 'Couldn’t read this document');

export const failureAdvice = r => (failedOnService(r)
  ? 'MediVault couldn’t reach the service that reads documents. Your file is safe. Try again in a moment.'
  : 'Try again, or delete it and add a clearer photo.');

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
/**
 * Read but not checked yet: the review card was closed without Save. Only
 * records that carry checked_at at all (migration 010) can be unchecked, so
 * before that migration, and in the demo, nothing is flagged.
 */
export const isUnchecked = r => r.status === 'done'
  && Object.prototype.hasOwnProperty.call(r, 'checked_at') && !r.checked_at;
export const needsReview = r => reviewReasons(r).length > 0 || isUnchecked(r);

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

/**
 * The hospital a doctor works at, from their own documents. A bill filed under
 * a doctor's visit was issued by whoever sold something (a pharmacy, a
 * canteen), so it says nothing about where the doctor practises.
 */
export const doctorHospital = records =>
  (records || []).find(r => r.hospital_name && r.document_category !== 'bill')?.hospital_name || '';

export const getRecordDate = r => r.document_date?.slice(0, 10) || r.created_at?.slice(0, 10) || null;

/**
 * The visit a record belongs to: one doctor on one day. Null when the record
 * names no doctor, because there is then nothing to group it with.
 *
 * This is the same rule the visit page applies. Keeping it in one place is
 * what lets "add to this visit" promise that the document lands there.
 */
export const visitOf = r => {
  const doctorKey = normalizeDrKey(r?.doctor_name);
  const date = r ? getRecordDate(r) : null;
  if (!doctorKey || !date) return null;
  return { id: doctorKey + '|' + date, doctorKey, doctorName: r.doctor_name, date };
};

export const sameVisit = (a, b) => !!a && !!b && a.doctorKey === b.doctorKey && a.date === b.date;

/**
 * Records as a person thinks of them: one entry per visit (a doctor on a day,
 * with everything that came from it), and a plain entry for anything that
 * names no doctor or is still being read. Newest first.
 */
export const groupByVisit = (records) => {
  const entries = [];
  const byVisit = new Map();
  [...(records || [])]
    .sort((a, b) => String(getRecordDate(b) || '').localeCompare(String(getRecordDate(a) || ''))
      || String(b.created_at).localeCompare(String(a.created_at)))
    .forEach(r => {
      const v = r.status === 'done' || !r.status ? visitOf(r) : null;
      if (!v) { entries.push({ kind: 'record', id: r.id, record: r }); return; }
      let entry = byVisit.get(v.id);
      if (!entry) {
        entry = { kind: 'visit', id: v.id, visit: v, records: [] };
        byVisit.set(v.id, entry);
        entries.push(entry);
      }
      entry.records.push(r);
    });
  return entries;
};

/**
 * How many days a prescription line runs for: "5 days", "x 2 weeks", "1 month".
 * Null when it does not say, and then nothing is claimed about it.
 */
export const durationDays = (text) => {
  const m = /(\d+)\s*(day|d\b|week|wk|month)/i.exec(text || '');
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  const unit = m[2].toLowerCase();
  return n * (unit.startsWith('w') ? 7 : unit.startsWith('m') ? 30 : 1);
};

const isoDay = (date) => date.toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (fromIso, toIso) =>
  Math.round((new Date(toIso + 'T00:00:00Z') - new Date(fromIso + 'T00:00:00Z')) / DAY_MS);

// How many recently finished medicines the summary lists under "Earlier".
export const EARLIER_LIMIT = 5;

/**
 * When a course ends, said the way a person would: "ends today", "ends
 * tomorrow", "ends Friday" within the week, otherwise the date.
 */
export const endsText = (untilIso, today = new Date()) => {
  const left = daysBetween(isoDay(today), untilIso);
  if (left <= 0) return 'ends today';
  if (left === 1) return 'ends tomorrow';
  if (left < 7) return 'ends ' + new Date(untilIso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
  return 'ends ' + fmt(untilIso);
};

/**
 * What a doctor asks for first, from the records alone.
 *
 * "Taking now" is only what the paper itself supports: the prescription has a
 * date, the line says for how many days, and that run has not ended. A medicine
 * with no date or no duration is never listed as current, because a wrong
 * "taking now" shown to a doctor is worse than a missing one.
 *
 * The prescription date is day 1, so "5 days" from the 14th runs to the 18th
 * and is under Earlier on the 19th. Each current line says which day it is on.
 */
export const summaryOf = (records, today = new Date()) => {
  const done = (records || []).filter(r => r.status === 'done' || !r.status);
  const todayIso = isoDay(today);
  const now = [];
  const earlier = [];
  done.forEach(r => {
    const start = r.document_date?.slice(0, 10);
    if (!start) return;
    (r.medicines || []).forEach(m => {
      const days = durationDays(m.duration);
      if (!days || !m.name) return;
      const end = new Date(start + 'T00:00:00Z');
      end.setUTCDate(end.getUTCDate() + days - 1);
      const until = isoDay(end);
      const item = { key: r.id + ':' + (m.id || m.name), name: m.name, how: [m.dosage || m.dose, m.frequency].filter(Boolean).join(' · '), until, days, record: r };
      if (start > todayIso) return;
      if (until >= todayIso) now.push({ ...item, day: daysBetween(start, todayIso) + 1 });
      else earlier.push(item);
    });
  });
  earlier.sort((a, b) => (a.until < b.until ? 1 : a.until > b.until ? -1 : 0));
  const visits = recentVisits(done, 3).map(v => {
    const inVisit = done.filter(r => sameVisit(visitOf(r), v));
    return { ...v, diagnosis: inVisit.find(r => r.diagnosis)?.diagnosis || '', record: inVisit[0] };
  });
  const report = done
    .filter(r => r.document_category === 'lab_report')
    .sort((a, b) => timeOf(b.document_date || b.created_at) - timeOf(a.document_date || a.created_at))[0] || null;
  return { now, earlier: earlier.slice(0, EARLIER_LIMIT), visits, report };
};

/** The latest visits among these records, newest first. */
export const recentVisits = (records, limit = 3) => {
  const seen = new Map();
  (records || []).forEach(r => {
    const v = visitOf(r);
    if (v && !seen.has(v.id)) seen.set(v.id, v);
  });
  return [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
};

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

/**
 * The URL to use where a page is shown small: a row thumbnail, the compare
 * strip, the attention list.
 *
 * Lists used the stored original, so drawing a forty-pixel thumbnail meant
 * downloading a multi-megabyte phone photo, and decoding it. Unnoticeable on
 * a laptop; it was most of why the app felt slow on a phone. Pages uploaded
 * before thumbnails existed, and PDFs, have no small copy and fall back to
 * the original, so nothing ever shows a blank square.
 */
export const thumbUrl = f => (f ? (f.thumb_url || f.file_url) : null);

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
