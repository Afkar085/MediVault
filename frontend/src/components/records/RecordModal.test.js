/**
 * Characterisation tests for the record view.
 *
 * Written before splitting the file up, so the split can be shown to change
 * nothing. They describe behaviour a user can see, not internal structure.
 */
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

const PRESCRIPTION = {
  id: 'r-presc',
  profile_id: 'p-alice',
  status: 'done',
  document_category: 'prescription',
  document_type: 'Prescription',
  doctor_name: 'Kumar',
  hospital_name: 'Kasturba Medical College',
  specialty: 'Orthopedics',
  diagnosis: 'Osteoarthritis of the right knee',
  recommendations: 'Physiotherapy three times a week',
  document_date: '2026-06-14',
  created_at: '2026-06-14T00:00:00Z',
  medicines: [{ id: 'm1', name: 'Paracetamol', dosage: '650mg', frequency: 'Twice daily' }],
  files: [{ id: 'f1', record_id: 'r-presc', file_url: 'https://x/1.png', page_number: 1 }],
};

const BILL = {
  ...PRESCRIPTION,
  id: 'r-bill',
  document_category: 'bill',
  document_type: 'Bill',
  bill_title: 'Consultation and X-ray',
  bill_amount: 4820,
  medicines: [],
  files: [],
};

const FAILED = {
  ...PRESCRIPTION,
  id: 'r-failed',
  status: 'failed',
  doctor_name: null,
  diagnosis: null,
  medicines: [],
  files: [],
};

async function openRecord(record) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: [record] });
    if (url.endsWith('/history')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: { ...record, raw_ocr_text: 'Dr Kumar\nParacetamol 650mg BD' } });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(await screen.findByRole('button', { name: /prescription uploaded|bill added|couldn't read/i }));
  return screen.getByRole('dialog');
}

const modal = () => screen.getByRole('dialog');
const tab = (name) => within(modal()).getByRole('button', { name });

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.clearAllMocks();
});

afterEach(() => localStorage.clear());

// --- what the record shows ---------------------------------------------------

test('a prescription opens showing its details', async () => {
  await openRecord(PRESCRIPTION);
  expect(within(modal()).getByText('Dr. Kumar')).toBeInTheDocument();
  expect(within(modal()).getByText('Osteoarthritis of the right knee')).toBeInTheDocument();
  expect(within(modal()).getAllByText('14 Jun 2026').length).toBeGreaterThan(0);
});

test('a prescription offers a medicines tab; a bill does not', async () => {
  await openRecord(PRESCRIPTION);
  expect(within(modal()).getByText(/^Meds/)).toBeInTheDocument();
});

test('a bill shows its amount and title instead of medicines', async () => {
  await openRecord(BILL);
  expect(within(modal()).getAllByText('Consultation and X-ray').length).toBeGreaterThan(0);
  expect(within(modal()).queryByText(/^Meds/)).not.toBeInTheDocument();
});

test('a failed record explains itself in plain language', async () => {
  await openRecord(FAILED);
  expect(within(modal()).getByText(/couldn’t read this document/i)).toBeInTheDocument();
  expect(within(modal()).getByText('unreadable')).toBeInTheDocument();
});

// --- tabs --------------------------------------------------------------------

test('the medicines tab lists what was prescribed', async () => {
  await openRecord(PRESCRIPTION);
  fireEvent.click(tab(/^Meds/));
  expect(within(modal()).getByText('Paracetamol')).toBeInTheDocument();
});

test('the documents tab fetches the scanned text only when opened', async () => {
  await openRecord(PRESCRIPTION);
  const before = API.get.mock.calls.filter(([u]) => u === '/profiles/p-alice/records/r-presc').length;
  expect(before).toBe(0);

  fireEvent.click(tab(/^Docs/));

  await waitFor(() =>
    expect(within(modal()).getByText(/Paracetamol 650mg BD/)).toBeInTheDocument(),
  );
});

test('the history tab loads the edit trail only when opened', async () => {
  await openRecord(PRESCRIPTION);
  expect(API.get.mock.calls.some(([u]) => u.endsWith('/history'))).toBe(false);

  fireEvent.click(tab(/^History/i));

  await waitFor(() =>
    expect(API.get.mock.calls.some(([u]) => u.endsWith('/history'))).toBe(true),
  );
});

// --- editing -----------------------------------------------------------------

test('editing details saves the changed fields', async () => {
  API.put.mockResolvedValue({ data: { ...PRESCRIPTION, diagnosis: 'Knee sprain' } });
  await openRecord(PRESCRIPTION);

  fireEvent.click(within(modal()).getByRole('button', { name: /edit details/i }));
  const diagnosis = within(modal()).getByDisplayValue('Osteoarthritis of the right knee');
  fireEvent.change(diagnosis, { target: { value: 'Knee sprain' } });
  fireEvent.click(within(modal()).getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(API.put).toHaveBeenCalled());
  const [url, payload] = API.put.mock.calls.at(-1);
  expect(url).toBe('/profiles/p-alice/records/r-presc');
  expect(payload.diagnosis).toBe('Knee sprain');
});

