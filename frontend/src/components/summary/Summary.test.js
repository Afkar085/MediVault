import { durationDays, endsText, summaryOf } from '../../utils/format';

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
  // 5 days from the 14th: the 14th is day 1, the 18th is the last day.
  expect(s.now[0].until).toBe('2026-11-18');
});

test('a 5 day course dated 3 days ago is on day 4 of 5, and on day 6 it is under Earlier', () => {
  const recs = [rx('a', '2026-11-13', 'Leela Menon', [{ id: 'm1', name: 'Azee 500', duration: '5 days' }])];
  const s = summaryOf(recs, TODAY);
  expect(s.now.map(m => [m.name, m.day, m.days])).toEqual([['Azee 500', 4, 5]]);
  expect(s.earlier).toEqual([]);

  const later = summaryOf(recs, new Date('2026-11-18T09:00:00Z'));
  expect(later.now).toEqual([]);
  expect(later.earlier.map(m => [m.name, m.until])).toEqual([['Azee 500', '2026-11-17']]);
});

test('the last day of a course is still today', () => {
  const s = summaryOf([rx('a', '2026-11-12', 'Leela Menon', [{ id: 'm1', name: 'Dolo 650', duration: '5 days' }])], TODAY);
  expect(s.now.map(m => [m.day, m.days])).toEqual([[5, 5]]);
});

test('earlier medicines are newest first and only the latest few', () => {
  const recs = [1, 2, 3, 4, 5, 6, 7].map(n =>
    rx('r' + n, '2026-10-0' + n, 'Anil Shetty', [{ id: 'm' + n, name: 'Med ' + n, duration: '3 days' }]));
  const s = summaryOf(recs, TODAY);
  expect(s.earlier.map(m => m.name)).toEqual(['Med 7', 'Med 6', 'Med 5', 'Med 4', 'Med 3']);
});

test('a prescription dated after today is not listed yet', () => {
  const s = summaryOf([rx('a', '2026-11-20', 'Leela Menon', [{ id: 'm1', name: 'X', duration: '5 days' }])], TODAY);
  expect(s.now).toEqual([]);
  expect(s.earlier).toEqual([]);
});

test('the end of a course is said in plain words', () => {
  expect(endsText('2026-11-16', TODAY)).toBe('ends today');
  expect(endsText('2026-11-17', TODAY)).toBe('ends tomorrow');
  expect(endsText('2026-11-20', TODAY)).toBe('ends Friday');
  expect(endsText('2026-12-01', TODAY)).toMatch(/^ends 1 Dec 2026$/);
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
