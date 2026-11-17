import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { D, LEVELS, levelClass, matchedAlias, nameHaystack } from './data';
import { Graph } from './Graph';
import { Panel } from './Panel';
import { Viewer } from './Viewer';
import { ListView } from './ListView';
import { FanView } from './FanView';
import { MapView } from './MapView';
import { PlaceCard } from './PlaceCard';
import { lineOf } from './placeData';
import { SourcesView } from './SourcesView';
import { Feedback } from './Feedback';
import { sourceGroups, type SourceKind } from './sources';
import { buildGraph, defaultExpansion, type Graph as G } from './layout';
import { usePhone, useSetting } from './hooks';

type View = 'family' | 'fan' | 'list' | 'sources' | 'map';
interface State { view: View; centre: string; sel: string | null; doc: string | null; docFor?: string; exp: string[]; place?: string | null; pcard?: boolean; scope?: 'all' | 'up' | 'down' }   // place: the open place on the Map; pcard: it is showing in the side panel

function readHash(): State {
  const q = new URLSearchParams(location.hash.slice(1));
  const ok = (id: string | null): id is string => !!id && !!D.person[id];
  const sp = q.get('s'), cp = q.get('c'), pp = q.get('p');
  const centre = ok(cp) ? cp : ok(sp) ? sp : D.notes.defaultCentre;
  const d = q.get('d'), x = q.get('x'), m = q.get('m');
  return {
    view: q.get('v') === 'list' || q.get('v') === 'everyone' ? 'list' : q.get('v') === 'fan' ? 'fan' : q.get('v') === 'sources' ? 'sources' : q.get('v') === 'map' ? 'map' : 'family', centre, sel: ok(pp) ? pp : null,
    doc: d && D.doc[d] ? d : null, scope: q.get('ms') === 'up' ? 'up' : q.get('ms') === 'down' ? 'down' : 'all', place: m && D.places.some((p) => p.id === m) ? m : null, pcard: !!m && D.places.some((p) => p.id === m), exp: x != null ? x.split(',').filter(Boolean) : defaultExpansion(centre)
  };
}
function hashOf(s: State) {
  const q = new URLSearchParams({ v: s.view, c: s.centre, p: s.sel ?? '', x: s.exp.join(',') });
  if (s.doc) q.set('d', s.doc);
  if (s.view === 'map' && s.place && s.pcard) q.set('m', s.place);
  if (s.view === 'map' && s.scope && s.scope !== 'all') q.set('ms', s.scope);
  return '#' + q.toString();
}
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function CentrePicker({ label, value, pick }: { label: string; value: string; pick: (id: string) => void }) {
  const [typed, setTyped] = useState<string | null>(null);   // null: showing the current person's name, not a search
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const hits = useMemo(() => {
    const f = fold((typed ?? '').trim());
    const pool = D.people.filter((p) => !p.unattached || p.id === value);   // records not yet placed stay out of the list
    return f ? pool.filter((p) => nameHaystack(p).includes(f)) : pool;
  }, [typed, value]);
  const start = () => { setTyped(null); setOpen(true); setI(Math.max(0, hits.findIndex((p) => p.id === value))); };
  const choose = (id: string) => { pick(id); setOpen(false); setTyped(null); (document.activeElement as HTMLElement | null)?.blur(); };
  useEffect(() => { if (open) list.current?.querySelector('li.cur')?.scrollIntoView({ block: 'nearest' }); }, [open, i]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setTyped(null); e.stopPropagation(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) start(); else setI((n) => Math.min(hits.length - 1, n + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    else if (e.key === 'Enter' && open && hits[i]) { e.preventDefault(); choose(hits[i].id); }
  };
  return (
    <div className="startpick pick">
      <span>{label}…</span>
      <div className="pick">
        <input id="centre" type="text" role="combobox" aria-label={label} aria-expanded={open} aria-controls="centre-list" aria-autocomplete="list" autoComplete="off"
          value={typed ?? D.person[value].name}
          onFocus={(e) => { start(); e.currentTarget.select(); }}
          onClick={() => { if (!open) start(); }}
          onBlur={() => { setOpen(false); setTyped(null); }}
          onChange={(e) => { setTyped(e.target.value); setI(0); setOpen(true); }} onKeyDown={onKey} />
        {open && (
          <ul id="centre-list" className="results" role="listbox" ref={list}>
            {hits.length === 0 && <li className="none">Not found</li>}
            {hits.map((p, n) => (
              <li key={p.id} data-id={p.id} role="option" aria-selected={p.id === value} className={`${n === i ? 'cur' : ''}${p.id === value ? ' now' : ''}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p.id)}>
                  <strong>{p.name}</strong> <span className="dim">{p.years}</span>{typed && matchedAlias(p, typed) && <span className="dim"> · also known as {matchedAlias(p, typed)}</span>}{p.unattached && <span className="dim"> · unattached</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Settings({ close, showSiblings, setShowSiblings, showRelation, setShowRelation }: {
  close: () => void; showSiblings: boolean; setShowSiblings: (on: boolean) => void; showRelation: boolean; setShowRelation: (on: boolean) => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [close]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-h" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog settings">
        <h2 id="settings-h">Settings</h2>
        <label className="check">
          <input type="checkbox" checked={showSiblings} onChange={(e) => setShowSiblings(e.target.checked)} />
          <span><strong>Show brothers and sisters</strong><br /><span className="dim">Turn off to leave siblings out of the tree, including aunts, uncles and their chips.</span></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={showRelation} onChange={(e) => setShowRelation(e.target.checked)} />
          <span><strong>Show each person’s relation to the centre</strong><br /><span className="dim">The small line on each box, such as “Anna’s father”. Off by default; the side panel always says it.</span></span>
        </label>
        <button type="button" className="btn" autoFocus onClick={close}>Close</button>
      </div>
    </div>
  );
}

const SHORT: Record<string, string> = {
  Confirmed: 'A record states it, or the owner confirmed it.',
  Probable: 'Strongly supported, but it rests on a match, an index entry or family information.',
  Possible: 'Plausible but thin, or from a published biography alone.',
  Open: 'Not settled.'
};

function HowTo({ close }: { close: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [close]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="howto-h" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog legenddlg">
        <h2 id="howto-h">What the lines and boxes mean</h2>
        <p className="dim">Boxes show how sure we are of the person; lines show how sure we are of the link.</p>
        <p className="dim">A small mark in the corner of a box means we are less sure of the person: ◆ probable, ▲ possible. No mark means confirmed.</p>
        <dl className="lglist">{LEVELS.map((l) => (
          <div key={l.id}>
            <dt>
              <svg className="swatch" width="34" height="8" viewBox="0 0 34 8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" className={`${l.line} ${levelClass(l.id)}`} /></svg>
              <span className={`badge ${levelClass(l.id)}`}><span className="glyph" aria-hidden="true">{l.glyph}</span> {l.id}</span>
            </dt>
            <dd>{SHORT[l.id]}</dd>
          </div>))}
        </dl>
        <button type="button" className="btn" autoFocus onClick={close}>Close</button>
      </div>
    </div>
  );
}

export function App() {
  const [st, setSt] = useState<State>(readHash);
  const [howto, setHowto] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ about: { id: string; name: string } | null } | null>(null);   // open, and about whom
  const feedbackOpen = feedback !== null;
  const aboutPerson = (id: string | null) => (id && D.person[id] ? { id, name: D.person[id].name } : null);
  const [showSiblings, chooseSiblings] = useSetting('showSiblings', true);
  const [showRelation, chooseRelation] = useSetting('showRelation', false);
  const phone = usePhone();

  // Keep the address in step with the state, but only for changes the app itself makes: a state read from the address
  // (a link followed, Back, a hand edit) is never written back, so a stale state can never overwrite a newer address.
  const lastSt = useRef<State | null>(null);
  const fromAddress = useRef(false);
  useEffect(() => {
    if (lastSt.current === st) return;
    const first = lastSt.current === null;
    lastSt.current = st;
    if (first || fromAddress.current) { fromAddress.current = false; return; }
    const h = hashOf(st); if (location.hash !== h) history.replaceState(null, '', h);
  }, [st]);
  useEffect(() => {
    const f = () => setSt((prev) => { const next = readHash(); if (hashOf(prev) === hashOf(next)) return prev; fromAddress.current = true; return next; });
    window.addEventListener('hashchange', f); f();   // f() once: the address may have changed between the first render and now
    return () => window.removeEventListener('hashchange', f);
  }, []);

  const g = useMemo(() => buildGraph(st.centre, new Set(st.exp), { siblings: showSiblings }), [st.centre, st.exp, showSiblings]);

  // Change the centre of the map (breadcrumbs grow; expansion resets to the default for the new centre).
  const centreOn = useCallback((id: string, keepView = false) => setSt((s) => (
    { ...s, view: keepView ? s.view : 'family', centre: id, exp: defaultExpansion(id), sel: s.sel && !phone ? id : null }
  )), [phone]);
  const select = useCallback((id: string) => setSt((s) => ({ ...s, sel: id, pcard: false })), []);
  const toggle = useCallback((key: string) => setSt((s) => ({ ...s, exp: s.exp.includes(key) ? s.exp.filter((k) => k !== key) : [...s.exp, key] })), []);
  const setPlace = useCallback((place: string | null) => setSt((s) => ({ ...s, place, pcard: !!place })), []);
  // from a fact or the Places line in a person's panel: the Map tab, centred on that place, with the place in the side panel
  const showOnMap = useCallback((place: string) => setSt((s) => ({ ...s, view: 'map', place, pcard: true })), []);
  const backToPlace = useCallback(() => setSt((s) => ({ ...s, pcard: true })), []);
  const setView = (view: View) => setSt((s) => ({ ...s, view }));
  const closePanel = () => setSt((s) => ({ ...s, sel: null, pcard: false, place: s.view === 'map' ? null : s.place }));

  const cardShown = st.view === 'map' && !!st.pcard && !!st.place;
  const openDoc = useCallback((docId: string, personId: string) => setSt((s) => ({ ...s, doc: docId, docFor: personId })), []);
  const docFor = st.docFor ?? st.sel ?? st.centre;
  const [srcFilter, setSrcFilter] = useState<{ kind: SourceKind; q: string; person: string | null }>({ kind: 'all', q: '', person: null });
  const fromSources = st.view === 'sources' && !st.docFor;
  const docList = useMemo(() => {
    if (!st.doc) return [];
    const opened = D.doc[st.doc];
    const l = (fromSources ? sourceGroups(srcFilter.kind, srcFilter.q, srcFilter.person, st.centre).flatMap((g) => g.docs) : D.documents.filter((d) => d.persons.includes(docFor) && !!d.isPhoto === !!opened?.isPhoto)).map((d) => d.id);   // stepping stays within documents, or within photographs
    return l.includes(st.doc) ? l : [st.doc];
  }, [st.doc, docFor, fromSources, srcFilter, st.centre]);
  const openPerson = useCallback((id: string) => setSt((s) => ({ ...s, doc: null, docFor: undefined, sel: id })), []);
  const onDocChange = useCallback((id: string) => setSt((s) => (s.doc === id ? s : { ...s, doc: id })), []);
  const closeDoc = useCallback(() => setSt((s) => ({ ...s, doc: null })), []);

  // Escape closes the side panel (the viewer and the dialogs handle their own Escape first)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || st.doc || settingsOpen || howto || feedbackOpen || !(st.sel || cardShown)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (t?.closest('.node')) t.blur();   // the box you clicked keeps keyboard focus, which would still draw a ring round it
      closePanel();
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });

  const gens = generationControls(g, st.exp, setSt);
  const everyone = st.view === 'list';

  // on the Map, "Centre on" narrows the places to one line of the family: that person and their ancestors, or their descendants
  const scope = st.scope ?? 'all';
  const mapPeople = useMemo(() => (scope === 'all' ? null : lineOf(st.centre, scope)), [scope, st.centre]);
  const scopeCtl = (
    <span className="gb-group"><span className="gb-lab">Show</span>
      <span className="ev-chips mp-scope" role="group" aria-label="Which part of the family">
        {([['all', 'Everyone'], ['up', 'Ancestors'], ['down', 'Descendants']] as const).map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={scope === v} onClick={() => setSt((s) => ({ ...s, scope: v }))}>{label}</button>
        ))}
      </span></span>
  );
  const picker = <CentrePicker label="Centre on" value={st.centre} pick={(id) => centreOn(id, true)} />;
  const stepper = (what: 'ancestors' | 'descendants', canLess: boolean, canMore: boolean, less: () => void, more: () => void) => (
    <span className="gb-group"><span className="gb-lab">{what === 'ancestors' ? 'Ancestors' : 'Descendants'}</span>
      <span className="stepper">
        <button type="button" disabled={!canLess} aria-label={`Fewer ${what}`} title={`Show one generation fewer of ${what}`} onClick={less}>−</button>
        <button type="button" disabled={!canMore} aria-label={`More ${what}`} title={`Show one generation more of ${what}`} onClick={more}>+</button>
      </span></span>
  );
  const genControls = (
    <div className="genbar" role="group" aria-label="Generations shown">
      {stepper('ancestors', gens.upFewer, gens.upMore, gens.upFewerGo, gens.upMoreGo)}
      {stepper('descendants', gens.downFewer, gens.downMore, gens.downFewerGo, gens.downMoreGo)}
      <button type="button" className="resetbtn" title="Close everything that is open and show only the centre and their partner" onClick={() => setSt((s) => ({ ...s, exp: defaultExpansion(s.centre) }))}><span aria-hidden="true">↺</span> Reset</button>
    </div>
  );

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Sample family tree</h1>
        </div>
        <nav className="tabs" aria-label="Views">
          {(['Tree', 'Fan', 'Map', 'List', 'Sources'] as const).map((t) => {
            const v: View = t === 'List' ? 'list' : t === 'Fan' ? 'fan' : t === 'Map' ? 'map' : t === 'Sources' ? 'sources' : 'family';
            return <button key={t} type="button" className={`tab${st.view === v ? ' on' : ''}`} aria-current={st.view === v ? 'page' : undefined} onClick={() => setView(v)}>{t}</button>;
          })}
        </nav>
        <button type="button" className="btn feedbackbtn" aria-haspopup="dialog" aria-label="Feedback: flag a mistake, confirm a fact, or share more information" title="Flag a mistake, confirm a fact, or share more information" onClick={() => setFeedback({ about: aboutPerson(st.sel) })}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2.5h12v8H8l-3.5 3v-3H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
        {st.view === 'family' && <button type="button" className="btn settingsbtn" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>Settings</button>}
      </header>

      <div className="bar">
        <div className="bar-actions">
          {phone
            ? <details className="changeview"><summary className="btn">Change view</summary>{picker}{st.view === 'family' && genControls}{st.view === 'map' && scopeCtl}</details>
            : <>{picker}{st.view === 'family' && genControls}{st.view === 'map' && scopeCtl}</>}
        </div>
      </div>

      <main className={`main${st.sel || cardShown ? ' panel-open' : ''}`}>
        {everyone
          ? <ListView start={st.centre} selected={st.sel} select={select} centreOn={(id) => centreOn(id, true)} />
          : st.view === 'sources'
          ? <SourcesView centre={st.centre} kind={srcFilter.kind} q={srcFilter.q} person={srcFilter.person} showPerson={select} setPerson={(person) => setSrcFilter((f) => ({ ...f, person }))} setKind={(kind) => setSrcFilter((f) => ({ ...f, kind }))} setQ={(q) => setSrcFilter((f) => ({ ...f, q }))} open={(id) => setSt((x) => ({ ...x, doc: id, docFor: undefined }))} />
          : st.view === 'map'
          ? <MapView selected={st.sel} place={st.place ?? null} card={cardShown} setPlace={setPlace} people={mapPeople} fitKey={`${st.centre}|${scope}`} />
          : st.view === 'fan'
          ? <FanView centre={st.centre} selected={st.sel} select={select} centreOn={(id) => centreOn(id, true)} />
          : <Graph onLegend={() => setHowto(true)} g={g} start={st.centre} selected={st.sel} panelOpen={!!st.sel} select={select} toggle={toggle} showRelation={showRelation} centreOn={(id) => centreOn(id, true)} />}
        {cardShown && D.places.some((p) => p.id === st.place) && (
          <aside className="panel" aria-label="This place">
            <PlaceCard place={D.places.find((p) => p.id === st.place)!} close={closePanel} select={select} />
          </aside>
        )}
        {!cardShown && st.sel && (
          <aside className="panel" aria-label="Their story">
            <Panel id={st.sel} start={st.centre} close={closePanel} select={select} openDoc={openDoc} feedback={() => setFeedback({ about: aboutPerson(st.sel) })} showOnMap={showOnMap}
              back={st.view === 'map' && st.place ? { label: D.places.find((p) => p.id === st.place)?.name ?? 'the place', go: backToPlace } : undefined} />
          </aside>
        )}
      </main>

      {feedback && <Feedback about={feedback.about} view={st.view} close={() => setFeedback(null)} />}
      {howto && <HowTo close={() => setHowto(false)} />}
      {settingsOpen && <Settings close={() => setSettingsOpen(false)} showSiblings={showSiblings} setShowSiblings={chooseSiblings} showRelation={showRelation} setShowRelation={chooseRelation} />}
      {st.doc && <Viewer list={docList} startId={st.doc} backTo={fromSources ? 'Sources' : D.person[docFor]?.name ?? 'the tree'} onPerson={openPerson} onChange={onDocChange} onClose={closeDoc} />}
    </div>
  );
}

/** Fewer / more generations above and below the centre, one row at a time. */
function generationControls(g: G, exp: string[], setSt: React.Dispatch<React.SetStateAction<State>>) {
  const real = g.nodes.filter((n) => !n.same && n.gen !== 99);
  const minGen = Math.min(...real.map((n) => n.gen)), maxGen = Math.max(...real.map((n) => n.gen));
  const withKey = (kind: string, pred: (n: (typeof real)[number]) => boolean) => real.filter(pred).map((n) => `${kind}:${n.id}`);
  const upFewer = withKey('up', (n) => n.gen === minGen + 1 && n.upOpen && n.canUp > 0 && minGen < 0);
  const upMore = withKey('up', (n) => n.gen === minGen && n.canUp > 0 && !n.upOpen);
  const downFewer = withKey('down', (n) => n.gen === maxGen - 1 && n.downOpen && n.canDown > 0 && maxGen > 0);
  const downMore = withKey('down', (n) => n.gen === maxGen && n.canDown > 0 && !n.downOpen);
  const drop = (keys: string[], also: string[] = []) => setSt((s) => ({ ...s, exp: s.exp.filter((k) => !keys.includes(k) && !also.includes(k)) }));
  const add = (keys: string[]) => setSt((s) => ({ ...s, exp: [...new Set([...s.exp, ...keys])] }));
  void exp;
  return {
    upFewer: upFewer.length > 0, upMore: upMore.length > 0, downFewer: downFewer.length > 0, downMore: downMore.length > 0,
    upFewerGo: () => drop(upFewer, upFewer.map((k) => k.replace('up:', 'sib:'))),
    upMoreGo: () => add(upMore), downFewerGo: () => drop(downFewer), downMoreGo: () => add(downMore)
  };
}
