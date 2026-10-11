import { dedupeMedicines } from './format';

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
