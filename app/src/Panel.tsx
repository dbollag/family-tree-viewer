import { useEffect, useRef, useState, type ReactNode } from 'react';
import { D, factsOf, lifeFact, levelClass, levelInfo, levelOf, lineKind, other } from './data';
import { relation } from './kinship';
import { placesOfPerson } from './placeData';
import { Badge, LivingIcon, SourceChips, Sources } from './ui';
import type { Level, Rel, Status } from './types';

interface Props { id: string; start: string; close: () => void; select: (id: string) => void; openDoc: (docId: string, personId: string) => void; feedback: () => void; showOnMap: (place: string) => void; back?: { label: string; go: () => void } }

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const Section = ({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) => (
  <details className="psec" open={open}><summary>{title}</summary><div className="psec-body">{children}</div></details>
);

/** Small level marker: glyph + colour, with the word for screen readers and a tooltip. */
const Dot = ({ status, level }: { status: Status; level?: Level }) => {
  const l = levelOf(status, level);
  return <span className={`dot ${levelClass(l)}`} title={`${l} (basis: ${status})`} role="img" aria-label={l}>{levelInfo[l].glyph}</span>;
};

export function Panel({ id, start, close, select, openDoc, feedback, showOnMap, back }: Props) {
  const p = D.person[id];
  const rel = relation(start, id);
  const body = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => { body.current?.scrollTo(0, 0); setMore(false); }, [id]);
  const open = (docId: string) => openDoc(docId, id);

  const eyebrow = rel.text
    ? (rel.text === 'centre' ? 'CENTRE' : `${rel.text.toUpperCase()} · OF ${D.person[start].short.toUpperCase()}`)
    : p.unattached ? 'UNATTACHED ON PURPOSE' : 'NOT CONNECTED BY THE RECORDS';

  const links: { label: string; r: Rel; o: string }[] = [
    ...(D.parentsOf[id] ?? []).map((r) => ({ label: 'Parent', r, o: r.a })),
    ...(D.partnersOf[id] ?? []).map((r) => ({ label: 'Partner', r, o: other(r, id) })),
    ...(D.childrenOf[id] ?? []).map((r) => ({ label: 'Child', r, o: r.b })),
    ...(D.siblingOf[id] ?? []).map((r) => ({ label: 'Brother or sister', r, o: other(r, id) })),
    ...(D.otherLinks[id] ?? []).filter((r) => r.type !== 'grandparent').map((r) => ({
      label: r.type === 'inlaw' ? 'In-law' : r.type === 'grandparent' ? (r.a === id ? 'Grandchild' : 'Grandparent') : 'Kept apart from', r, o: other(r, id)
    }))
  ];
  const birthF = lifeFact(id, 'BIRTH'), deathF = lifeFact(id, 'DEATH');
  // birth and death come first in the Facts list, with their evidence; the other facts follow
  const facts = [
    ...(birthF && p.birth ? [{ ...birthF, text: p.birth }] : []),
    ...(deathF && p.death && !p.living ? [{ ...deathF, text: p.death }] : []),
    ...factsOf(id)
  ];
  const places = placesOfPerson(id);
  const conflicts = D.conflicts.filter((c) => c.persons.includes(id));
  const docs = D.documents.filter((d) => d.persons.includes(id));
  const papers = docs.filter((d) => !d.isPhoto), photos = docs.filter((d) => d.isPhoto);
  const long = p.summary.length > 340;

  return (
    <>
      <header className="phead">
        <div className="peyebrow">{eyebrow}</div>
        <span className="pheadbtns">
          <button className="close" type="button" aria-label={`Feedback about ${p.name}`} title="Flag a mistake, confirm a fact, or share more information about this person" onClick={feedback}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5h12v8H8l-3.5 3v-3H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </button>
          <button className="close" type="button" aria-label="Close the side panel" onClick={close}>✕</button>
        </span>
      </header>
      <div className="pbody" ref={body}>
        {back && <button type="button" className="linkbtn pc-back" onClick={back.go}>← {back.label}</button>}
        {p.photo && <img className="pphoto" src={p.photo} alt="" />}
        <div className="pnamerow"><h2>{p.name}</h2><Badge status={p.status} level={p.level} basis /></div>
        <div className="pyears">{p.living && <span className="living" title="From the workbook's living column"><LivingIcon decorative /> {p.living === 'Yes' ? 'Living' : 'Possibly living'}</span>}</div>
        <dl className="pfields">
          {p.maidenName && <><dt>Maiden name</dt><dd>{p.maidenName}</dd></>}
          <dt>Birth</dt><dd className={p.birth ? '' : 'none'}>{p.birth || 'not recorded'}{birthF?.conflict && <> <span className="tag-conflict" title="Sources disagree; see Conflicts">⚑</span></>}</dd>
          {!p.living && <><dt>Death</dt><dd className={p.death ? '' : 'none'}>{p.death || 'not recorded'}{deathF?.conflict && <> <span className="tag-conflict" title="Sources disagree; see Conflicts">⚑</span></>}</dd></>}
        </dl>
        {p.summary && <p className={`summary${long && !more ? ' clamp' : ''}`}>{p.summary}</p>}
        {p.summary && long && <button type="button" className="linkbtn morebtn" onClick={() => setMore(!more)}>{more ? 'Less' : 'More'}</button>}

        {places.length > 0 && (
          <p className="pplaces"><span className="dim">Places</span>{places.slice(0, 7).map(({ pl, groups }) => <button key={pl.id} type="button" className="linkbtn" title={`${groups.join(', ')}. Show on the map`} onClick={() => showOnMap(pl.id)}>{pl.name}</button>)}{places.length > 7 && <span className="dim">+{places.length - 7} more</span>}</p>
        )}

        <Section title={`Documents (${papers.length})`} open={papers.length > 0}>
          {papers.length ? (
            <ul className="docgrid">
              {papers.map((d) => (
                <li key={d.id}>
                  <button type="button" className="doccard" onClick={() => open(d.id)} title={d.title}>
                    {d.image ? <img src={d.image} alt="" loading="lazy" width={44} height={56} /> : <span className="ph-thumb" aria-hidden="true">no image</span>}
                    <span className="dtext">
                      <strong className="dtitle">{d.title}</strong>
                      {(d.placeholder || d.redacted || d.portraitCaveat || d.cropOf || d.notOurFamily || d.maybePersons?.includes(id)) && <span className="dsub">{d.notOurFamily ? 'not our family' : d.maybePersons?.includes(id) ? 'link to this person is uncertain' : d.placeholder ? 'not in this set' : d.redacted ? 'redacted copy' : d.portraitCaveat ? 'portrait not confirmed' : 'enlargement'}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="note">No document in this set is tied to this person.</p>}
        </Section>

        {photos.length > 0 && (
          <Section title={`Photographs (${photos.length})`} open>
            <ul className="photogrid">
              {photos.map((d) => {
                const others = d.persons.filter((q) => q !== id).map((q) => D.person[q]?.short).filter(Boolean);
                return (
                  <li key={d.id}>
                    <button type="button" className="photocard" onClick={() => open(d.id)} title={d.title}>
                      {d.image ? <img src={d.image} alt="" loading="lazy" /> : <span className="ph-thumb" aria-hidden="true">no image</span>}
                      <span className="dtitle">{d.title}</span>
                      {others.length > 0 && <span className="dsub">With {others.slice(0, 3).join(', ')}{others.length > 3 ? ` and ${others.length - 3} more` : ''}</span>}
                      {d.portraitCaveat && <span className="dsub">identity not certain</span>}
                      {d.maybePersons?.includes(id) && <span className="dsub">link to this person is uncertain</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title={`Facts (${facts.length})`} open>
          {facts.length ? (
            <ul className="factlist">
              {facts.map((f) => {
                const lv = levelOf(f.status, f.level);
                return (
                  <li key={f.id}>
                    <div className="f-kind">{cap(f.kind.toLowerCase())}{f.asName ? <span className="f-as"> as {f.asName}</span> : null}</div>
                    <div className="f-body">
                      <p className="f-text">{cap(f.text)}{f.conflict && <> <span className="tag-conflict" title="Sources disagree; see Conflicts">⚑</span></>}{D.factPlace[f.id] && <> <button type="button" className="linkbtn f-map" title={`Show ${D.places.find((q) => q.id === D.factPlace[f.id])?.name} on the map`} onClick={() => showOnMap(D.factPlace[f.id])}>Map</button></>}</p>
                      <div className="f-meta">
                        <span className={`basis ${levelClass(lv)}${f.note ? ' has-why' : ''}`} title={f.note ? undefined : `${lv}. ${f.status}`} tabIndex={f.note ? 0 : undefined} aria-label={f.note ? `${lv === 'Confirmed' ? '' : lv + ' · '}${f.status.toLowerCase()}. ${f.note}` : undefined}><span aria-hidden="true">{levelInfo[lv].glyph}</span> {lv === 'Confirmed' ? '' : `${lv} · `}{f.status.toLowerCase()}{f.note && <span className="why" role="tooltip" aria-hidden="true">{f.note}</span>}</span>
                        <SourceChips ids={f.sources} openDoc={open} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="note">No facts recorded for this person.</p>}
        </Section>

        {(links.length > 0 || p.unnamedChildren) && (
          <Section title={`Immediate family (${links.length})`} open>
            <ul className="links">
              {links.map(({ label, r, o }) => (
                <li key={r.id + o}>
                  <details className="lk">
                    <summary>
                      <Dot status={r.status} level={r.level} />
                      <span className="lk-type">{label === 'Partner' ? (D.person[o].sex === 'm' ? 'Husband' : D.person[o].sex === 'f' ? 'Wife' : 'Spouse') : label}</span>
                      <button className="linkbtn" type="button" onClick={(e) => { e.preventDefault(); select(o); }}>{D.person[o].name}</button>
                      <span className={`lk-line ${lineKind(levelOf(r.status, r.level))}`} aria-hidden="true" />
                    </summary>
                    <div className="f-more">
                      <p>{r.note}</p>
                      <div className="f-meta"><Badge status={r.status} level={r.level} basis /><Sources ids={r.sources} openDoc={open} /></div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {p.unnamedChildren ? <p className="note">Not shown: {p.unnamedChildren} more children, unnamed in this pack.</p> : null}
          </Section>
        )}

        {conflicts.length > 0 && (
          <Section title={`Conflicts (${conflicts.length})`} open>
            {conflicts.map((c) => (
              <div className="conflict" key={c.id}>
                <h4>⚑ {c.topic}</h4>
                <ul className="plain">
                  {c.versions.map((v, i) => (
                    <li key={i}><span className="ver">{i + 1}. </span>{v.value}{v.status && <> <Badge status={v.status} basis /></>}{v.sources.length > 0 && <div className="src-line"><Sources ids={v.sources} openDoc={open} /></div>}</li>
                  ))}
                </ul>
                {c.sources && c.sources.length > 0 && <div className="src-line"><Sources ids={c.sources} openDoc={open} /></div>}
                <p className="note">{c.note} {c.status === 'Open' || !c.status ? <strong>Not resolved.</strong> : <strong>{c.status}.</strong>}</p>
              </div>
            ))}
          </Section>
        )}

        <Section title="How sure are we?">
          <p>{p.howSure}</p>
          {p.alsoRecordedAs && <p className="note">Confirmed by the owner as the same person, so drawn as one. The records name them separately: {p.alsoRecordedAs.map((a) => a.name).join('; ')}.</p>}
        </Section>
      </div>
    </>
  );
}
