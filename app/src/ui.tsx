import type { ReactNode } from 'react';
import { D, baseText, levelClass, levelInfo, levelOf } from './data';
import type { Level, Status } from './types';

/** The simple level badge. With `basis`, the pack's own source label is shown after it. */
export function Badge({ status, level, basis }: { status: Status; level?: Level; basis?: boolean }) {
  const l = levelOf(status, level);
  return (
    <span className={`badge ${levelClass(l)}`} title={`${levelInfo[l].text} Basis: ${status}. ${baseText[status]}`}>
      <span className="glyph" aria-hidden="true">{levelInfo[l].glyph}</span> {l}{basis ? <span className="basis"> · {status}</span> : null}
    </span>
  );
}

/** Compact sources: one chip per scan, and a short link for sources that are not scans. */
export function SourceChips({ ids, openDoc }: { ids: string[]; openDoc: (id: string) => void }) {
  const scans = [...new Set(ids.flatMap((id) => D.source[id]?.scans ?? []))].sort((a, b) => a - b);
  const others = ids.map((id) => D.source[id]).filter((s) => s && !s.scans.length && s.url);
  return (
    <span className="chips">
      {scans.map((n) => { const d = D.doc[`scan-${String(n).padStart(2, '0')}`]; return d ? <button key={n} type="button" className="srcchip" title={d.title} onClick={() => openDoc(d.id)}>{d.title}</button> : null; })}
      {others.map((s) => <a key={s.id} className="srcchip" href={s.url!} target="_blank" rel="noopener noreferrer" title={s.label}>{s.publisher || 'Source'} ↗</a>)}
    </span>
  );
}

export function Sources({ ids, openDoc }: { ids: string[]; openDoc: (id: string) => void }) {
  return (
    <span className="srcs">
      {ids.map((id) => {
        const s = D.source[id]; if (!s) return null;
        const parts: ReactNode[] = s.scans.map((n) => {
          const d = D.doc[`scan-${String(n).padStart(2, '0')}`];
          return <button key={n} className="linkbtn" type="button" onClick={() => openDoc(d.id)}>{d.title}</button>;
        });
        if (!s.scans.length) parts.push(s.url ? <a key="u" href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}>{s.label.replace(/^[^:]+: /, '')}</a> : <span key="u" className="nolink" title={s.label}>{s.label.split(':')[0]}</span>);
        else if (s.url) parts.push(<a key="u" href={s.url} target="_blank" rel="noopener noreferrer" title={`${s.label} (archive record)`} aria-label="Archive record">↗</a>);
        return <span className="src" key={id}>{parts.flatMap((p, i) => (i ? [' · ', p] : [p]))}</span>;
      })}
    </span>
  );
}

/** A small sprout: the person is still living. Calm, single colour, no motion. */
export const LivingIcon = ({ className = '', label = 'Possibly living', decorative = false }: { className?: string; label?: string; decorative?: boolean }) => (
  <svg className={`livingicon ${className}`} width="18" height="18" viewBox="0 0 18 18" {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })} fill="none">
    {!decorative && <title>{label}</title>}
    <path d="M9 16V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 10C9 6.8 6.8 5 3 5c0 3.4 2.2 5 6 5z" fill="currentColor" fillOpacity=".85" />
    <path d="M9 8.5C9 5.4 11 3.2 15 3.2c0 3.4-2.1 5.3-6 5.3z" fill="currentColor" />
  </svg>
);
