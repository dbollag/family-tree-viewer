// The feedback dialog: one free-text box, sent to the site's own /api/feedback. Nothing here changes the family data.
import { useEffect, useRef, useState } from 'react';

interface Item { at: string; from: string | null; text: string; about: { id: string; name: string } | null; view: string }
interface Props { about: { id: string; name: string } | null; view: string; close: () => void }

export function Feedback({ about, view, close }: Props) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [items, setItems] = useState<Item[] | null>(null);   // only the owner gets these back
  const [tab, setTab] = useState<'write' | 'received'>('write');
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [close]);
  useEffect(() => {   // asked only now, when the dialog opens; a 403 simply means this person is not the owner
    let live = true;
    fetch('/api/feedback').then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d?.items) setItems(d.items); }).catch(() => { /* not the owner, or offline */ });
    return () => { live = false; };
  }, []);

  const send = async () => {
    if (!text.trim() || state === 'sending') return;
    setState('sending');
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.trim(), about, view }) });
      setState(r.ok ? 'sent' : 'error');
    } catch { setState('error'); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="fb-h" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog feedbackdlg">
        <h2 id="fb-h">Feedback</h2>
        {items && (
          <div className="srckinds fbtabs" role="group" aria-label="Feedback">
            <button type="button" className={`tab${tab === 'write' ? ' on' : ''}`} aria-pressed={tab === 'write'} onClick={() => setTab('write')}>Write</button>
            <button type="button" className={`tab${tab === 'received' ? ' on' : ''}`} aria-pressed={tab === 'received'} onClick={() => setTab('received')}>Received ({items.length})</button>
          </div>
        )}
        {tab === 'received' && items ? (
          <ul className="fblist">
            {items.length === 0 && <li className="dim">Nothing yet.</li>}
            {items.map((it, i) => (
              <li key={i}>
                <div className="dim">{new Date(it.at).toLocaleString()} · {it.from ?? 'unknown sender'}{it.about ? ` · about ${it.about.name}` : ''}</div>
                <p>{it.text}</p>
              </li>
            ))}
          </ul>
        ) : state === 'sent' ? (
          <>
            <p>Thanks for helping! This will be reviewed shortly.</p>
            <button type="button" className="btn" autoFocus onClick={close}>Close</button>
          </>
        ) : (
          <>
            <p className="dim">Flag a mistake, confirm a fact, or share more information.</p>
            {about && <p className="fbabout">About: <strong>{about.name}</strong></p>}
            <label className="fblabel" htmlFor="fb-text">Your message</label>
            <textarea id="fb-text" ref={box} autoFocus rows={6} maxLength={2000} value={text} onChange={(e) => { setText(e.target.value); if (state === 'error') setState('idle'); }}
              placeholder="For example: the birth year looks wrong, I remember it as 1919." />
            {state === 'error' && <p className="fberr" role="alert">The message could not be sent. Please try again, or tell the site owner directly.</p>}
            <div className="fbbtns">
              <button type="button" className="btn" onClick={close}>Cancel</button>
              <button type="button" className="btn primary" disabled={!text.trim() || state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
            </div>
          </>
        )}
        {(state !== 'sent' && tab === 'received') && <button type="button" className="btn" onClick={close}>Close</button>}
      </div>
    </div>
  );
}
