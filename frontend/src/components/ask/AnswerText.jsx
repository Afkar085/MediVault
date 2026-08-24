/**
 * Renders an AI answer's light markdown as real UI.
 *
 * The model writes prose but still marks up the things that matter — medicine
 * names, doctors, diagnoses, values — as **emphasis**, and cites its sources
 * as [Record 1]. The answer used to be dropped into the DOM as a raw string,
 * so those asterisks and brackets appeared on screen literally.
 *
 * This is a small hand-written parser rather than a markdown library on
 * purpose: the input is one short answer using a tiny, known subset of the
 * syntax, and building React elements directly means no dangerouslySetInnerHTML
 * and so no HTML-injection surface for text that came back from a model.
 */

const LIST_MARKER = /^\s*(?:[-•*]\s+|\d+[.)]\s+)/;
const HEADING = /^\s*#{1,6}\s+/;

// Ordered alternation: the ** branch is tried before the single-* one, so
// bold is never mistaken for two italics.
const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+?)\*|\[Record\s*(\d+)\]/gi;

// Anything left over is unclosed/malformed markup. Strip it: a literal
// asterisk on screen is the exact bug this component exists to prevent.
const stripStrays = (s) => s.replace(/\*\*|__/g, '');

function renderInline(text, keyBase, sourceFor, onOpenSource) {
  const out = [];
  let last = 0;
  let match;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(stripStrays(text.slice(last, match.index)));
    const [full, boldStar, boldScore, italic, citeRef] = match;

    if (boldStar || boldScore) {
      out.push(
        <strong key={keyBase + 'b' + match.index} className="ask-em">
          {boldStar || boldScore}
        </strong>,
      );
    } else if (italic) {
      out.push(<em key={keyBase + 'i' + match.index}>{italic}</em>);
    } else if (citeRef) {
      const ref = Number(citeRef);
      const source = sourceFor(ref);
      // A citation only becomes a control when there is a record behind it;
      // otherwise it stays a plain marker rather than a button that does
      // nothing when tapped.
      out.push(
        source && onOpenSource ? (
          <button
            key={keyBase + 'c' + match.index}
            type="button"
            className="ask-cite"
            onClick={() => onOpenSource(source)}
            aria-label={'Open source record ' + ref}
          >
            {ref}
          </button>
        ) : (
          <span key={keyBase + 'c' + match.index} className="ask-cite ask-cite-flat">
            {ref}
          </span>
        ),
      );
    }
    last = match.index + full.length;
  }

  if (last < text.length) out.push(stripStrays(text.slice(last)));
  return out;
}

export default function AnswerText({ text, sources = [], onOpenSource }) {
  const sourceFor = (ref) => sources.find((s) => Number(s.ref) === ref);
  const lines = String(text == null ? '' : text).split('\n');

  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={'ul' + blocks.length} className="ask-list">
        {listItems}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    if (LIST_MARKER.test(line)) {
      const content = line.replace(LIST_MARKER, '');
      listItems.push(
        <li key={'li' + i}>{renderInline(content, 'l' + i, sourceFor, onOpenSource)}</li>,
      );
      return;
    }

    flushList();
    const isHeading = HEADING.test(line);
    const content = line.replace(HEADING, '');
    blocks.push(
      <p key={'p' + i} className={isHeading ? 'ask-p ask-p-hdr' : 'ask-p'}>
        {renderInline(content, 'p' + i, sourceFor, onOpenSource)}
      </p>,
    );
  });

  flushList();
  return <div className="ask-a">{blocks}</div>;
}
