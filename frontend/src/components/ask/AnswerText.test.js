import { render, screen, fireEvent } from '@testing-library/react';
import AnswerText from './AnswerText';

const SOURCES = [
  { ref: 1, record_id: 'r-1', doctor_name: 'Patel' },
  { ref: 2, record_id: 'r-2', doctor_name: 'Kumar' },
];

// The bug this component exists for: the model's markup reaching the screen
// as literal punctuation. Asserted globally rather than per-case so any new
// syntax the model starts emitting has to be handled, not just rendered raw.
const expectNoRawMarkup = (container) => {
  expect(container.textContent).not.toMatch(/\*/);
  expect(container.textContent).not.toMatch(/\[Record/i);
};

test('emphasis renders as bold text, not asterisks', () => {
  const { container } = render(<AnswerText text="**Amlodipine** was started after the cardiology visit." />);

  const bold = screen.getByText('Amlodipine');
  expect(bold.tagName).toBe('STRONG');
  expect(container.textContent).toContain('Amlodipine was started after the cardiology visit.');
  expectNoRawMarkup(container);
});

test('every emphasised entity in one answer is highlighted', () => {
  const { container } = render(
    <AnswerText text="**Dr. Patel** diagnosed **Hypertension** and prescribed **Amlodipine**, with **HbA1c** checked." />,
  );

  ['Dr. Patel', 'Hypertension', 'Amlodipine', 'HbA1c'].forEach((entity) => {
    expect(screen.getByText(entity).tagName).toBe('STRONG');
  });
  expectNoRawMarkup(container);
});

test('a citation becomes a control that opens its source record', () => {
  const onOpenSource = jest.fn();
  const { container } = render(
    <AnswerText
      text="Paracetamol 650mg twice daily [Record 1]."
      sources={SOURCES}
      onOpenSource={onOpenSource}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /open source record 1/i }));
  expect(onOpenSource).toHaveBeenCalledWith(SOURCES[0]);
  expectNoRawMarkup(container);
});

test('a citation with no matching source is not clickable', () => {
  render(<AnswerText text="Seen last year [Record 7]." sources={SOURCES} onOpenSource={jest.fn()} />);

  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('bulleted answers render as a list without their markers', () => {
  const { container } = render(
    <AnswerText text={'Recent medicines:\n- **Amlodipine** for hypertension\n- **Amoxicillin** for sinusitis'} />,
  );

  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Amlodipine for hypertension');
  expectNoRawMarkup(container);
});

test('numbered answers render as list items too', () => {
  render(<AnswerText text={'1. First visit\n2. Second visit'} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('unclosed emphasis never leaks an asterisk onto the screen', () => {
  const { container } = render(<AnswerText text="Started **Amlodipine and then stopped." />);

  expect(container.textContent).toBe('Started Amlodipine and then stopped.');
  expectNoRawMarkup(container);
});

test('blank lines separate paragraphs instead of collapsing together', () => {
  const { container } = render(<AnswerText text={'First point.\n\nSecond point.'} />);

  expect(container.querySelectorAll('p')).toHaveLength(2);
});

test('an empty or missing answer renders nothing rather than crashing', () => {
  const { container } = render(<AnswerText text="" />);
  expect(container.textContent).toBe('');

  const { container: nullContainer } = render(<AnswerText text={null} />);
  expect(nullContainer.textContent).toBe('');
});
