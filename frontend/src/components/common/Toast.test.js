import { render, screen, act, fireEvent } from '@testing-library/react';
import Toast from './Toast';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });

test('a confirmation is announced politely', () => {
  render(<Toast msg="Uploaded" type="success" onDone={() => {}} />);
  const toast = screen.getByRole('status');
  expect(toast).toHaveTextContent('Uploaded');
  expect(toast).toHaveAttribute('aria-live', 'polite');
});

test('an error interrupts, because it needs acting on', () => {
  render(<Toast msg="Upload failed" type="error" onDone={() => {}} />);
  const toast = screen.getByRole('alert');
  expect(toast).toHaveAttribute('aria-live', 'assertive');
});

test('an error stays on screen long enough to read', () => {
  const onDone = jest.fn();
  render(
    <Toast
      msg="IMG_0042.HEIC: iPhone HEIC photos aren’t supported — save it as JPEG first"
      type="error"
      onDone={onDone}
    />,
  );

  advance(2800);            // when a confirmation would have gone
  expect(onDone).not.toHaveBeenCalled();

  advance(4200);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a confirmation still goes away quickly', () => {
  const onDone = jest.fn();
  render(<Toast msg="Saved" type="success" onDone={onDone} />);
  advance(2800);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('it can be dismissed without waiting', () => {
  const onDone = jest.fn();
  render(<Toast msg="Saved" type="success" onDone={onDone} />);
  fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a long message is not clipped to one line', () => {
  render(<Toast msg={'x'.repeat(200)} type="error" onDone={() => {}} />);
  expect(screen.getByRole('alert').className).not.toMatch(/nowrap/);
});

test('the timer restarts when a new message replaces the old one', () => {
  const onDone = jest.fn();
  const { rerender } = render(<Toast msg="First" type="success" onDone={onDone} />);
  advance(2000);
  rerender(<Toast msg="Second" type="success" onDone={onDone} />);
  advance(2000);
  expect(onDone).not.toHaveBeenCalled();   // the second message got its own time
  advance(800);
  expect(onDone).toHaveBeenCalledTimes(1);
});
