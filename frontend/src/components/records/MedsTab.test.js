/**
 * Editing one medicine on a saved prescription. The bug this protects: the old
 * form opened a saved medicine with its timing as blank boxes and rebuilt the
 * timing on save, so changing only the name turned "1-0-1" into "--".
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import MedsTab from './MedsTab';
import API from '../../api';

jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));

const RECORD = {
  id: 'r1', status: 'done', document_category: 'prescription',
  medicines: [
    { id: 'm1', name: 'Pan', dosage: null, frequency: 'SOS: take only when needed', duration: null },
    { id: 'm2', name: 'Rovat', dosage: '10mg', frequency: '1-0-1 after food', duration: '5 days' },
  ],
};

function setup() {
  API.put.mockImplementation((url, body) => Promise.resolve({ data: { ...RECORD, medicines: body.medicines } }));
  const props = { record: RECORD, profileId: 'p1', setRecords: jest.fn(), showRecord: jest.fn(), showToast: jest.fn() };
  render(<MedsTab {...props} />);
  return props;
}

beforeEach(() => jest.clearAllMocks());

test('editing opens with what is saved, in the same four fields', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rovat' }));
  expect(screen.getByLabelText('Medicine')).toHaveValue('Rovat');
  expect(screen.getByLabelText('Dose')).toHaveValue('10mg');
  expect(screen.getByLabelText('When')).toHaveValue('1-0-1 after food');
  expect(screen.getByLabelText('For how long')).toHaveValue('5 days');
});

test('changing only the name keeps the dose, timing and days exactly', async () => {
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rovat' }));
  fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Rovista 10' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

  const sent = API.put.mock.calls[0][1].medicines;
  expect(sent).toEqual([
    { name: 'Pan', dosage: '', frequency: 'SOS: take only when needed', duration: '' },
    { name: 'Rovista 10', dosage: '10mg', frequency: '1-0-1 after food', duration: '5 days' },
  ]);
  expect(props.showToast).toHaveBeenCalledWith('Medicines updated');
});

test('a medicine with SOS timing keeps it when its dose is added', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Pan' }));
  fireEvent.change(screen.getByLabelText('Dose'), { target: { value: '40 mg' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
  expect(API.put.mock.calls[0][1].medicines[0]).toEqual({ name: 'Pan', dosage: '40 mg', frequency: 'SOS: take only when needed', duration: '' });
});

test('removing asks once, then saves the list without it', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rovat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove Rovat?' })); });
  expect(API.put.mock.calls[0][1].medicines.map(m => m.name)).toEqual(['Pan']);
});
