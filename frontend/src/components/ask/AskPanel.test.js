import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };

const RECORD = {
  id: 'r-1',
  profile_id: 'p-alice',
  status: 'done',
  document_category: 'prescription',
  doctor_name: 'Kumar',
  document_date: '2026-06-14',
  created_at: '2026-06-14T00:00:00Z',
  medicines: [],
  files: [],
};

const ANSWER = {
  answer: 'Paracetamol 650mg twice daily for five days [Record 1].',
  sources: [{ ref: 1, record_id: 'r-1', date: '2026-06-14', doctor_name: 'Kumar' }],
};

async function openAsk(recordList = [RECORD]) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: recordList });
    return Promise.resolve({ data: [] });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));
  fireEvent.click(screen.getByRole('tab', { name: /ask/i }));
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});

afterEach(() => localStorage.clear());

test('a suggested question is answered from the record it cites', async () => {
  API.post.mockResolvedValue({ data: ANSWER });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /what medicines was i prescribed/i }));

  expect(API.post).toHaveBeenCalledWith('/profiles/p-alice/ask', {
    question: 'What medicines was I prescribed recently?',
  });
  expect(await screen.findByText(/paracetamol 650mg twice daily/i)).toBeInTheDocument();
  expect(screen.getByText('Based on these records')).toBeInTheDocument();
});

test('a citation opens the record it came from', async () => {
  API.post.mockResolvedValue({ data: ANSWER });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /which doctors have treated me/i }));
  const source = await screen.findByRole('button', { name: /open source record: dr\. kumar/i });
  fireEvent.click(source);

  await waitFor(() => expect(document.querySelector('.modal')).toBeTruthy());
});

test('a typed question is sent, and the answer is scoped to the selected member', async () => {
  API.post.mockResolvedValue({ data: ANSWER });
  await openAsk();

  fireEvent.change(screen.getByRole('textbox', { name: /ask a question/i }), {
    target: { value: 'what did the ortho say' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^Ask$/ }));

  expect(API.post).toHaveBeenCalledWith('/profiles/p-alice/ask', { question: 'what did the ortho say' });
  expect(await screen.findByText(/only from alice’s uploaded documents/i)).toBeInTheDocument();
});

test('a failure offers a retry rather than a blank answer', async () => {
  API.post.mockRejectedValue({ response: { status: 500 } });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /when was my last blood test/i }));

  expect(await screen.findByText(/couldn't get an answer right now/i)).toBeInTheDocument();
  API.post.mockResolvedValue({ data: ANSWER });
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  expect(await screen.findByText(/paracetamol 650mg/i)).toBeInTheDocument();
});

test('rate limiting is explained in plain language', async () => {
  API.post.mockRejectedValue({ response: { status: 429 } });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /which doctors have treated me/i }));

  expect(await screen.findByText(/give it a minute/i)).toBeInTheDocument();
});

test('with no records, it says so instead of offering questions it cannot answer', async () => {
  await openAsk([]);

  expect(screen.getByText(/nothing to ask about yet/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /when was my last blood test/i })).not.toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
});
