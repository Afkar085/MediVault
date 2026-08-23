import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };
const BOB = { id: 'p-bob', name: 'Bob', relationship: 'Father' };

const hit = {
  id: 'r-1',
  status: 'done',
  document_category: 'lab_report',
  doctor_name: 'Kumar',
  specialty: 'Orthopedic',
  created_at: '2026-06-04T00:00:00Z',
  medicines: [],
  profiles: { name: 'Bob', relationship: 'Father' },
};

const searchCalls = () => API.get.mock.calls.filter(([url]) => url === '/search');

async function openSearch() {
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
  return screen.getByRole('textbox', { name: /search medical records/i });
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
  jest.useFakeTimers();
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE, BOB] });
    if (url === '/search') return Promise.resolve({ data: [hit] });
    return Promise.resolve({ data: [] });
  });
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

test('a query is sent to the search endpoint, scoped to the selected member', async () => {
  const input = await openSearch();

  fireEvent.change(input, { target: { value: 'June 2026' } });
  await act(async () => { jest.advanceTimersByTime(400); });

  expect(searchCalls()).toHaveLength(1);
  expect(searchCalls()[0][1]).toEqual({ params: { q: 'June 2026', profile_id: 'p-alice' } });
  expect(await screen.findByText('Dr. Kumar')).toBeInTheDocument();
});

test('typing quickly issues one request, not one per keystroke', async () => {
  const input = await openSearch();

  for (const value of ['p', 'pa', 'par', 'para']) {
    fireEvent.change(input, { target: { value } });
    await act(async () => { jest.advanceTimersByTime(50); });
  }
  await act(async () => { jest.advanceTimersByTime(400); });

  expect(searchCalls()).toHaveLength(1);
  expect(searchCalls()[0][1].params.q).toBe('para');
});

test('searching everyone drops the member filter and labels whose record it is', async () => {
  const input = await openSearch();

  fireEvent.change(input, { target: { value: 'knee' } });
  await act(async () => { jest.advanceTimersByTime(400); });

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
  await act(async () => { jest.advanceTimersByTime(400); });

  const last = searchCalls().at(-1)[1].params;
  expect(last).toEqual({ q: 'knee' });
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

test('clearing the query stops searching and shows the suggestions again', async () => {
  const input = await openSearch();

  fireEvent.change(input, { target: { value: 'knee' } });
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(searchCalls()).toHaveLength(1);

  fireEvent.change(input, { target: { value: '' } });
  await act(async () => { jest.advanceTimersByTime(1000); });

  expect(searchCalls()).toHaveLength(1);
  expect(screen.getByText(/search your records/i)).toBeInTheDocument();
});

test('a search failure is reported instead of showing zero results', async () => {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/search') return Promise.reject(new Error('offline'));
    return Promise.resolve({ data: [] });
  });

  const input = await openSearch();
  fireEvent.change(input, { target: { value: 'knee' } });
  await act(async () => { jest.advanceTimersByTime(400); });

  expect(screen.getByText(/search is unavailable/i)).toBeInTheDocument();
  expect(screen.queryByText(/0 results/)).not.toBeInTheDocument();
});
