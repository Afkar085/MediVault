import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import API from './api';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };
const BOB = { id: 'p-bob', name: 'Bob', relationship: 'Father' };

const record = (id, doctor) => ({
  id,
  profile_id: id,
  status: 'done',
  document_category: 'prescription',
  doctor_name: doctor,
  created_at: '2026-01-01T00:00:00Z',
  medicines: [],
  files: [],
});

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});

afterEach(() => localStorage.clear());

test("a slow reply for the previous member never overwrites the current member's records", async () => {
  const aliceRecords = deferred();

  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE, BOB] });
    if (url === '/profiles/p-alice/records') return aliceRecords.promise;
    if (url === '/profiles/p-bob/records') {
      return Promise.resolve({ data: [record('r-bob', 'Bob Doc')] });
    }
    return Promise.resolve({ data: [] });
  });

  render(<App />);

  // Alice is selected first and her request is still in flight.
  await screen.findByText('Alice');

  // Switch to Bob before Alice's records come back.
  userEvent.click(screen.getByRole('button', { name: /switch family member/i }));
  userEvent.click(await screen.findByText('Bob'));
  expect((await screen.findAllByText('Dr. Bob Doc')).length).toBeGreaterThan(0);

  // Alice's request finally lands. It must be discarded.
  await act(async () => {
    aliceRecords.resolve({ data: [record('r-alice', 'Alice Doc')] });
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(screen.queryByText('Dr. Alice Doc')).not.toBeInTheDocument();
  expect(screen.getAllByText('Dr. Bob Doc').length).toBeGreaterThan(0);
});

test('a failed record load is reported instead of looking like an empty vault', async () => {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    return Promise.reject(new Error('network down'));
  });

  render(<App />);

  expect(await screen.findByText(/couldn't load these records/i)).toBeInTheDocument();
  expect(screen.queryByText(/no records yet/i)).not.toBeInTheDocument();
});

test('polling for a stuck upload stops instead of running for the whole session', async () => {
  jest.useFakeTimers();
  const stuck = { ...record('r-stuck', 'Some Doc'), status: 'processing' };

  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    return Promise.resolve({ data: [stuck] });
  });

  render(<App />);
  await act(async () => { await Promise.resolve(); });

  const recordCalls = () =>
    API.get.mock.calls.filter(([url]) => url === '/profiles/p-alice/records').length;

  // It polls while the document is still being read.
  const initial = recordCalls();
  await act(async () => { jest.advanceTimersByTime(4000 * 5); });
  expect(recordCalls()).toBeGreaterThan(initial);

  // Well past the point where the server has given up on the job, polling stops.
  await act(async () => { jest.advanceTimersByTime(15 * 60 * 1000); });
  const settled = recordCalls();
  await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000); });
  expect(recordCalls()).toBe(settled);

  jest.useRealTimers();
});
