/**
 * The review card: check what was read, straight after it was read.
 *
 * The cases these protect: a document finishes reading and the card opens by
 * itself; each medicine shows whether it is a real one; a typo is one tap to
 * fix; Save writes the fixes and marks the record checked; closing without Save
 * leaves it under "to check" on Home, and that row opens the card again.
 */
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';
import { isUnchecked, needsReview } from '../../utils/format';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };

const READ = {
  id: 'r-new', profile_id: 'p-alice', status: 'done', checked_at: null,
  document_category: 'prescription', document_type: 'Prescription',
  doctor_name: 'Dr. Anusha Shetty', hospital_name: 'City Clinic', diagnosis: 'Acidity',
  document_date: '2026-11-17', created_at: '2026-11-17T10:00:00Z', files: [],
  medicines: [
    { id: 'm1', name: 'Azee 500', dosage: '500 mg', frequency: '1-0-0', duration: '3 days' },
    { id: 'm2', name: 'Pantocd 40', dosage: '40 mg', frequency: '1-0-0', duration: '5 days' },
    { id: 'm3', name: 'Shelcal 500', dosage: '', frequency: '0-0-1', duration: '30 days' },
  ],
};
const CHECKED_OLD = { ...READ, id: 'r-old', checked_at: '2026-11-01T10:00:00Z', medicines: [], document_date: '2026-11-01' };

const CHECK = {
  'Azee 500': { status: 'green', matched: 'Azee', suggestions: [] },
  'Pantocd 40': { status: 'amber', suggestions: [{ name: 'Pantocid', generic: 'Pantoprazole (40mg)', score: 0.55, distance: 1 }] },
  'Pantocid': { status: 'green', matched: 'Pantocid', suggestions: [] },
  'Shelcal 500': { status: 'red', suggestions: [] },
};

function mockApi(records) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: records() });
    if (url === '/profiles/p-alice/records/status') return Promise.resolve({ data: records().map(r => ({ id: r.id, status: r.status })) });
    if (url.endsWith('/history')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
  API.post.mockImplementation((url, body) => {
    if (url === '/medicines/check') {
      return Promise.resolve({ data: { results: body.names.map(n => ({ name: n, ...(CHECK[n] || { status: 'red', suggestions: [] }) })) } });
    }
    if (url === '/medicines/confirm') return Promise.resolve({ data: { saved: true } });
    return Promise.resolve({ data: {} });
  });
  API.put.mockImplementation((url, patch) => Promise.resolve({ data: { ...READ, ...patch, checked_at: patch.checked ? '2026-11-18T05:00:00Z' : null } }));
}

async function start(records) {
  mockApi(typeof records === 'function' ? records : () => records);
  render(<App />);
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
  window.history.replaceState(null, '');
});
afterEach(() => { localStorage.clear(); jest.useRealTimers(); });

test('a record is unchecked only when it carries checked_at and it is empty', () => {
  expect(isUnchecked(READ)).toBe(true);
  expect(isUnchecked(CHECKED_OLD)).toBe(false);
  // Before migration 010, and in the demo, there is no checked_at at all.
  const { checked_at, ...noColumn } = READ;
  expect(isUnchecked(noColumn)).toBe(false);
  expect(isUnchecked({ ...READ, status: 'processing' })).toBe(false);
  expect(needsReview(READ)).toBe(true);
});

test('the card opens by itself when a document finishes reading', async () => {
  jest.useFakeTimers();
  let reading = true;
  await start(() => [reading ? { ...READ, status: 'processing', medicines: [] } : READ, CHECKED_OLD]);
  expect(screen.queryByRole('dialog', { name: 'Check what was read' })).toBeNull();

  reading = false;
  await act(async () => { jest.advanceTimersByTime(4100); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });

  expect(await screen.findByRole('dialog', { name: 'Check what was read' })).toBeInTheDocument();
});

test('each medicine shows whether it is in the list, and a typo is one tap to fix', async () => {
  await start([READ]);
  fireEvent.click(await screen.findByRole('button', { name: 'Check' }));
  const card = await screen.findByRole('dialog', { name: 'Check what was read' });

  await waitFor(() => expect(within(card).getAllByRole('img', { name: 'In the medicine list' })).toHaveLength(1));
  expect(within(card).getByRole('img', { name: 'Close to a medicine in the list' })).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: 'Not in the medicine list' })).toBeInTheDocument();
  expect(within(card).getByText('1 to check · 1 not in the list')).toBeInTheDocument();

  fireEvent.click(within(card).getByRole('button', { name: 'Pantocid' }));
  await waitFor(() => expect(within(card).getAllByRole('img', { name: 'In the medicine list' })).toHaveLength(2));
  expect(within(card).queryByText('Pantocd 40')).toBeNull();
});

test('save writes the fixes, marks it checked, and remembers names you vouched for', async () => {
  await start([READ]);
  fireEvent.click(await screen.findByRole('button', { name: 'Check' }));
  const card = await screen.findByRole('dialog', { name: 'Check what was read' });
  await waitFor(() => within(card).getByRole('button', { name: 'Pantocid' }));

  // Fix the doctor in place.
  fireEvent.click(within(card).getByRole('button', { name: /Dr\. Anusha Shetty/ }));
  fireEvent.change(within(card).getByRole('textbox', { name: 'Doctor' }), { target: { value: 'Dr. Anusha S Shetty' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Done' }));
  // Take the suggestion, and vouch for the red one.
  fireEvent.click(within(card).getByRole('button', { name: 'Pantocid' }));
  fireEvent.click(within(card).getByRole('button', { name: 'It’s right' }));

  await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Save' })); });

  expect(API.put).toHaveBeenCalledTimes(1);
  const [url, patch] = API.put.mock.calls[0];
  expect(url).toBe('/profiles/p-alice/records/r-new');
  expect(patch.checked).toBe(true);
  expect(patch.doctor_name).toBe('Dr. Anusha S Shetty');
  expect(patch).not.toHaveProperty('hospital_name');   // unchanged fields are not sent
  expect(patch.medicines.map(m => m.name)).toEqual(['Azee 500', 'Pantocid', 'Shelcal 500']);
  expect(API.post).toHaveBeenCalledWith('/medicines/confirm', { name: 'Shelcal 500' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Check what was read' })).toBeNull());
});

test('saving with nothing changed still marks it checked', async () => {
  await start([READ]);
  fireEvent.click(await screen.findByRole('button', { name: 'Check' }));
  const card = await screen.findByRole('dialog', { name: 'Check what was read' });
  await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Save' })); });
  expect(API.put.mock.calls[0][1]).toEqual({ checked: true });
});

test('closing without saving changes nothing and it waits under "to check" on Home', async () => {
  await start([READ, CHECKED_OLD]);
  expect(await screen.findByText('1 new document to check')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  const card = await screen.findByRole('dialog', { name: 'Check what was read' });
  fireEvent.click(within(card).getByRole('button', { name: 'Close without saving' }));

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Check what was read' })).toBeNull());
  expect(API.put).not.toHaveBeenCalled();
  expect(screen.getByText('1 new document to check')).toBeInTheDocument();
});

test('the list still works when the medicine check cannot be reached', async () => {
  await start([READ]);
  API.post.mockImplementation(() => Promise.reject(new Error('offline')));
  fireEvent.click(await screen.findByRole('button', { name: 'Check' }));
  const card = await screen.findByRole('dialog', { name: 'Check what was read' });
  await waitFor(() => expect(within(card).getAllByRole('img', { name: 'Not checked against the list' })).toHaveLength(3));
  expect(within(card).getByRole('button', { name: 'Save' })).toBeEnabled();
});
