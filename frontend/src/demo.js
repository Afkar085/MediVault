/**
 * The demo: a sample family served from inside the app.
 *
 * "Try the demo" has to open at once, for someone who will give it ten
 * seconds. A sign-in against a sleeping server cannot do that, so the demo
 * never touches the network: every request is answered here, from data that
 * ships with the page. Nothing in it is a real person or a real record, and
 * nothing can be saved.
 */
const KEY = 'mv_demo';

export const isDemo = () => {
  try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
};

export const setDemo = (on) => {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch (e) { /* private mode: the demo just will not survive a reload */ }
};

const pageOf = (id) => (process.env.PUBLIC_URL || '') + '/demo/' + id + '.png';

// Dates are counted back from today, so "taking now" is always true to the
// moment the demo is opened.
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const record = (id, profileId, when, fields) => ({
  id,
  profile_id: profileId,
  status: 'done',
  document_type: 'Prescription',
  document_category: 'prescription',
  document_date: daysAgo(when),
  created_at: daysAgo(when) + 'T10:00:00Z',
  updated_at: daysAgo(when) + 'T10:00:00Z',
  file_path: 'demo/' + id + '.png',
  thumb_url: pageOf(id),
  files: [{ id: id + '-f1', record_id: id, file_path: 'demo/' + id + '.png', file_url: pageOf(id), thumb_url: pageOf(id), page_number: 1 }],
  medicines: [],
  raw_ocr_text: 'Sample page. In your own account this shows the text that was read from the photo.',
  ...fields,
});

const med = (id, name, dosage, frequency, duration) => ({ id, name, dosage, frequency, duration });

const build = () => {
  const profiles = [
    { id: 'demo-asha', name: 'Asha', relationship: 'Self' },
    { id: 'demo-ravi', name: 'Ravi', relationship: 'Son' },
    { id: 'demo-amma', name: 'Amma', relationship: 'Mother' },
  ];
  const records = [
    record('d1', 'demo-asha', 2, {
      doctor_name: 'Dr. Leela Menon', hospital_name: 'City Hospital', specialty: 'Neurology',
      diagnosis: 'Migraine', recommendations: 'Rest in a dark room. Come back if it lasts more than three days.',
      medicines: [med('d1m1', 'Naproxen 250 mg', '1 tablet', 'When needed', '5 days'), med('d1m2', 'Domperidone 10 mg', '1 tablet', 'Before food', '5 days')],
    }),
    record('d2', 'demo-asha', 2, {
      document_category: 'bill', document_type: 'Bill', doctor_name: 'Dr. Leela Menon',
      bill_title: 'Radha Medicals', bill_category: 'pharmacy', bill_amount: 1300, hospital_name: 'Radha Medicals',
    }),
    record('d3', 'demo-asha', 13, {
      doctor_name: 'Dr. Kiran Rao', hospital_name: 'Smile Dental Clinic', specialty: 'Dental',
      diagnosis: 'Dental check, one filling', medicines: [med('d3m1', 'Amoxicillin 500 mg', '1 capsule', 'Three times a day', '5 days')],
    }),
    record('d4', 'demo-asha', 96, {
      doctor_name: 'Dr. Anil Shetty', hospital_name: 'City Hospital', specialty: 'General medicine',
      diagnosis: 'Viral fever', recommendations: 'Fluids and rest.',
      medicines: [med('d4m1', 'Paracetamol 650 mg', '1 tablet', 'Three times a day', '5 days'), med('d4m2', 'Cetirizine 10 mg', '1 tablet', 'At night', '3 days'), med('d4m3', 'Vitamin C 500 mg', '1 tablet', 'Once a day', '5 days')],
    }),
    record('d5', 'demo-asha', 96, {
      document_category: 'lab_report', document_type: 'Lab Report', doctor_name: 'Dr. Anil Shetty',
      hospital_name: 'City Hospital', diagnosis: 'Complete blood count',
    }),
    record('d6', 'demo-asha', 106, {
      document_category: 'bill', document_type: 'Bill', bill_title: 'City Hospital', bill_category: 'hospital',
      bill_amount: 27076, hospital_name: 'City Hospital',
    }),
    record('d7', 'demo-ravi', 30, {
      doctor_name: 'Dr. Meera Rao', hospital_name: 'City Hospital', specialty: 'ENT', diagnosis: 'Acute tonsillitis',
      medicines: [med('d7m1', 'Azithromycin 250 mg', '1 tablet', 'Once a day', '3 days')],
    }),
    record('d8', 'demo-amma', 6, {
      doctor_name: 'Dr. Suresh Pai', hospital_name: 'Heart Care Centre', specialty: 'Cardiology', diagnosis: 'Blood pressure review',
      medicines: [med('d8m1', 'Amlodipine 5 mg', '1 tablet', 'Morning', '30 days'), med('d8m2', 'Telmisartan 40 mg', '1 tablet', 'Night', '30 days')],
    }),
  ];
  return { profiles, records };
};

