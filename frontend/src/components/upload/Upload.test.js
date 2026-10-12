import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };
const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'rx.png', { type: 'image/png', lastModified: 1 });

global.URL.createObjectURL = jest.fn(() => 'blob:preview');
global.URL.revokeObjectURL = jest.fn();

async function openPreview() {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    return Promise.resolve({ data: [] });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(document.querySelector('.tab-add'));
  const input = document.querySelector('[data-testid=add-files]');
  fireEvent.change(input, { target: { files: [png()] } });
  return screen.findByRole('dialog', { name: /add a document/i });
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});
afterEach(() => localStorage.clear());

test('the type and date travel with the files in one request', async () => {
  API.post.mockResolvedValue({ data: { record_id: 'r-new', status: 'processing', duplicate: false } });
  await openPreview();
  fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-09-20' } });
  fireEvent.click(screen.getByRole('button', { name: /save prescription/i }));

  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  const [url, body] = API.post.mock.calls[0];
  expect(url).toBe('/upload/p-alice');
  expect(body.get('document_category')).toBe('prescription');
  expect(body.get('document_date')).toBe('2026-09-20');
  // No follow-up edit that the background reader could overwrite.
  expect(API.put).not.toHaveBeenCalled();
});

test('pressing save twice sends the upload once', async () => {
  let finish;
  API.post.mockReturnValue(new Promise((r) => { finish = r; }));
  await openPreview();
  const save = screen.getByRole('button', { name: /save prescription/i });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(API.post).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ data: { record_id: 'r', status: 'processing', duplicate: false } }); });
});

test('a document that is already saved is opened instead of duplicated', async () => {
  const existing = {
    id: 'r-old', profile_id: 'p-alice', status: 'done', document_category: 'prescription',
    doctor_name: 'Kumar', created_at: '2026-06-01T00:00:00Z', medicines: [], files: [],
  };
  API.post.mockResolvedValue({ data: { record_id: 'r-old', status: 'done', duplicate: true } });
  await openPreview();
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: [existing] });
    return Promise.resolve({ data: [] });
  });
  fireEvent.click(screen.getByRole('button', { name: /save prescription/i }));
  expect(await screen.findByText(/already saved/i)).toBeInTheDocument();
  expect(await screen.findByRole('dialog', { name: /record: dr\. kumar/i })).toBeInTheDocument();
});

test('a lost connection keeps the files and says retrying is safe', async () => {
  API.post.mockRejectedValue(new Error('Network Error'));
  await openPreview();
  fireEvent.click(screen.getByRole('button', { name: /save prescription/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/won’t be saved twice/i);
  expect(screen.getByRole('dialog', { name: /add a document/i })).toBeInTheDocument();
});

test('a document can be saved to another member’s file from the same sheet', async () => {
  const BOB = { id: 'p-bob', name: 'Bob', relationship: 'Father' };
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE, BOB] });
    return Promise.resolve({ data: [] });
  });
  API.post.mockResolvedValue({ data: { record_id: 'r-bob', status: 'processing', duplicate: false } });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(document.querySelector('.tab-add'));
  fireEvent.change(document.querySelector('[data-testid=add-files]'), { target: { files: [png()] } });
  const sheet = await screen.findByRole('dialog', { name: /add a document/i });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Bob' }));
  fireEvent.click(within(sheet).getByRole('button', { name: /save prescription/i }));
  await waitFor(() => expect(API.post).toHaveBeenCalledWith('/upload/p-bob', expect.anything(), expect.anything()));
  expect(await screen.findByText(/saved to bob’s file/i)).toBeInTheDocument();
});
