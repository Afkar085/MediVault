import { durationDays, summaryOf } from '../../utils/format';

const TODAY = new Date('2026-11-16T09:00:00Z');
const rx = (id, date, doctor, meds, extra = {}) => ({
  id, status: 'done', document_category: 'prescription', doctor_name: doctor,
  document_date: date, created_at: date + 'T00:00:00Z', medicines: meds, ...extra,
});

test('a duration is read only when the line actually says one', () => {
  expect(durationDays('5 days')).toBe(5);
  expect(durationDays('x 2 weeks')).toBe(14);
  expect(durationDays('1 month')).toBe(30);
  expect(durationDays('after food')).toBeNull();
  expect(durationDays('')).toBeNull();
  expect(durationDays(undefined)).toBeNull();
});

test('taking now lists only medicines whose dated course has not ended', () => {
  const s = summaryOf([
    rx('a', '2026-11-14', 'Leela Menon', [{ id: 'm1', name: 'Naproxen 250 mg', duration: '5 days', frequency: 'When needed' }]),
    rx('b', '2026-08-12', 'Anil Shetty', [{ id: 'm2', name: 'Paracetamol 650 mg', duration: '5 days' }]),
  ], TODAY);
  expect(s.now.map(m => m.name)).toEqual(['Naproxen 250 mg']);
  expect(s.now[0].until).toBe('2026-11-19');
});

test('a medicine with no duration or no date is never called current', () => {
  const s = summaryOf([
    rx('a', '2026-11-14', 'Leela Menon', [{ id: 'm1', name: 'Vitamin D' }]),
    rx('b', null, 'Kiran Rao', [{ id: 'm2', name: 'Amoxicillin', duration: '5 days' }]),
  ], TODAY);
  expect(s.now).toEqual([]);
});

test('recent visits carry the diagnosis, and the latest lab report is found', () => {
  const s = summaryOf([
    rx('a', '2026-11-14', 'Leela Menon', [], { diagnosis: 'Migraine' }),
    rx('b', '2026-08-12', 'Anil Shetty', [], { diagnosis: 'Viral fever' }),
    rx('c', '2026-08-12', 'Anil Shetty', [], { document_category: 'lab_report', diagnosis: 'Complete blood count' }),
    rx('d', '2026-01-02', 'Anil Shetty', [], { document_category: 'lab_report', diagnosis: 'Old test' }),
  ], TODAY);
  expect(s.visits.map(v => v.diagnosis)).toEqual(['Migraine', 'Viral fever', 'Old test']);
  expect(s.report.diagnosis).toBe('Complete blood count');
});

test('a document still being read is left out', () => {
  const s = summaryOf([rx('a', '2026-11-14', 'Leela Menon', [{ id: 'm1', name: 'X', duration: '9 days' }], { status: 'processing' })], TODAY);
  expect(s.now).toEqual([]);
  expect(s.visits).toEqual([]);
});
