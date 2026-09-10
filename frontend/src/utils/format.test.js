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
