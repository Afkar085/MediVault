import {
  dedupeMedicines,
  failedOnService,
  failureAdvice,
  failureTitle,
} from './format';

test('collapses brand variants from two documents, keeping the more detailed entry', () => {
  const meds = [
    { name: 'AZEE' },
    { name: 'AZEE 500MG TABLET', strength: '500mg', morning: 1 },
    { name: 'JUSTRIL' },
    { name: 'JUSTRIL FORTE tab', dosage: '1-0-1', duration: '3 days' },
    { name: 'Paracetamol' },
  ];
  const names = dedupeMedicines(meds).map(m => m.name).sort();
  expect(names).toEqual(['AZEE 500MG TABLET', 'JUSTRIL FORTE tab', 'Paracetamol']);
});

test('keeps genuinely different drugs distinct', () => {
  const out = dedupeMedicines([{ name: 'Pantoprazole' }, { name: 'Paracetamol' }]);
  expect(out).toHaveLength(2);
});

test('handles empty and nameless entries safely', () => {
  expect(dedupeMedicines([])).toEqual([]);
  expect(dedupeMedicines(undefined)).toEqual([]);
  const out = dedupeMedicines([{ name: '' }, { name: 'Azee' }]);
  expect(out.map(m => m.name)).toContain('Azee');
});

describe('uniqueMedicines', () => {
  const { uniqueMedicines } = require('./format');
  const rec = (id, date, meds, status = 'done') => ({ id, status, document_date: date, medicines: meds.map(name => ({ name })) });

  test('one medicine prescribed at several visits is counted once, newest first', () => {
    const meds = uniqueMedicines([
      rec('old', '2026-01-01', ['Paracetamol 650']),
      rec('new', '2026-06-01', ['PARACETAMOL 650', 'Azee 500']),
    ]);
    expect(meds.map(m => m.key)).toEqual(['paracetamol 650', 'azee 500']);
    expect(meds[0].latest.id).toBe('new');
    expect(meds[0].records.map(r => r.id)).toEqual(['new', 'old']);
  });

  test('different strengths are different medicines', () => {
    expect(uniqueMedicines([rec('a', '2026-01-01', ['Azee 250', 'Azee 500'])])).toHaveLength(2);
  });

  test('documents that are not read yet, or failed, are not counted', () => {
    expect(uniqueMedicines([rec('a', '2026-01-01', ['X'], 'processing'), rec('b', null, ['Y'], 'failed')])).toEqual([]);
  });
});

describe('review and possible duplicates', () => {
  const { reviewReasons, possibleDuplicates, duplicateGroupId } = require('./format');
  const rec = (id, extra = {}) => ({ id, status: 'done', document_category: 'prescription', document_date: '2026-05-03',
    doctor_name: 'Dr. Rao', medicines: [{ name: 'Dolo 650' }], ...extra });

  test('a record is flagged only for what is actually missing', () => {
    expect(reviewReasons(rec('a'))).toEqual([]);
    expect(reviewReasons(rec('a', { document_date: null }))).toEqual(['date']);
    expect(reviewReasons(rec('a', { doctor_name: null }))).toEqual(['doctor']);
    expect(reviewReasons(rec('a', { doctor_name: null, hospital_name: 'City Clinic' }))).toEqual([]);
    expect(reviewReasons(rec('a', { document_category: 'bill', bill_amount: null }))).toEqual(['amount']);
    expect(reviewReasons(rec('a', { status: 'failed', document_date: null }))).toEqual([]);
    // Optional details are not 'missing': a lab report needs no doctor.
    expect(reviewReasons(rec('a', { document_category: 'lab_report', doctor_name: null }))).toEqual([]);
    expect(reviewReasons(rec('a', { document_category: 'other', doctor_name: null }))).toEqual([]);
  });

  test('the same document saved twice is found', () => {
    const groups = possibleDuplicates([rec('a'), rec('b'), rec('c', { document_date: '2026-06-01' })]);
    expect(groups.map(g => g.map(r => r.id))).toEqual([['a', 'b']]);
  });

  test('two genuine visits are not called duplicates', () => {
    expect(possibleDuplicates([rec('a'), rec('b', { medicines: [{ name: 'Azee 500' }] })])).toEqual([]);
    expect(possibleDuplicates([rec('a'), rec('b', { doctor_name: 'Dr. Menon' })])).toEqual([]);
    expect(possibleDuplicates([rec('a', { document_date: null }), rec('b', { document_date: null })])).toEqual([]);
  });

  test('a pair someone kept is not raised again', () => {
    const pair = [rec('a'), rec('b')];
    expect(possibleDuplicates(pair, [duplicateGroupId(pair)])).toEqual([]);
  });
});

