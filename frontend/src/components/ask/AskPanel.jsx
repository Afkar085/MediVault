import { useState, useContext, useRef } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { fmt, drN } from '../../utils/format';
import { clickable } from '../../utils/interaction';
import Icon from '../common/Icon';

const MEMBER_SUGGESTIONS = [
  'What medicines was I prescribed recently?',
  'When was my last blood test?',
  'Which doctors have treated me?',
  'Summarise my medical history this year.',
];

// Family-wide questions are the ones worth naming a person in.
const FAMILY_SUGGESTIONS = [
  'What medicines was Dad prescribed for his knee?',
  'When was Mum’s last blood test?',
  'Who in the family has seen an orthopedic doctor?',
  'Show everyone’s prescriptions from this year.',
];

export default function AskPanel() {
  const { sel, profiles, records, openRecord } = useContext(AppContext);
  const [wholeFamily, setWholeFamily] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const suggestions = wholeFamily ? FAMILY_SUGGESTIONS : MEMBER_SUGGESTIONS;
  const hasRecords = wholeFamily ? profiles.length > 0 : records.some(r => r.status === 'done');

  const ask = (text, familyWide = wholeFamily) => {
    const q = (text ?? question).trim();
    if (!q || !sel) return;
    const id = ++requestRef.current;
    setQuestion(q);
    setAsked(q);
    setThinking(true);
    setError('');
    setAnswer(null);
    setSources([]);

    // The family-wide endpoint resolves who "Dad" is and can sort across
    // members; the per-profile one stays scoped to the selected member.
    const path = familyWide ? '/ask' : '/profiles/' + sel.id + '/ask';
    API.post(path, { question: q })
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
      <div className="sscope" role="group" aria-label="Whose records to ask about">
        <button
          className={'sscope-btn' + (!wholeFamily ? ' active' : '')}
          aria-pressed={!wholeFamily}
          onClick={() => setWholeFamily(false)}
        >{sel?.name || 'This member'}</button>
        <button
          className={'sscope-btn' + (wholeFamily ? ' active' : '')}
          aria-pressed={wholeFamily}
          onClick={() => setWholeFamily(true)}
        >Everyone</button>
      </div>

      <form
        className="ask-form"
        onSubmit={e => { e.preventDefault(); ask(); }}
      >
        <input
          className="sinput ask-input"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={wholeFamily ? 'Ask about the family’s records…' : 'Ask about ' + (sel?.name || 'these') + '’s records…'}
          aria-label={wholeFamily ? 'Ask a question about the family’s records' : 'Ask a question about ' + (sel?.name || 'these') + '’s records'}
        />
        <button className="btn-s ask-send" type="submit" disabled={thinking || !question.trim()}>
          {thinking ? 'Reading…' : 'Ask'}
        </button>
      </form>

      <p className="ask-note">
        Answers come only from {wholeFamily ? 'your family’s' : (sel?.name || 'this member') + '’s'} uploaded documents. This is not medical advice.
      </p>

      <div aria-live="polite">
        {thinking && (
          <div className="ask-card ask-card-thinking">
            <span className="spinner spinner-sm" />
            <span>Reading through {wholeFamily ? 'the family’s' : (sel?.name || 'the') + '’s'} records&hellip;</span>
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
                  const owner = src.member || '';
                  const when = fmt(src.date) || '';
                  if (!record) {
                    return (
                      <div key={src.ref} className="ask-src is-static">
                        <span className="ask-src-ref">{src.ref}</span>
                        <span className="ask-src-title">{title}{owner ? ' · ' + owner : ''}</span>
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
                      <span className="ask-src-title">{title}{owner ? ' · ' + owner : ''}</span>
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
            {suggestions.map(s => (
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
