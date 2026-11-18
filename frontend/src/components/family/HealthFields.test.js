/**
 * Health details on a family member: asked when adding or editing, all
 * optional, shown first on the summary (allergies in red), and medicines
 * taken every day listed under Taking now.
 */
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import API from '../../api';
import { healthPayload } from './HealthFields';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const ABBA = {
  id: 'p-abba', name: 'Abba Kolkar', relationship: 'Father',
  allergies: ['Penicillin'], conditions: ['Sugar (diabetes)', 'BP'], blood_group: 'B+',
  long_term_medicines: [{ name: 'Glycomet GP 1', frequency: '1-0-1', for_what: 'sugar' }],
};
const RX = {
  id: 'r1', profile_id: 'p-abba', status: 'done', document_category: 'prescription',
  doctor_name: 'Dr. Rao', document_date: '2026-11-17', created_at: '2026-11-17T10:00:00Z', medicines: [], files: [],
};

async function start(profiles, records = [RX]) {
  API.get.mockImplementation((url) => {
    if (url === '/profiles') return Promise.resolve({ data: profiles });
    if (url.endsWith('/records')) return Promise.resolve({ data: records });
    return Promise.resolve({ data: [] });
  });
  render(<App />);
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => { localStorage.setItem('token', 'test-token'); jest.clearAllMocks(); window.history.replaceState(null, ''); });
afterEach(() => localStorage.clear());

test('the body leaves out blank medicines, and blood group unless it was offered', () => {
  const body = healthPayload({
    allergies: ['Sulfa'], conditions: [], blood_group: 'O+',
    long_term_medicines: [{ name: ' Telma 40 ', dosage: '', frequency: '1-0-0', for_what: '' }, { name: ' ', dosage: '', frequency: '', for_what: '' }],
  }, false);
  expect(body).toEqual({ allergies: ['Sulfa'], conditions: [], long_term_medicines: [{ name: 'Telma 40', frequency: '1-0-0' }] });
  expect(healthPayload({ allergies: [], conditions: [], long_term_medicines: [], blood_group: 'O+' }, true).blood_group).toBe('O+');
});

test('adding a member asks for health details, all optional, and sends them', async () => {
  await start([ABBA]);
  API.post.mockResolvedValue({ data: { id: 'p-amma', name: 'Amma', relationship: 'Mother', allergies: ['Peanuts'], conditions: ['Thyroid'], long_term_medicines: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  fireEvent.click(await screen.findByRole('button', { name: /Add a family member/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Add family member' });
  // No birthday, and no blood group on the first step.
  expect(within(dialog).queryByText(/birth/i)).toBeNull();
  expect(within(dialog).queryByText('Blood group')).toBeNull();

  fireEvent.change(within(dialog).getByPlaceholderText('Full name'), { target: { value: 'Amma' } });
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Mother' } });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Add an allergy' }), { target: { value: 'Peanuts' } });
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add' })[0]);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Thyroid' }));
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })); });

  expect(API.post).toHaveBeenCalledWith('/profiles', expect.objectContaining({
    name: 'Amma', relationship: 'Mother', allergies: ['Peanuts'], conditions: ['Thyroid'], long_term_medicines: [],
  }));
});

test('adding a member with no health details sends none, so it works before the migration', async () => {
  await start([ABBA]);
  API.post.mockResolvedValue({ data: { id: 'p-x', name: 'Ravi', relationship: 'Son' } });
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  fireEvent.click(await screen.findByRole('button', { name: /Add a family member/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Add family member' });
  fireEvent.change(within(dialog).getByPlaceholderText('Full name'), { target: { value: 'Ravi' } });
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Son' } });
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })); });
  expect(API.post).toHaveBeenCalledWith('/profiles', { name: 'Ravi', relationship: 'Son' });
});

test('the summary shows allergies first, conditions, and daily medicines under Taking now', async () => {
  await start([ABBA]);
  fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
  const allergy = await screen.findByRole('region', { name: 'Allergies' });
  expect(within(allergy).getByText('Penicillin')).toBeInTheDocument();
  expect(screen.getByText('Sugar (diabetes)')).toBeInTheDocument();
  expect(screen.getByText('Blood group B+')).toBeInTheDocument();
  const now = screen.getByRole('region', { name: 'Taking now' });
  expect(within(now).getByText('Glycomet GP 1')).toBeInTheDocument();
  expect(within(now).getByText('1-0-1 · every day · for sugar')).toBeInTheDocument();
  // The order a doctor reads: allergies before anything else.
  const regions = screen.getAllByRole('region').map(r => r.getAttribute('aria-labelledby'));
  expect(regions.indexOf('sum-allergy')).toBeLessThan(regions.indexOf('sum-now'));
});

test('the top bar shows the whole name, not just the first word', async () => {
  await start([ABBA]);
  expect(screen.getAllByText('Abba Kolkar').length).toBeGreaterThan(0);
});
