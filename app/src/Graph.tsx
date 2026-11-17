import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { D, levelClass, levelInfo, levelOf as levelOfPerson } from './data';
import type { Graph as G } from './layout';
import { relation } from './kinship';
import { LivingIcon } from './ui';
import { useClickOrDouble, usePhone, useSetting } from './hooks';

interface Props {
  g: G; start: string; selected: string | null; panelOpen: boolean;
  select: (id: string) => void; toggle: (key: string) => void; onLegend: () => void; showRelation: boolean; centreOn: (id: string) => void;
}

type Zoom = { mode: 'fit' } | { mode: 'manual'; v: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "mother" -> "Anna’s mother"; "wife of Henrik (father)" -> "wife of Henrik (Anna’s father)". */
function possessive(text: string, startShort: string): string {
  if (!text || text === 'centre') return text;
  const owner = `${startShort}’s `;
  return /\(.+\)$/.test(text) ? text.replace(/\((.+)\)$/, `(${owner}$1)`) : owner + text;
}

/** Nodes and links on the shortest visible path from the centre to the selected person (empty if none). */
function highlight(g: G, selectedId: string | null) {
  const none = { nodes: new Set<string>(), conns: new Set<string>(), active: false };
  if (!selectedId) return none;
  const target = g.nodes.find((n) => n.id === selectedId && !n.same && !n.placeholder);
  if (!target || target.key === g.centre.key) return none;
  const adj = new Map<string, { to: string; conn: string }[]>();
  for (const c of g.conns) {
    (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push({ to: c.b, conn: c.id });
    (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push({ to: c.a, conn: c.id });
  }
  const prev = new Map<string, { from: string; conn: string }>([[g.centre.key, { from: '', conn: '' }]]);
  const queue = [g.centre.key];
  while (queue.length && !prev.has(target.key)) {
    const k = queue.shift()!;
    for (const e of adj.get(k) ?? []) if (!prev.has(e.to)) { prev.set(e.to, { from: k, conn: e.conn }); queue.push(e.to); }
  }
  if (!prev.has(target.key)) return none;
  const nodes = new Set<string>(), conns = new Set<string>();
  for (let k = target.key; k; k = prev.get(k)!.from) { nodes.add(k); const c = prev.get(k)!.conn; if (c) conns.add(c); }
  for (const w of g.wires) if (w.junction && w.conns.slice(0, 2).some((c) => conns.has(c))) conns.add(w.conns[2]); // marriage line of a junction on the path
  return { nodes, conns, active: true };
}

export function Graph({ g, start, selected, panelOpen, select, toggle, onLegend, showRelation, centreOn }: Props) {
  const phone = usePhone();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>(() => (window.matchMedia('(max-width: 860px)').matches ? { mode: 'manual', v: 1 } : { mode: 'fit' }));
  const [avail, setAvail] = useState(1200);

  // A gentle hint, once: the centre box's first control pulses for a few seconds, then the box itself. Using either one
  // (clicking a control, clicking a box) ends its hint for good in this browser.
  const [tabUsed, setTabUsed] = useSetting('hintTabUsed', false);
  const [boxUsed, setBoxUsed] = useSetting('hintBoxUsed', false);
  const [stage, setStage] = useState(0);   // 0 waiting or done, 1 control, 2 box
  useEffect(() => {
    const t = [setTimeout(() => setStage(1), 1500), setTimeout(() => setStage(2), 6500), setTimeout(() => setStage(0), 11500)];
    return () => t.forEach(clearTimeout);
  }, []);
  const hintTab = stage === 1 && !tabUsed, hintBox = stage === 2 && !boxUsed;
  const tapTab = (key: string) => { setTabUsed(true); toggle(key); };
  const [tapBox, doubleBox] = useClickOrDouble((id) => { setBoxUsed(true); select(id); }, (id) => { setBoxUsed(true); centreOn(id); }, !phone);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el); setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Fit: show the centre row and the children row across the width, never below 0.8
  const fitScale = useMemo(() => {
    const rows = g.nodes.filter((n) => !n.same && (n.gen === 0 || n.gen === 1));
    const span = Math.max(...rows.map((n) => n.x + n.w)) - Math.min(...rows.map((n) => n.x)) + 88;
    return clamp(avail / span, 0.8, 1);
  }, [g, avail]);
  const z = zoom.mode === 'manual' ? zoom.v : fitScale;
  const step = (d: number) => setZoom({ mode: 'manual', v: clamp(Math.round((z + d) * 20) / 20, 0.4, 1.6) });

  // Ctrl/Cmd + mouse wheel (and a trackpad pinch) zooms the tree around the pointer; the plain wheel still scrolls it.
  const zRef = useRef(z); zRef.current = z;
  const anchor = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const st = el.querySelector<HTMLElement>('.stage'); if (!st) return;
      const r = st.getBoundingClientRect(), z0 = zRef.current;
      const nz = clamp(Math.round(z0 * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.004)) * 100) / 100, 0.4, 1.6);
      if (nz === z0) return;
      anchor.current = { cx: (e.clientX - r.left) / z0, cy: (e.clientY - r.top) / z0, px: e.clientX, py: e.clientY };
      setZoom({ mode: 'manual', v: nz });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  // Keep the centre in view when it changes; keep the selected box in view above the phone sheet.
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    if (anchor.current) {   // a wheel zoom: keep the point under the pointer where it was
      const a = anchor.current; anchor.current = null;
      const r = el.querySelector<HTMLElement>('.stage')!.getBoundingClientRect();
      el.scrollLeft += r.left + a.cx * z - a.px; el.scrollTop += r.top + a.cy * z - a.py;
      return;
    }
    // On a wide screen the box you opened is brought to the middle of the map (the centre person does not change).
    const box = !phone && selected ? el.querySelector<HTMLElement>(`.node[data-id="${selected}"]:not(.samebox)`) : null;
    if (box) {
      el.scrollLeft = 0; el.scrollTop = 0;
      const a = box.getBoundingClientRect(), b = el.getBoundingClientRect();
      el.scrollLeft = a.left + a.width / 2 - (b.left + b.width / 2);
      el.scrollTop = a.top + a.height / 2 - (b.top + b.height / 2);
      return;
    }
    el.scrollLeft = Math.max(0, (g.centre.x + g.centre.w / 2) * z - el.clientWidth / 2);
    el.scrollTop = phone && panelOpen ? Math.max(0, g.centre.y * z - 40) : 0;
  }, [g.centre.id, z, phone, panelOpen, selected, avail]);
  useLayoutEffect(() => {
    const el = scroller.current; const n = g.nodes.find((x) => x.id === selected && !x.same);
    if (!el || !n || !phone || !panelOpen) return;
    el.scrollTop = Math.max(0, n.y * z - 40);
    if (n.x * z < el.scrollLeft || (n.x + n.w) * z > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, (n.x + n.w / 2) * z - el.clientWidth / 2);
  }, [selected, phone, panelOpen]);

  const hl = useMemo(() => highlight(g, selected), [g, selected]);
  const startShort = D.person[start].short;
  const wireOn = (conns: string[]) => !hl.active || conns.some((c) => hl.conns.has(c));
  const fade = (on: boolean) => (on ? '' : ' fade');

  return (
    <div className="mapwrap">
      <div className="scroller" ref={scroller}>
        <div className="graph">
          <div className="zwrap" style={{ width: g.width * z, height: g.height * z }}>
            <div className="stage" style={{ width: g.width, height: g.height, transform: `scale(${z})`, transformOrigin: '0 0' }}>
              {g.pills.map((b, i) => <div key={i} className="couplepill" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} aria-hidden="true" />)}
              {g.bands.map((b, i) => <div key={i} className="sibband" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} aria-hidden="true" />)}
              <svg className="wires" width={g.width} height={g.height} aria-hidden="true">
                {g.wires.map((w, i) => (
                  <path key={i} d={w.d} fill="none" data-child={w.child} data-junction={w.junction ? 'true' : undefined}
                    className={`wire ${w.kind} ${levelClass(w.level)}${w.rel ? ' ' + w.rel : ''}${wireOn(w.conns) && hl.active ? ' hot' : ''}${fade(wireOn(w.conns))}`} />
                ))}
                {g.marks.map((m, i) => <g key={i} className="rings"><circle cx={m.x - 4} cy={m.y} r={6} /><circle cx={m.x + 4} cy={m.y} r={6} /></g>)}
                {g.dots.map((d) => <circle key={d.conn} cx={d.x} cy={d.y} r={4.5} className={`jdot ${levelClass(d.level)}${fade(wireOn([d.conn]))}`} />)}
              </svg>
              {g.chips.map((c, i) => c.toggleKey
                ? <button key={i} type="button" className="chip-more chip-btn" style={{ left: c.x, top: c.y, width: c.w }} onClick={() => toggle(c.toggleKey!)}>{c.text}</button>
                : <div key={i} className="chip-more" style={{ left: c.x, top: c.y, width: c.w }}>{c.text}</div>)}
              {g.sameLabels.map((l, i) => <div key={i} className="samelabel" style={{ left: l.x, top: l.y, width: l.w }}>Possibly the same person:</div>)}
              {g.nodes.map((n) => {
                const style = { left: n.x, top: n.y, width: n.w, height: n.h };
                const on = !hl.active || hl.nodes.has(n.key);
                const p = D.person[n.id!];
                const rel = n.same ? { text: 'separate record · same-person claim', conditional: false } : relation(start, n.id!);
                const relText = rel.text === 'centre' ? '' : rel.text ? possessive(rel.text, startShort) : p.unattached ? 'unattached on purpose' : '';
                const sel = selected === n.id && !n.same;
                const lv = levelOfPerson(p.status, p.level);
                return (
                  <div key={n.key} data-id={n.id} style={style} title={lv === 'Confirmed' ? undefined : `${lv}: ${p.status.toLowerCase()}`}
                    className={`node ${levelClass(lv)} sex-${p.sex ?? 'u'}${n.centre ? ' centre' : ''}${sel ? ' selected' : ''}${n.same ? ' samebox' : ''}${p.unattached ? ' unattached' : ''}${p.photo ? ' has-photo' : ''}${hintBox && n.centre ? ' hint' : ''}${fade(on)}`}>
                    <button type="button" className="nodemain" aria-pressed={sel}
                      aria-label={`${p.name}${n.centre ? ' (centre)' : ''}. Open details. Double-click to make them the centre.`} onClick={() => tapBox(n.id!)} onDoubleClick={() => doubleBox(n.id!)}>
                      {(lv === 'Probable' || lv === 'Possible') && <span className="lvmark" role="img" aria-label={lv} title={`${lv}: ${p.status.toLowerCase()}`}>{levelInfo[lv].glyph}</span>}
                      {p.photo && <img className="avatar" src={p.photo} alt="" />}
                      <span className="nm">{p.name}</span>
                      {p.living && <span className="livemark"><LivingIcon label={p.living === 'Yes' ? 'Living' : 'Possibly living'} /></span>}
                      {p.years && <span className="meta yrs" title={p.years}>{p.years}</span>}
                      {(n.partnerOf || showRelation) && <span className="meta rel">{n.partnerOf ? `${D.person[n.partnerOf].short}’s ${p.sex === 'f' ? 'wife' : p.sex === 'm' ? 'husband' : 'partner'}` : relText}</span>}
                      
                    </button>
                    {!n.same && n.canUp > 0 && (
                      <button type="button" className={`tbtn edge top${hintTab && n.centre ? ' hint' : ''}`} aria-expanded={n.upOpen} aria-label={`${n.upOpen ? 'Hide' : 'Show'} parents of ${p.short}`}
                        onClick={() => tapTab(`up:${n.id}`)}><span aria-hidden="true">{n.upOpen ? '▾' : '▴'}</span> {n.canUp} {n.canUp === 1 ? 'parent' : 'parents'}</button>
                    )}
                    {!n.same && n.canSib > 0 && (
                      <button type="button" className={`tbtn edge ${(n.sibSide ?? -1) < 0 ? 'left' : 'right'}`} aria-expanded={n.sibOpen}
                        aria-label={`${n.sibOpen ? 'Hide' : 'Show'} brothers and sisters of ${p.short}`}
                        onClick={() => tapTab(`sib:${n.id}`)}>
                        <span aria-hidden="true">{n.sibOpen === ((n.sibSide ?? -1) < 0) ? '›' : '‹'}</span> {n.canSib} {n.canSib === 1 ? 'sibling' : 'siblings'}</button>
                    )}
                    {!n.same && n.canDown > 0 && !n.coupleDown && (
                      <button type="button" className={`tbtn edge bottom${hintTab && n.centre && n.canUp === 0 ? ' hint' : ''}`} aria-expanded={n.downOpen} aria-label={`${n.downOpen ? 'Hide' : 'Show'} children of ${p.short}`}
                        onClick={() => tapTab(`down:${n.id}`)}><span aria-hidden="true">{n.downOpen ? '▴' : '▾'}</span> {n.canDown} {n.canDown === 1 ? 'child' : 'children'}</button>
                    )}
                  </div>
                );
              })}
              {g.coupleTabs.map((c) => (
                <button key={c.key} type="button" className="tbtn edge couple" style={{ left: c.x, top: c.y }} aria-expanded={c.open}
                  aria-label={`${c.open ? 'Hide' : 'Show'} children of ${c.names}`} onClick={() => tapTab(c.key)}>
                  <span aria-hidden="true">{c.open ? '▴' : '▾'}</span> {c.count} {c.count === 1 ? 'child' : 'children'}</button>
              ))}
              {g.badges.map((b, i) => (
                <span key={i} className={`linkbadge ${levelClass(b.level)}`} style={{ left: b.x, top: b.y }} title={b.title}>{b.text}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="zoomctl" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => step(-0.1)}>−</button>
        <button type="button" onClick={() => setZoom({ mode: 'fit' })} aria-pressed={zoom.mode === 'fit'}>Fit</button>
        <button type="button" aria-label="Zoom in" onClick={() => step(0.1)}>+</button>
        <span className="zoomval" aria-live="polite">{Math.round(z * 100)}%</span>
        <button type="button" className="legendbtn" aria-label="What do the lines and boxes mean?" title="What do the lines and boxes mean?" onClick={onLegend}><span aria-hidden="true">i</span></button>
      </div>
    </div>
  );
}

