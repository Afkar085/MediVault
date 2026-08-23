import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
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

test('a family-wide question goes to the assistant that can resolve "Dad"', async () => {
  API.post.mockResolvedValue({
    data: {
      answer: 'Paracetamol 650mg for his knee [Record 1].',
      sources: [{ ref: 1, record_id: 'r-dad', date: '2026-06-14', doctor_name: 'Kumar', member: 'Abdul (Father)' }],
    },
  });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
  fireEvent.click(await screen.findByRole('button', { name: /what medicines was dad prescribed/i }));

  expect(API.post).toHaveBeenCalledWith('/ask', {
    question: 'What medicines was Dad prescribed for his knee?',
  });
  expect(await screen.findByText(/paracetamol 650mg for his knee/i)).toBeInTheDocument();
});

test('a family-wide citation says whose record it is', async () => {
  API.post.mockResolvedValue({
    data: {
      answer: 'On 14 June 2026.',
      sources: [{ ref: 1, record_id: 'r-dad', date: '2026-06-14', doctor_name: 'Kumar', member: 'Abdul (Father)' }],
    },
  });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
  fireEvent.click(await screen.findByRole('button', { name: /who in the family has seen an orthopedic/i }));

  expect(await screen.findByText(/Dr\. Kumar · Abdul \(Father\)/)).toBeInTheDocument();
});

test('switching back to one member stops asking the family endpoint', async () => {
  API.post.mockResolvedValue({ data: ANSWER });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
  fireEvent.click(screen.getByRole('button', { name: /^Alice$/ }));
  fireEvent.click(await screen.findByRole('button', { name: /when was my last blood test/i }));

  expect(API.post).toHaveBeenCalledWith('/profiles/p-alice/ask', {
    question: 'When was my last blood test?',
  });
});

test('a citation for another member is fetched and opened, not left dead', async () => {
  API.post.mockResolvedValue({
    data: {
      answer: 'Telmisartan 40mg [Record 1].',
      sources: [{
        ref: 1, record_id: 'r-dad', profile_id: 'p-dad',
        date: '2026-03-11', doctor_name: 'Shenoy', member: 'Abdul (Father)',
      }],
    },
  });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
  fireEvent.click(await screen.findByRole('button', { name: /what medicines was dad prescribed/i }));

  const citation = await screen.findByRole('button', { name: /open source record: dr\. shenoy/i });

  API.get.mockResolvedValue({
    data: { ...RECORD, id: 'r-dad', profile_id: 'p-dad', doctor_name: 'Shenoy' },
  });
  fireEvent.click(citation);

  await waitFor(() =>
    expect(API.get).toHaveBeenCalledWith('/profiles/p-dad/records/r-dad'),
  );
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
});

test('a citation already in the loaded records opens without a fetch', async () => {
  API.post.mockResolvedValue({ data: ANSWER });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /which doctors have treated me/i }));
  const citation = await screen.findByRole('button', { name: /open source record: dr\. kumar/i });

  const before = API.get.mock.calls.length;
  fireEvent.click(citation);

  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  expect(API.get.mock.calls.length).toBe(before);
});

test('the passage the answer came from is shown so it can be checked', async () => {
  API.post.mockResolvedValue({
    data: {
      answer: 'Your haemoglobin was 9.2 g/dL [Record 1].',
      sources: [{
        ref: 1, record_id: 'r-1', profile_id: 'p-alice', date: '2026-05-02',
        doctor_name: 'Bhat', excerpt: 'Haemoglobin 9.2 g/dL (13.0 - 17.0)',
      }],
    },
  });
  await openAsk();

  fireEvent.click(screen.getByRole('button', { name: /when was my last blood test/i }));

  expect(await screen.findByText(/Haemoglobin 9\.2 g\/dL \(13\.0 - 17\.0\)/)).toBeInTheDocument();
});
