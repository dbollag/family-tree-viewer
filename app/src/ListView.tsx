// The List tab: everyone in the data as a sortable table. Tapping a row opens the panel in place.
import { useMemo, useState } from 'react';
import { D, LEVELS, levelOf, matchedAlias, nameHaystack } from './data';
import { useClickOrDouble, usePhone } from './hooks';
import { relation } from './kinship';
import { Badge } from './ui';
import type { Level, Person } from './types';

type Col = 'name' | 'birth' | 'death' | 'relationship' | 'confidence';
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const yearOf = (s: string) => { const m = /\d{4}/.exec(s); return m ? +m[0] : null; };
const rankOf: Record<Level, number> = { Confirmed: 0, Probable: 1, Possible: 2, Open: 3 };

/** Generation order: own generation first, then parents' and children's, then grandparents' and grandchildren's… (older before younger). */
const genKey = (gen: number | null) => (gen === null ? null : Math.abs(gen) * 2 + (gen > 0 ? 1 : 0));

const COLS: { id: Col; label: string; hint?: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'birth', label: 'Birth', hint: 'Sorted by year' },
  { id: 'death', label: 'Death', hint: 'Sorted by year' },
  { id: 'relationship', label: 'Relationship', hint: 'Sorted by generation: own generation first, then parents’ and children’s, then grandparents’ and grandchildren’s' },
  { id: 'confidence', label: 'Confidence', hint: 'Confirmed first' }
];

export function ListView({ start, selected, select, centreOn }: { start: string; selected: string | null; select: (id: string) => void; centreOn: (id: string) => void }) {
  const phone = usePhone();
  const [pickRow, centreRow] = useClickOrDouble(select, centreOn, !phone);
  const [q, setQ] = useState('');
  const [lvl, setLvl] = useState<Level | ''>('');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'name', dir: 1 });

  const all = useMemo(() => D.people.filter((p) => !p.unattached).map((p) => ({ p, rel: relation(start, p.id), level: levelOf(p.status, p.level) })), [start]);
  const counts = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l.id, all.filter((r) => r.level === l.id).length])) as Record<Level, number>, [all]);

  const rows = useMemo(() => {
    const f = fold(q.trim());
    const key = (r: (typeof all)[number]): number | string | null => {
      switch (sort.col) {
        case 'name': return fold(r.p.name);
        case 'birth': return yearOf(r.p.birth);
        case 'death': return yearOf(r.p.death);
        case 'relationship': return r.p.id === start ? -1 : genKey(r.rel.gen);   // the person themself comes first
        case 'confidence': return rankOf[r.level];
      }
    };
    return all
      .filter((r) => (!f || nameHaystack(r.p).includes(f)) && (!lvl || r.level === lvl))
      .sort((a, b) => {
        const ka = key(a), kb = key(b);
        if (ka === null && kb === null) return fold(a.p.name).localeCompare(fold(b.p.name));
        if (ka === null) return 1;               // unknown always last, whichever way you sort
        if (kb === null) return -1;
        const c = typeof ka === 'string' ? ka.localeCompare(kb as string) : (ka as number) - (kb as number);
        return c !== 0 ? c * sort.dir : fold(a.p.name).localeCompare(fold(b.p.name));
      });
  }, [all, q, lvl, sort]);

  const click = (col: Col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));
  const cell = (p: Person, c: 'birth' | 'death') => p[c] || '–';

  return (
    <div className="everyone">
      <div className="ev-inner">
        <div className="ev-head">
          <h2>List <span className="dim">({rows.length} of {all.length})</span></h2>
          <input className="ev-search" type="search" aria-label="Search the list" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="ev-chips" role="group" aria-label="Filter by confidence">
          <button type="button" className="chip" aria-pressed={lvl === ''} onClick={() => setLvl('')}>All <span>{all.length}</span></button>
          {LEVELS.filter((l) => l.id !== 'Open').map((l) => (
            <button key={l.id} type="button" className="chip" aria-pressed={lvl === l.id} onClick={() => setLvl(lvl === l.id ? '' : l.id)} disabled={!counts[l.id]}>
              {l.id} <span>{counts[l.id]}</span>
            </button>
          ))}
        </div>
        <div className="ev-cols" role="row">
          {COLS.map((c) => (
            <button key={c.id} type="button" className={`ev-th${sort.col === c.id ? ' on' : ''}`} title={c.hint} role="columnheader"
              aria-sort={sort.col === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} onClick={() => click(c.id)}>
              {c.id === 'relationship' ? `Relationship to ${D.person[start].short}` : c.label}
              <span className="arrow" aria-hidden="true">{sort.col === c.id ? (sort.dir === 1 ? '▴' : '▾') : ''}</span>
            </button>
          ))}
        </div>
        {rows.length === 0 && <p className="note">Nobody matches. That means not found in this list, not that the person does not exist.</p>}
        <ul className="ev-list">
          {rows.map(({ p, rel }) => (
            <li key={p.id}>
              <button type="button" className={`ev-row${selected === p.id ? ' on' : ''}`} aria-pressed={selected === p.id} onClick={() => pickRow(p.id)} onDoubleClick={() => centreRow(p.id)} title="Click for details, double-click to centre on them">
                <span className="ev-name"><strong>{p.name}</strong>{matchedAlias(p, q) && <span className="ev-aka"> also known as {matchedAlias(p, q)}</span>}</span>
                <span className="ev-birth"><span className="ev-lab">Born </span>{cell(p, 'birth')}</span>
                <span className="ev-death"><span className="ev-lab">Died </span>{cell(p, 'death')}</span>
                <span className="ev-rel">{rel.text ? cap(rel.text) : p.unattached ? 'Unattached on purpose' : 'Not connected by the records'}</span>
                <span className="ev-status"><Badge status={p.status} level={p.level} /></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