test('cancelling an edit leaves the record alone', async () => {
  await openRecord(PRESCRIPTION);
  fireEvent.click(within(modal()).getByRole('button', { name: /edit details/i }));
  fireEvent.click(within(modal()).getByRole('button', { name: /^cancel$/i }));

  expect(API.put).not.toHaveBeenCalled();
  expect(within(modal()).getByText('Osteoarthritis of the right knee')).toBeInTheDocument();
});

test('a failed record cannot be edited', async () => {
  await openRecord(FAILED);
  expect(within(modal()).queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument();
});

test('changing the date from the details view saves immediately', async () => {
  API.put.mockResolvedValue({ data: { ...PRESCRIPTION, document_date: '2026-07-01' } });
  await openRecord(PRESCRIPTION);

  const dateInput = modal().querySelector('input[type=date]');
  fireEvent.change(dateInput, { target: { value: '2026-07-01' } });

  await waitFor(() =>
    expect(API.put).toHaveBeenCalledWith(
      '/profiles/p-alice/records/r-presc',
      { document_date: '2026-07-01' },
    ),
  );
});

// --- deleting ----------------------------------------------------------------

test('deleting asks first, then deletes', async () => {
  API.delete.mockResolvedValue({ data: {} });
  await openRecord(PRESCRIPTION);

  fireEvent.click(within(modal()).getByRole('button', { name: /^delete$/i }));
  expect(screen.getByText(/delete record\?/i)).toBeInTheDocument();
  expect(API.delete).not.toHaveBeenCalled();

  const confirmBox = document.querySelector('.confirm-box');
  fireEvent.click(within(confirmBox).getByRole('button', { name: /^delete$/i }));
  await waitFor(() =>
    expect(API.delete).toHaveBeenCalledWith('/profiles/p-alice/records/r-presc'),
  );
});

// --- a record reached from a family-wide search ------------------------------

test('a record belonging to another member is edited against its own profile', async () => {
  API.put.mockResolvedValue({ data: PRESCRIPTION });
  await openRecord({ ...PRESCRIPTION, profile_id: 'p-dad' });

  const dateInput = modal().querySelector('input[type=date]');
  fireEvent.change(dateInput, { target: { value: '2026-07-01' } });

  await waitFor(() => expect(API.put).toHaveBeenCalled());
  expect(API.put.mock.calls.at(-1)[0]).toBe('/profiles/p-dad/records/r-presc');
});

// --- dialog behaviour --------------------------------------------------------

test('Escape closes the record', async () => {
  await openRecord(PRESCRIPTION);
  fireEvent.keyDown(modal(), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('opening a record moves focus into it', async () => {
  await openRecord(PRESCRIPTION);
  expect(modal().contains(document.activeElement)).toBe(true);
});

test('closing a record returns focus to the row it was opened from', async () => {
  // A real click focuses the element; jsdom fireEvent does not, so do it here.
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: [ALICE] });
    if (url === '/profiles/p-alice/records') return Promise.resolve({ data: [PRESCRIPTION] });
    return Promise.resolve({ data: PRESCRIPTION });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });

  const opener = await screen.findByRole('button', { name: /prescription uploaded/i });
  opener.focus();
  fireEvent.click(opener);

  await screen.findByRole('dialog');
  fireEvent.keyDown(modal(), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  expect(document.activeElement).toBe(screen.getByRole('button', { name: /prescription uploaded/i }));
});

test('Tab cannot walk out of the dialog into the page behind it', async () => {
  await openRecord(PRESCRIPTION);
  const dialog = modal();
  const focusable = [...dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  focusable[focusable.length - 1].focus();
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(dialog.contains(document.activeElement)).toBe(true);
});

test('the delete confirmation is its own dialog', async () => {
  await openRecord(PRESCRIPTION);
  fireEvent.click(within(modal()).getByRole('button', { name: /^delete$/i }));
  expect(screen.getByRole('dialog', { name: /delete record/i })).toBeInTheDocument();
});

test('deleting shows progress and cannot be triggered twice', async () => {
  let resolveDelete;
  API.delete.mockReturnValue(new Promise((r) => { resolveDelete = r; }));
  await openRecord(PRESCRIPTION);

  fireEvent.click(within(modal()).getByRole('button', { name: /^delete$/i }));
  const confirm = screen.getByRole('dialog', { name: /delete record/i });
  const deleteButton = within(confirm).getByRole('button', { name: /^delete$/i });

  fireEvent.click(deleteButton);
  await waitFor(() =>
    expect(within(confirm).getByRole('button', { name: /deleting/i })).toBeDisabled(),
  );

  fireEvent.click(within(confirm).getByRole('button', { name: /deleting/i }));
  expect(API.delete).toHaveBeenCalledTimes(1);

  resolveDelete({ data: {} });
});

test('a failed delete explains itself and lets you try again', async () => {
  API.delete.mockRejectedValue(new Error('offline'));
  await openRecord(PRESCRIPTION);

  fireEvent.click(within(modal()).getByRole('button', { name: /^delete$/i }));
  const confirm = screen.getByRole('dialog', { name: /delete record/i });
  fireEvent.click(within(confirm).getByRole('button', { name: /^delete$/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not delete this record/i);
  await waitFor(() =>
    expect(within(confirm).getByRole('button', { name: /^delete$/i })).not.toBeDisabled(),
  );
});
