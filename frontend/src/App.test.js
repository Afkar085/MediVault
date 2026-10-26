import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import API from './api';

jest.mock('./api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
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
  // The member chip opens the switcher in place.
  userEvent.click(await screen.findByRole('button', { name: /switch family member/i }));
  userEvent.click(await screen.findByRole('button', { name: /switch to bob's records/i }));
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

  // While a document is being read the app polls the narrow status endpoint,
  // not the full list (which signs a URL for every page).
  const recordCalls = () =>
    API.get.mock.calls.filter(([url]) => url === '/profiles/p-alice/records/status').length;

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

test('coming back to a member shows their records at once instead of a skeleton', async () => {
  // Switching members used to blank the screen and reload from scratch every
  // time, so going back and forth between two people meant watching the
  // loading skeleton again for a list the app already had.
  const bobRecords = deferred();
  let bobRequests = 0;

  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE, BOB] });
    if (url === '/profiles/p-alice/records') {
      return Promise.resolve({ data: [record('r-alice', 'Alice Doc')] });
    }
    if (url === '/profiles/p-bob/records') {
      bobRequests += 1;
      return bobRequests === 1
        ? Promise.resolve({ data: [record('r-bob', 'Bob Doc')] })
        : bobRecords.promise;  // the second visit's refresh never lands
    }
    return Promise.resolve({ data: [] });
  });

  const switchTo = async (name) => {
    userEvent.click(await screen.findByRole('button', { name: /switch family member/i }));
    userEvent.click(await screen.findByRole('button', { name: new RegExp(`switch to ${name}'s records`, 'i') }));
  };

  render(<App />);
  expect((await screen.findAllByText('Dr. Alice Doc')).length).toBeGreaterThan(0);

  await switchTo('bob');
  expect((await screen.findAllByText('Dr. Bob Doc')).length).toBeGreaterThan(0);

  await switchTo('alice');
  expect((await screen.findAllByText('Dr. Alice Doc')).length).toBeGreaterThan(0);

  // Back to Bob with his refresh still in flight: his records are on screen
  // straight away, and no skeleton is shown waiting for a list we have.
  await switchTo('bob');
  expect(screen.getAllByText('Dr. Bob Doc').length).toBeGreaterThan(0);
  expect(screen.queryByLabelText(/loading records/i)).not.toBeInTheDocument();

  // It is still refreshed in the background, so a change made elsewhere shows up.
  expect(bobRequests).toBe(2);
  await act(async () => {
    bobRecords.resolve({ data: [record('r-bob2', 'Bob Doc Two')] });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getAllByText('Dr. Bob Doc Two').length).toBeGreaterThan(0);
});
