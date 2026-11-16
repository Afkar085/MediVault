/**
 * Adding a document to a visit that already exists.
 *
 * The case these protect: a prescription goes in today, the pharmacy bill
 * tomorrow. The bill names no doctor, so nothing read from the page can tie it
 * to the prescription. The person's tap has to.
 */
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';
import { recentVisits, visitOf } from '../../utils/format';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ALICE = { id: 'p-alice', name: 'Alice', relationship: 'Self' };
const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'bill.png', { type: 'image/png', lastModified: 1 });

const PRESCRIPTION = {
  id: 'r-presc', profile_id: 'p-alice', status: 'done',
  document_category: 'prescription', document_type: 'Prescription',
  doctor_name: 'DR. SHREYA', hospital_name: 'TMA Pai Hospital',
  document_date: '2026-11-07', created_at: '2026-11-07T10:00:00Z',
  medicines: [], files: [],
};
const BILL_SAME_VISIT = {
  ...PRESCRIPTION, id: 'r-bill', document_category: 'bill', document_type: 'Bill',
  bill_title: 'Radha Medicals', bill_amount: 1300,
};
const OLDER = {
  ...PRESCRIPTION, id: 'r-old', doctor_name: 'Kabir', document_date: '2026-10-20', created_at: '2026-10-20T10:00:00Z',
};

global.URL.createObjectURL = jest.fn(() => 'blob:preview');
global.URL.revokeObjectURL = jest.fn();

async function start(records) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: records });
    if (url.endsWith('/history')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: records.find(r => url.endsWith(r.id)) || {} });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});
afterEach(() => localStorage.clear());

test('a visit is one doctor on one day, however the name is written', () => {
  expect(visitOf(PRESCRIPTION)).toMatchObject({ doctorKey: 'shreya', date: '2026-11-07' });
  expect(visitOf({ ...PRESCRIPTION, doctor_name: null })).toBeNull();
  const visits = recentVisits([OLDER, PRESCRIPTION, BILL_SAME_VISIT]);
  expect(visits.map(v => v.id)).toEqual(['shreya|2026-11-07', 'kabir|2026-10-20']);
});

test('a bill added from an open prescription is sent with that visit’s doctor and date', async () => {
  API.post.mockResolvedValue({ data: { record_id: 'r-new', status: 'processing', duplicate: false } });
  await start([PRESCRIPTION]);
  fireEvent.click(await screen.findByRole('button', { name: /^prescription,/i }));
  const record = await screen.findByRole('dialog', { name: /record/i });

  fireEvent.click(within(record).getByRole('button', { name: /add a bill or report/i }));
  const sheet = await screen.findByRole('dialog', { name: /add to this visit/i });

  // The visit is already picked, the type is already Bill, and there is
  // nothing to type.
  expect(within(sheet).getByRole('button', { name: /shreya/i })).toHaveAttribute('aria-pressed', 'true');
  expect(within(sheet).queryByLabelText(/^date/i)).toBeNull();

  fireEvent.change(document.querySelector('[data-testid=add-files]'), { target: { files: [png()] } });
  fireEvent.click(within(sheet).getByRole('button', { name: /save bill/i }));

  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  const [url, body] = API.post.mock.calls[0];
  expect(url).toBe('/upload/p-alice');
  expect(body.get('document_category')).toBe('bill');
  expect(body.get('doctor_name')).toBe('DR. SHREYA');
  expect(body.get('document_date')).toBe('2026-11-07');
});

test('the + button offers recent visits, and New visit brings the fields back', async () => {
  API.post.mockResolvedValue({ data: { record_id: 'r-new', status: 'processing', duplicate: false } });
  await start([PRESCRIPTION, OLDER]);
  fireEvent.click(document.querySelector('.tab-add'));
  const sheet = await screen.findByRole('dialog', { name: /add a document/i });

  // Nothing is assumed: a plain add starts as a new visit.
  expect(within(sheet).getByRole('button', { name: /new visit/i })).toHaveAttribute('aria-pressed', 'true');
  expect(within(sheet).getByLabelText(/^date/i)).toBeInTheDocument();

  fireEvent.click(within(sheet).getByRole('button', { name: /kabir/i }));
  expect(within(sheet).queryByLabelText(/^date/i)).toBeNull();

  fireEvent.change(document.querySelector('[data-testid=add-files]'), { target: { files: [png()] } });
  fireEvent.click(within(sheet).getByRole('button', { name: /save prescription/i }));
  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  const body = API.post.mock.calls[0][1];
  expect(body.get('doctor_name')).toBe('Kabir');
  expect(body.get('document_date')).toBe('2026-10-20');
});

test('a bill can name who prescribed it when it starts a new visit', async () => {
  await start([]);
  fireEvent.click(document.querySelector('.tab-add'));
  const sheet = await screen.findByRole('dialog', { name: /add a document/i });
  fireEvent.click(within(sheet).getByRole('button', { name: /^bill$/i }));
  expect(within(sheet).getByLabelText(/prescribed by/i)).toBeInTheDocument();
});

test('an open document shows what else came from the same visit and opens it', async () => {
  await start([PRESCRIPTION, BILL_SAME_VISIT, OLDER]);
  fireEvent.click(await screen.findByRole('button', { name: /^prescription, dr\. shreya/i }));
  const record = await screen.findByRole('dialog', { name: /record/i });

  const strip = within(record).getByRole('region', { name: /this visit/i });
  const bill = within(strip).getByRole('button', { name: /bill · ₹1,300/i });
  // The other doctor's prescription is a different visit and is not offered.
  expect(within(strip).getAllByRole('button')).toHaveLength(2);

  fireEvent.click(bill);
  expect(await screen.findByRole('dialog', { name: /record: radha medicals/i })).toBeInTheDocument();
});
