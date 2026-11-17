// In-app scan viewer: zoom and pan, caption and uncertainty notes beside it. Loads only local JPGs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { D } from './data';
import { Badge } from './ui';

interface T { s: number; x: number; y: number }

export function Viewer({ list, startId, backTo, onChange, onClose, onPerson }: { list: string[]; startId: string; backTo: string; onChange: (id: string) => void; onClose: () => void; onPerson: (id: string) => void }) {
  const [idx, setIdx] = useState(Math.max(0, list.indexOf(startId)));
  const d = D.doc[list[idx]] ?? D.doc[startId];   // the list can shrink under us (browser Back, a hand-edited address)
  const [view, setView] = useState(0);
  const [t, setT] = useState<T>({ s: 1, x: 0, y: 0 });
  const vp = useRef<HTMLDivElement>(null);
  const nat = useRef({ w: 0, h: 0 });
  const fitS = useRef(1);
  const tr = useRef(t); tr.current = t;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  useEffect(() => { onChange(d.id); }, [d.id, onChange]);

  const fit = useCallback(() => {
    const el = vp.current; const { w, h } = nat.current; if (!el || !w) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(r.width / w, r.height / h, 1.6);
    fitS.current = s;
    setT({ s, x: (r.width - w * s) / 2, y: (r.height - h * s) / 2 });
  }, []);
  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const { s, x, y } = tr.current; const ns = Math.min(8, Math.max(0.1, s * f)); const k = ns / s;
    setT({ s: ns, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
  }, []);
  const centreZoom = useCallback((f: number) => { const r = vp.current!.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); }, [zoomAt]);

  useEffect(() => { // wheel must be non-passive to stop page scroll
    const el = vp.current!;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.0012), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('wheel', wheel, { passive: false });
    const resize = () => fit(); window.addEventListener('resize', resize);
    return () => { el.removeEventListener('wheel', wheel); window.removeEventListener('resize', resize); };
  }, [zoomAt, fit]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {   // first step back to the whole page, then close
        if (Math.abs(tr.current.s - fitS.current) > 0.02) fit(); else onClose();
      }
      else if (e.key === '+' || e.key === '=') centreZoom(1.1);
      else if (e.key === '-') centreZoom(1 / 1.1);
      else if (e.key === '0') fit();
      else if (e.key === 'ArrowLeft' && !e.shiftKey) { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
      else if (e.shiftKey && e.key.startsWith('Arrow')) {   // Shift + arrows move the zoomed page
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0, dy = e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0;
        setT((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [centreZoom, fit, onClose, list.length]);

  useEffect(() => { vp.current?.focus(); }, []);
  useEffect(() => { nat.current = { w: 0, h: 0 }; setT({ s: 1, x: 0, y: 0 }); setView(0); }, [d.id]);

  const down = (e: React.PointerEvent) => { vp.current!.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch.current = 0; };
  const move = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId); if (!prev) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) setT((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) { const r = vp.current!.getBoundingClientRect(); zoomAt(dist / pinch.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
      pinch.current = dist;
    }
  };
  const up = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); pinch.current = 0; };

  return (
    <div className="viewer">
      <div className="vmodal" role="dialog" aria-modal="true" aria-label="Document viewer">
        <div className="vmain">
          <div className="vbar">
            <button type="button" className="btn back" onClick={onClose}><span aria-hidden="true">←</span> Back to {backTo}</button>
            <span className="vtools">
              <button type="button" className="btn sm" aria-label="Zoom out" onClick={() => centreZoom(1 / 1.15)}>−</button>
              <span className="zoomtxt" aria-live="polite">{Math.round(t.s * 100)}%</span>
              <button type="button" className="btn sm" aria-label="Zoom in" onClick={() => centreZoom(1.15)}>+</button>
              <button type="button" className="btn sm" onClick={fit}>Fit</button>
            </span>
          </div>
          <div className={`vp${d.image ? '' : ' isph'}`} ref={vp} tabIndex={0} role="img"
            aria-label={d.placeholder ? 'Placeholder: photograph not included in this set' : `${d.title}. Scan of an archival document.`}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            {d.image ? (
              <img key={d.id + view} className="vimg" src={view && d.closeUps ? d.closeUps[view - 1].image : d.image} alt={d.title} draggable={false}
                style={{ transform: `translate(${t.x}px,${t.y}px) scale(${t.s})` }}
                onLoad={(e) => { nat.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; fit(); }} />
            ) : (
              d.placeholder
                ? <div className="phbox"><strong>Photograph not included in this set</strong><p>The reading is given as text in the caption beside it.</p></div>
                : <div className="phbox"><strong>This scan is not in the local scans folder</strong><p>No copy of this scan is stored in the app.</p></div>
            )}
          </div>
        </div>
        <aside className="vside">
          <div className="vnav">
            <button type="button" className="btn sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>‹ Previous</button>
            <span className="vcount">{idx + 1} of {list.length}</span>
            <button type="button" className="btn sm" disabled={idx === list.length - 1} onClick={() => setIdx(idx + 1)}>Next ›</button>
          </div>
          <h2>{d.title}</h2>
          <div><Badge status={d.status} basis /></div>
          {d.redacted && <p className="warn">Redacted copy. The submitter’s details are blacked out in this copy; do not try to read around the redaction. The unredacted original is at the archive link.</p>}
          {d.notOurFamily && <p className="warn">Not our family. This document was checked and ruled out. It is kept only to show that it is not connected to our family.</p>}
          {d.maybePersons && d.maybePersons.length > 0 && <p className="warn">It is not certain that this document is about the person it is listed under.</p>}
          {d.portraitCaveat && <p className="warn">The portrait on this card is not independently confirmed as hers. The name and birth date match exactly.</p>}
          {d.caption && <p className="vcaption">{d.caption}</p>}
          {d.notes.length > 0 && <div className="vcaveat"><strong>Keep in mind</strong>{d.notes.map((n) => <p key={n}>{n}</p>)}</div>}
          {d.closeUps && d.closeUps.length > 0 && (
            <div className="vlinks">
              <button type="button" className={`btn sm${view === 0 ? ' on' : ''}`} onClick={() => setView(0)}>Full page</button>
              {d.closeUps.map((c, i) => <button key={c.image} type="button" className={`btn sm${view === i + 1 ? ' on' : ''}`} title={c.title} onClick={() => setView(i + 1)}>{d.closeUps!.length > 1 ? `Close-up ${i + 1}` : 'Enlargement'}</button>)}
            </div>
          )}
          {d.isPhoto && d.lineup && d.lineup.length > 1 && <><h3>Left to right</h3><p className="whowho">{d.lineup.map((id) => (id && D.person[id] ? D.person[id].name : 'not identified')).join(' · ')}</p></>}
          {d.isPhoto && d.whoIsWho && <><h3>Who is who</h3><p className="whowho">{d.whoIsWho}</p></>}
          <h3>{d.isPhoto ? 'People in this photograph' : 'Linked to'}</h3>
          <ul className="peoplelinks">
            {d.persons.map((id) => <li key={id}><button type="button" className="linkbtn" onClick={() => onPerson(id)}>{D.person[id].name}</button>{D.person[id].years && <span className="dim"> {D.person[id].years.slice(0, 24)}</span>}</li>)}
          </ul>
          <div className="vlinks">
            {d.archiveUrl && <a className="btn" href={d.archiveUrl} target="_blank" rel="noopener noreferrer">Public archive record ↗</a>}
          </div>
        </aside>
      </div>
    </div>
  );
}
