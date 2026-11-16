/**
 * Home shows visits, not loose documents: the prescription and the bill for it
 * sit in one card, and adding to that visit starts from the card.
 */
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';
import { groupByVisit } from '../../utils/format';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };
const RX = {
  id: 'r-rx', profile_id: 'p-alice', status: 'done', document_category: 'prescription', document_type: 'Prescription',
  doctor_name: 'Leela Menon', diagnosis: 'Migraine', document_date: '2026-11-14', created_at: '2026-11-14T10:00:00Z',
  medicines: [{ id: 'm1', name: 'Naproxen' }, { id: 'm2', name: 'Domperidone' }], files: [],
};
const BILL = { ...RX, id: 'r-bill', document_category: 'bill', document_type: 'Bill', bill_title: 'Radha Medicals', bill_amount: 1300, diagnosis: null, medicines: [] };
const LOOSE = { ...BILL, id: 'r-loose', doctor_name: null, bill_title: 'City Hospital', bill_amount: 27076, document_date: '2026-08-02', created_at: '2026-08-02T10:00:00Z' };
const READING = { ...RX, id: 'r-new', status: 'processing', doctor_name: null, diagnosis: null, medicines: [], document_date: null, created_at: '2026-11-16T10:00:00Z' };

const serve = (records) => API.get.mockImplementation((url) => {
  if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
  if (url === '/profiles/p-alice/records') return Promise.resolve({ data: records() });
  if (url === '/profiles/p-alice/records/status') return Promise.resolve({ data: records().map(r => ({ id: r.id, status: r.status })) });
  return Promise.resolve({ data: [] });
});

beforeEach(() => { localStorage.setItem('token', 'test-token'); jest.clearAllMocks(); });
afterEach(() => { localStorage.clear(); jest.useRealTimers(); });

test('documents are grouped into visits, and one with no doctor stays on its own', () => {
  const entries = groupByVisit([LOOSE, BILL, RX, READING]);
  // Newest first: the one being read today, then the visit, then the old bill.
  expect(entries.map(e => e.kind)).toEqual(['record', 'visit', 'record']);
  expect(entries[1].records.map(r => r.id).sort()).toEqual(['r-bill', 'r-rx']);
  // Still being read: it names no visit yet.
  expect(entries.filter(e => e.kind === 'record').map(e => e.id).sort()).toEqual(['r-loose', 'r-new']);
});

test('a prescription and its bill sit in one card on Home', async () => {
  serve(() => [RX, BILL, LOOSE]);
  render(<App />);
  const card = (await screen.findByRole('button', { name: /^visit to dr\. leela menon/i })).closest('li');
  expect(within(card).getByText(/migraine · 2 medicines/i)).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: /^prescription, dr\. leela menon/i })).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: /^bill, radha medicals/i })).toHaveTextContent('Bill ₹1,300');
  // The loose bill is not pulled into anybody's visit.
  expect(within(card).queryByText(/27,076/)).toBeNull();
  expect(screen.getByRole('button', { name: /^bill, city hospital/i })).toBeInTheDocument();
});

test('Add on a visit card opens the sheet with that visit already picked', async () => {
  serve(() => [RX]);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /add to the visit with dr\. leela menon/i }));
  const sheet = await screen.findByRole('dialog', { name: /add to this visit/i });
  expect(within(sheet).getByRole('button', { name: /leela menon/i })).toHaveAttribute('aria-pressed', 'true');
});

test('when a document finishes being read, Home says what it was filed as', async () => {
  jest.useFakeTimers();
  let done = false;
  serve(() => [done ? { ...READING, status: 'done', doctor_name: 'Meera Rao', document_date: '2026-11-16', medicines: [{ id: 'x', name: 'A' }] } : READING]);
  render(<App />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.queryByRole('region', { name: /just added/i })).toBeNull();

  done = true;
  await act(async () => { jest.advanceTimersByTime(4100); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

  const card = screen.getByRole('region', { name: /just added/i });
  expect(within(card).getByText('Dr. Meera Rao')).toBeInTheDocument();
  expect(within(card).getByText('1 found')).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: /^ok$/i }));
  expect(screen.queryByRole('region', { name: /just added/i })).toBeNull();
});
