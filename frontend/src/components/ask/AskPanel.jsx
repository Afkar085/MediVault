import { useState, useContext, useRef } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { fmt, drN } from '../../utils/format';
import { clickable } from '../../utils/interaction';
import Icon from '../common/Icon';

const SUGGESTIONS = [
  'What medicines was I prescribed recently?',
  'When was my last blood test?',
  'Which doctors have treated me?',
  'What did the doctor recommend for my knee?',
];

export default function AskPanel() {
  const { sel, records, openRecord } = useContext(AppContext);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const hasRecords = records.some(r => r.status === 'done');

  const ask = (text) => {
    const q = (text ?? question).trim();
    if (!q || !sel) return;
    const id = ++requestRef.current;
    setQuestion(q);
    setAsked(q);
    setThinking(true);
    setError('');
    setAnswer(null);
    setSources([]);

    API.post('/profiles/' + sel.id + '/ask', { question: q })
      .then(r => {
        if (requestRef.current !== id) return;
        setAnswer(r.data.answer || '');
        setSources(r.data.sources || []);
        setThinking(false);
      })
      .catch(e => {
        if (requestRef.current !== id) return;
        setError(
          e?.response?.status === 429
            ? 'That is a lot of questions at once — give it a minute and try again.'
            : "Couldn't get an answer right now. Please try again.",
        );
        setThinking(false);
      });
  };

  if (!hasRecords) {
    return (
      <div className="empty">
        <div className="empty-icon"><Icon name="forum" size={30} /></div>
        <div className="empty-title">Nothing to ask about yet</div>
        <div className="empty-sub">
          Upload a prescription or report first. Answers only ever come from {sel?.name || 'this member'}&rsquo;s own documents.
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        className="ask-form"
        onSubmit={e => { e.preventDefault(); ask(); }}
      >
        <input
          className="sinput ask-input"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={'Ask about ' + (sel?.name || 'these') + '’s records…'}
          aria-label={'Ask a question about ' + (sel?.name || 'these') + '’s records'}
        />
        <button className="btn-s ask-send" type="submit" disabled={thinking || !question.trim()}>
          {thinking ? 'Reading…' : 'Ask'}
        </button>
      </form>

      <p className="ask-note">
        Answers come only from {sel?.name || 'this member'}&rsquo;s uploaded documents. This is not medical advice.
      </p>

      <div aria-live="polite">
        {thinking && (
          <div className="ask-card ask-card-thinking">
            <span className="spinner spinner-sm" />
            <span>Reading through {sel?.name || 'the'}&rsquo;s records&hellip;</span>
          </div>
        )}

        {error && !thinking && (
          <div className="notice notice-error">
            {error}{' '}
            <button className="linkish" onClick={() => ask(asked)}>Try again</button>
          </div>
        )}

        {answer && !thinking && (
          <div className="ask-card">
            <div className="ask-q">{asked}</div>
            <div className="ask-a">{answer}</div>

            {sources.length > 0 && (
              <>
                <div className="ask-src-hdr">Based on these records</div>
                {sources.map(src => {
                  const record = records.find(r => r.id === src.record_id);
                  const title = src.doctor_name
                    ? drN(src.doctor_name)
                    : record?.hospital_name || 'Record';
                  const when = fmt(src.date) || '';
                  if (!record) {
                    return (
                      <div key={src.ref} className="ask-src is-static">
                        <span className="ask-src-ref">{src.ref}</span>
                        <span className="ask-src-title">{title}</span>
                        {when && <span className="ask-src-date">{when}</span>}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={src.ref}
                      className="ask-src"
                      {...clickable(() => openRecord(record), 'Open source record: ' + title + (when ? ', ' + when : ''))}
                    >
                      <span className="ask-src-ref">{src.ref}</span>
                      <span className="ask-src-title">{title}</span>
                      {when && <span className="ask-src-date">{when}</span>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {!answer && !thinking && !error && (
          <div className="ask-suggest">
            <div className="ask-suggest-hdr">Try asking</div>
            {SUGGESTIONS.map(s => (
              <button key={s} className="ask-suggest-btn" onClick={() => ask(s)}>
                <Icon name="chat_bubble" size={15} />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