let data = null;
const store = () => { if (!data) data = build(); return data; };

const hay = (r) => [r.doctor_name, r.hospital_name, r.specialty, r.diagnosis, r.bill_title, ...(r.medicines || []).map(m => m.name)]
  .filter(Boolean).join(' ').toLowerCase();

const READ_ONLY = 'The demo is read only. Create an account to add your own records.';

const answer = (question, records) => {
  const words = (question || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const hit = records.find(r => words.some(w => hay(r).includes(w))) || records[0];
  if (!hit) return { answer: 'There is nothing in the sample records about that.', sources: [], found: false };
  const meds = (hit.medicines || []).map(m => m.name + ' (' + [m.frequency, m.duration].filter(Boolean).join(', ') + ')').join('; ');
  const text = (hit.doctor_name || hit.bill_title || 'This document') + ' on ' + hit.document_date
    + (hit.diagnosis ? ': ' + hit.diagnosis + '.' : '.') + (meds ? ' Prescribed: ' + meds + '.' : '') + ' [1]';
  return {
    answer: text, found: true, source_kind: 'cited',
    sources: [{ ref: '[1]', record_id: hit.id, profile_id: hit.profile_id, doctor_name: hit.doctor_name, date: hit.document_date, member: '' }],
  };
};

const route = (method, path, config) => {
  const { profiles, records } = store();
  if (method !== 'get') {
    if (method === 'post' && /\/ask$/.test(path)) {
      const pid = (path.match(/^\/profiles\/([^/]+)\/ask$/) || [])[1];
      let question = '';
      try { question = (typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}).question; } catch (e) { /* no question */ }
      return answer(question, pid ? records.filter(r => r.profile_id === pid) : records);
    }
    return { error: 403, detail: READ_ONLY };
  }
  if (path === '/profiles') return profiles;
  if (path === '/search') {
    const q = String(config.params?.q || '').trim().toLowerCase();
    return q ? records.filter(r => hay(r).includes(q)) : [];
  }
  let m = path.match(/^\/profiles\/([^/]+)\/records$/);
  if (m) return records.filter(r => r.profile_id === m[1]);
  m = path.match(/^\/profiles\/([^/]+)\/records\/status$/);
  if (m) return records.filter(r => r.profile_id === m[1]).map(r => ({ id: r.id, status: r.status, updated_at: r.updated_at }));
  m = path.match(/^\/profiles\/([^/]+)\/records\/([^/]+)\/history$/);
  if (m) return [];
  m = path.match(/^\/profiles\/([^/]+)\/records\/([^/]+)$/);
  if (m) return records.find(r => r.id === m[2] && r.profile_id === m[1]) || { error: 404, detail: 'Record not found' };
  m = path.match(/^\/profiles\/([^/]+)\/health-journey$/);
  if (m) {
    const mine = records.filter(r => r.profile_id === m[1] && r.diagnosis);
    return { summary: mine.map(r => r.document_date + ': ' + r.diagnosis + (r.doctor_name ? ' (' + r.doctor_name + ')' : '')).join('\n') };
  }
  return { error: 404, detail: 'Not in the demo.' };
};

/** An axios adapter: answers from the sample data instead of the network. */
export const demoAdapter = (config) => new Promise((resolve, reject) => {
  const method = (config.method || 'get').toLowerCase();
  const path = (config.url || '').split('?')[0];
  const body = route(method, path, config);
  if (body && body.error) {
    const error = new Error(body.detail);
    error.config = config;
    error.isAxiosError = true;
    error.response = { status: body.error, statusText: 'Error', data: { detail: body.detail }, headers: {}, config };
    reject(error);
    return;
  }
  resolve({ data: JSON.parse(JSON.stringify(body)), status: 200, statusText: 'OK', headers: {}, config });
});