describe('dates parse the same way in Safari as in Chrome', () => {
  const { parseDate, fmt, timeOf } = require('./format');
  const RealDate = Date;
  // iOS Safari rejects strings Chrome tolerates. Emulate exactly those
  // rejections, which is what made every date invalid on an iPhone.
  class SafariDate extends RealDate {
    constructor(...args) {
      const s = args[0];
      if (args.length === 1 && typeof s === 'string'
        && (/^\d{4}-\d{2}-\d{2}Z$/.test(s) || / /.test(s) || /\.\d{4,}/.test(s))) {
        super(NaN);
        return;
      }
      super(...args);
    }
    static now() { return RealDate.now(); }
  }
  beforeAll(() => { global.Date = SafariDate; });
  afterAll(() => { global.Date = RealDate; });

  test('a document date is shown, not reported missing', () => {
    expect(fmt('2024-01-25')).toBe('25 Jan 2024');
  });

  test('a document date is a calendar day and never shifts with the timezone', () => {
    const d = parseDate('2024-01-25');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 0, 25]);
  });

  test('database timestamps with microseconds or a space still parse', () => {
    expect(parseDate('2026-06-29T10:00:00.123456')).not.toBeNull();
    expect(parseDate('2026-06-29 10:00:00')).not.toBeNull();
    expect(parseDate('2026-06-29T10:00:00+00:00')).not.toBeNull();
    expect(timeOf('2026-06-29T10:00:00.123456')).toBeGreaterThan(timeOf('2026-06-28T10:00:00'));
  });

  test('missing or invalid values never become the text "null"', () => {
    expect(fmt(null)).toBeNull();
    expect(fmt('not a date')).toBeNull();
    expect(timeOf(undefined)).toBe(0);
  });
});

describe('todayISO', () => {
  const { todayISO } = require('./format');
  afterEach(() => jest.useRealTimers());

  test('is the local calendar day, not the UTC one', () => {
    // 00:30 on 13 Oct in the local zone. In India that is still 12 Oct in UTC,
    // which is what the date pickers used to cap at.
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 13, 0, 30));
    expect(todayISO()).toBe('2026-10-13');
  });

  test('pads month and day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5, 12, 0));
    expect(todayISO()).toBe('2026-01-05');
  });
});

describe('doctorHospital', () => {
  const { doctorHospital } = require('./format');
  test('a bill filed under a doctor does not become their hospital', () => {
    expect(doctorHospital([
      { document_category: 'bill', hospital_name: 'Example Food Court' },
      { document_category: 'prescription', hospital_name: 'City ENT Centre' },
    ])).toBe('City ENT Centre');
  });
  test('only bills means no hospital rather than a wrong one', () => {
    expect(doctorHospital([{ document_category: 'bill', hospital_name: 'Example Food Court' }])).toBe('');
  });
});

// --- why a document could not be read ---------------------------------------
//
// "Couldn't be read, take a clearer photo" was shown whatever had gone wrong.
// While Groq's vision model was retired (2026-09-14) that was every upload,
// including perfectly clear prescriptions, and no photo would have helped.

describe('failure wording', () => {
  const unreadable = { status: 'failed', failure_reason: 'unreadable' };
  const serviceDown = { status: 'failed', failure_reason: 'service_unavailable' };
  const older = { status: 'failed' };  // recorded before the reason was stored

  test('a service failure is not blamed on the document', () => {
    expect(failedOnService(serviceDown)).toBe(true);
    expect(failureAdvice(serviceDown)).toMatch(/couldn’t reach the service/i);
    expect(failureAdvice(serviceDown)).not.toMatch(/clearer photo/i);
  });

  test('a document that really has no text still says so', () => {
    expect(failedOnService(unreadable)).toBe(false);
    expect(failureAdvice(unreadable)).toMatch(/clearer photo/i);
  });

  test('a record from before the reason was stored keeps the old wording', () => {
    expect(failedOnService(older)).toBe(false);
    expect(failureTitle(older)).toBe('Couldn’t read this document');
  });

  test('a service failure reads as temporary, not final', () => {
    expect(failureTitle(serviceDown)).toMatch(/yet/);
    expect(failureAdvice(serviceDown)).toMatch(/safe/i);
  });
});
