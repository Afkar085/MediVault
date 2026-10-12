import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };

const rec = (id, extra = {}) => ({
  id,
  profile_id: 'p-alice',
  status: 'done',
  document_category: 'prescription',
  doctor_name: 'Kumar',
  document_date: '2026-06-14',
  created_at: '2026-06-14T00:00:00Z',
  medicines: [],
  files: [],
  ...extra,
});

// An old failure: not among the five newest, which is where the old warning
// told people to look for it.
const OLD_FAILURE = rec('r-old-fail', { status: 'failed', doctor_name: null, created_at: '2025-01-01T00:00:00Z', document_date: null });

function load(records) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: records });
    return Promise.resolve({ data: [] });
  });
  render(<App />);
  return act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});
afterEach(() => localStorage.clear());

test('an old unreadable document is listed where it can be acted on', async () => {
  const recent = Array.from({ length: 6 }, (_, i) => rec('r' + i, { created_at: '2026-06-1' + i + 'T00:00:00Z' }));
  await load([...recent, OLD_FAILURE]);

  const panel = (await screen.findByText(/1 document couldn’t be read/i)).closest('section');
  expect(within(panel).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: /^open the .* uploaded/i }));
  expect(await screen.findByRole('dialog')).toHaveTextContent(/couldn’t read this document/i);
});

test('the warning clears when the failed document is deleted', async () => {
  API.delete.mockResolvedValue({ data: {} });
  await load([rec('r-ok'), OLD_FAILURE]);
  expect(await screen.findByText(/1 document couldn’t be read/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^open the .* uploaded/i }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^delete$/i }));
  const confirm = screen.getByRole('dialog', { name: /delete record/i });
  fireEvent.click(within(confirm).getByRole('button', { name: /^delete$/i }));

  await waitFor(() => expect(screen.queryByText(/couldn’t be read/i)).not.toBeInTheDocument());
});

test('retrying from the dashboard starts reading again and shows progress', async () => {
  API.post.mockResolvedValue({ data: { record_id: 'r-old-fail', status: 'processing', started: true } });
  await load([rec('r-ok'), OLD_FAILURE]);
  fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/profiles/p-alice/records/r-old-fail/retry'));
  expect(await screen.findByText(/reading 1 document/i)).toBeInTheDocument();
  expect(screen.queryByText(/couldn’t be read/i)).not.toBeInTheDocument();
});

test('the medicines count is distinct medicines, matching the list it opens', async () => {
  await load([
    rec('a', { medicines: [{ id: 'm1', name: 'Paracetamol 650' }, { id: 'm2', name: 'Azee 500' }] }),
    rec('b', { medicines: [{ id: 'm3', name: 'PARACETAMOL 650' }] }),  // same medicine, another visit
  ]);
  expect(await screen.findByRole('button', { name: '2 medicines' })).toBeInTheDocument();
});

test('category counts include documents still being read but not failed ones', async () => {
  await load([
    rec('a'),
    rec('b', { status: 'processing' }),
    rec('c', { status: 'failed', created_at: '2026-06-20T00:00:00Z' }),
  ]);
  expect(await screen.findByRole('button', { name: '2 prescriptions' })).toBeInTheDocument();
});

test('possible duplicates are compared, and keeping both only hides the hint', async () => {
  const twin = (id) => rec(id, { medicines: [{ id: id + 'm', name: 'Dolo 650' }], document_date: '2026-05-03' });
  await load([twin('d1'), twin('d2')]);
  fireEvent.click(await screen.findByRole('button', { name: /compare/i }));
  expect(await screen.findByText(/possible duplicates/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /keep both/i }));
  expect(screen.queryByText(/possible duplicates/i)).not.toBeInTheDocument();
  expect(API.delete).not.toHaveBeenCalled();
});

test('the summary line never shows "null" when no record has a date', async () => {
  await load([rec('a', { document_date: null }), rec('b', { document_date: null })]);
  const summary = await screen.findByText((_, el) => el.tagName === 'P' && el.textContent.trim().startsWith('2 records'));
  expect(summary.textContent.trim()).toBe('2 records');
  expect(document.body.textContent).not.toMatch(/null|undefined|NaN/);
});

test('a lab report without a doctor is not flagged as missing details', async () => {
  await load([rec('lab', { document_category: 'lab_report', doctor_name: null, hospital_name: null })]);
  await screen.findByText(/1 record/);
  expect(screen.queryByText(/missing details/i)).not.toBeInTheDocument();
});
