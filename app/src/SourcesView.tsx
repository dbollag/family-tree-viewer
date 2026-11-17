// The Sources view: documents and photographs, grouped under the person they are linked to (closest to the centre first), to browse and open.
import { D } from './data';
import { sourceGroups, type SourceKind } from './sources';

interface Props {
  centre: string; kind: SourceKind; q: string; person: string | null;
  setKind: (k: SourceKind) => void; setQ: (q: string) => void; setPerson: (id: string | null) => void;
  open: (docId: string) => void; showPerson: (id: string) => void;
}

const KINDS: { id: SourceKind; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'documents', label: 'Documents' }, { id: 'photographs', label: 'Photographs' }];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function SourcesView({ centre, kind, q, person, setKind, setQ, setPerson, open, showPerson }: Props) {
  const groups = sourceGroups(kind, q, person, centre);
  const total = groups.reduce((n, g) => n + g.docs.length, 0);
  return (
    <div className="srcview">
      <div className="srcbar">
        <div className="srckinds" role="group" aria-label="Show">
          {KINDS.map((k) => <button key={k.id} type="button" className={`tab${kind === k.id ? ' on' : ''}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
        </div>
        <input className="ev-search" type="search" aria-label="Search the sources" placeholder="Search by title or person" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="dim">{total} {total === 1 ? 'item' : 'items'}</span>
      </div>
      {person && (
        <p className="srcperson">Everything linked to <strong>{D.person[person].name}</strong>. <button type="button" className="linkbtn" onClick={() => setPerson(null)}>Show everyone</button></p>
      )}
      {total === 0 ? <p className="note">Nothing found.</p> : groups.map((g) => (
        <section key={g.person ?? 'none'} className="srcgroup" aria-label={g.person ? D.person[g.person].name : 'Not linked to a person'}>
          <h3 className="srchead">
            {g.person ? <button type="button" className="linkbtn srcname" onClick={() => showPerson(g.person!)}>{D.person[g.person].name}</button> : <span>Not linked to a person</span>}
            {g.person && g.relation && g.relation !== 'centre' && <span className="dim"> · {cap(g.relation)}</span>}
            <span className="dim"> · {g.docs.length}</span>
            {g.person && !person && <button type="button" className="linkbtn srcall" onClick={() => setPerson(g.person)}>Everything linked to {D.person[g.person].short}</button>}
          </h3>
          <ul className="srcgrid">
            {g.docs.map((d) => {
              const others = d.persons.filter((p) => p !== g.person).map((p) => D.person[p]?.short).filter(Boolean);
              return (
                <li key={d.id}>
                  <button type="button" className="srccard" onClick={() => open(d.id)} title={d.title}>
                    {d.image ? <img src={d.image} alt="" loading="lazy" /> : <span className="ph-thumb" aria-hidden="true">no image</span>}
                    <span className="dtitle">{d.title}</span>
                    <span className="dsub">{d.isPhoto ? 'Photograph' : 'Document'}{others.length ? ` · with ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` +${others.length - 3}` : ''}` : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
