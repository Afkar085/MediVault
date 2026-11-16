/**
 * The demo, driven through the real API client: no mocks, and no network,
 * because the demo answers every request from data bundled with the app.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App';
import { demoAdapter, setDemo } from './demo';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => setDemo(false));

const bar = () => screen.getByRole('navigation', { name: /main/i });

test('Try the demo opens a sample family with no account and no server', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));

  expect(await screen.findByText(/, Asha$/)).toBeInTheDocument();
  expect(await screen.findByText(/sample family/i)).toBeInTheDocument();
  expect((await screen.findAllByText(/Leela Menon/)).length).toBeGreaterThan(0);
});

test('the bar has Summary where Family was, and family lives in Profile', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));
  await screen.findByText(/, Asha$/);

  expect(within(bar()).queryByRole('button', { name: /family/i })).toBeNull();

  fireEvent.click(within(bar()).getByRole('button', { name: /summary/i }));
  expect(await screen.findByRole('heading', { name: /taking now/i })).toBeInTheDocument();
  expect(await screen.findByText('Naproxen 250 mg')).toBeInTheDocument();

  fireEvent.click(within(bar()).getByRole('button', { name: /profile/i }));
  expect(await screen.findByRole('heading', { name: /^family$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add a family member/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /edit amma/i })).toBeInTheDocument();
});

test('the demo cannot be written to, and says why', async () => {
  await expect(demoAdapter({ method: 'post', url: '/upload/demo-asha' }))
    .rejects.toMatchObject({ response: { status: 403, data: { detail: expect.stringMatching(/read only/i) } } });
  await expect(demoAdapter({ method: 'delete', url: '/profiles/demo-asha/records/d1' }))
    .rejects.toMatchObject({ response: { status: 403 } });
});

test('each sample person only gets their own records', async () => {
  const asha = await demoAdapter({ method: 'get', url: '/profiles/demo-asha/records' });
  const ravi = await demoAdapter({ method: 'get', url: '/profiles/demo-ravi/records' });
  expect(asha.data.every(r => r.profile_id === 'demo-asha')).toBe(true);
  expect(ravi.data.every(r => r.profile_id === 'demo-ravi')).toBe(true);
  expect(asha.data.length).toBeGreaterThan(ravi.data.length);
});
