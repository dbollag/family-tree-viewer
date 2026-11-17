// The Map view: every place the records connect a person to, drawn on a built-in outline map (no tiles, nothing fetched from elsewhere).
// Places come from the workbook's Places tab; borders are today's, from Natural Earth (public domain), simplified.
// Clicking a pin opens the place in the side panel (PlaceCard), the same panel the other tabs use for a person.
import { useEffect, useMemo, useRef, useState } from 'react';
import { D } from './data';
import { PLACE_GROUPS, type Place, type PlaceGroup } from './types';
import { groupOrder, itemsOf, type Item } from './placeData';
import { GroupIcon } from './GroupIcon';

interface Props { selected: string | null; place: string | null; card: boolean; setPlace: (id: string | null) => void; people: Set<string> | null; fitKey: string }   // people: only this line of the family (null: everyone)

// Web Mercator, y downwards. The outline file uses the same projection (x = longitude, y = -mercator).
const mercY = (lat: number) => -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const onMap = (p: Place) => p.lat != null && p.lon != null;   // the outline file covers North America to Siberia, so every place with coordinates is on it
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View { cx: number; cy: number; w: number }
const fit = (b: { w: number; e: number; s: number; n: number }, W: number, H: number): View => {
  const bw = b.e - b.w, bh = mercY(b.s) - mercY(b.n);
  return { cx: (b.w + b.e) / 2, cy: (mercY(b.s) + mercY(b.n)) / 2, w: Math.max(bw * 1.25, (bh * 1.25 * W) / H) };
};


const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0142/g, 'l').toLowerCase();
type Row = { pl: Place; items: Item[]; people: string[] };

export function MapView({ selected, place, card, setPlace, people: scope, fitKey }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 800, H: 520 });
  const [view, setView] = useState<View | null>(null);
  const [group, setGroup] = useState<PlaceGroup | null>(null);   // all kinds of fact, or just one
  const [q, setQ] = useState('');
  const centred = useRef<string | null>(null);   // the place the map was last centred on, so a click on a pin does not also re-centre
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const viewRef = useRef<View | null>(null); viewRef.current = view;
  const sizeRef = useRef(size); sizeRef.current = size;

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); if (r.width > 10 && r.height > 10) setSize({ W: r.width, H: r.height }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // every place with someone connected, before the filter
  const everything = useMemo(() => D.places.map((pl) => ({ pl, items: itemsOf(pl).filter((i) => !scope || scope.has(i.person)) })).filter((e) => e.items.length), [scope]);
  const counts = useMemo(() => Object.fromEntries(PLACE_GROUPS.map((g) => [g, new Set(everything.flatMap((e) => e.items.filter((i) => i.group === g).map((i) => i.person))).size])) as Record<PlaceGroup, number>, [everything]);
  const everyone = useMemo(() => new Set(everything.flatMap((e) => e.items.map((i) => i.person))).size, [everything]);

  // places that have someone linked (after the filter), biggest first
  const rows: Row[] = useMemo(() => everything.map(({ pl, items }) => {
    const mine = items.filter((i) => !group || i.group === group).sort((a, b) => groupOrder(a.group) - groupOrder(b.group));
    return { pl, items: mine, people: [...new Set(mine.map((i) => i.person))] };
  }).filter((r) => r.items.length).sort((a, b) => b.people.length - a.people.length || a.pl.name.localeCompare(b.pl.name)), [everything, group]);
  const placed = rows.filter((r) => onMap(r.pl));
  // every place the selected person is connected to; the line joins birth and death only where the record names one place for each
  const sel = useMemo(() => {
    if (!selected) return { ids: new Set<string>(), line: null as null | [Place, Place] };
    const mine = everything.filter((e) => e.items.some((i) => i.person === selected)).map((e) => e.pl);
    const own = D.places.flatMap((pl) => pl.people.filter((l) => l.person === selected).map((l) => ({ pl, l })));
    const b = own.filter((m) => m.l.kind === 'birth' && !m.l.either)[0]?.pl, d = own.filter((m) => m.l.kind === 'death' && !m.l.either)[0]?.pl;
    return { ids: new Set(mine.map((pl) => pl.id)), line: b && d && b.id !== d.id && onMap(b) && onMap(d) ? [b, d] as [Place, Place] : null };
  }, [selected, everything]);

  // first view, and again when the centre or the line of the family changes
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (size.W <= 0 || !placed.length || fitted.current === fitKey) return;
    fitted.current = fitKey;
    // everyone: open on Europe and the Near East, where most places are (the whole world is there to pan to); a narrowed line: all of its places
    const near = scope ? placed : placed.filter((r) => r.pl.lon! >= -15 && r.pl.lon! <= 45);
    const use = near.length ? near : placed;
    const lons = use.map((r) => r.pl.lon!), lats = use.map((r) => r.pl.lat!);
    const b = { w: Math.min(...lons), e: Math.max(...lons), s: Math.min(...lats), n: Math.max(...lats) };
    setView(fit(b, size.W, size.H));
  }, [fitKey, size, placed, scope]);

  // wheel zooms around the pointer
  useEffect(() => {
    const el = box.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      const v = viewRef.current; if (!v) return;
      e.preventDefault();
      const { W, H } = sizeRef.current, r = el.getBoundingClientRect();
      const mx = (e.clientX - r.left) / W, my = (e.clientY - r.top) / H;
      zoomAt(v, Math.exp(clamp(e.deltaY, -60, 60) * (e.deltaMode === 1 ? 0.05 : 0.0016)), mx, my);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const zoomAt = (v: View, f: number, mx = 0.5, my = 0.5) => {
    const { W, H } = sizeRef.current, h = (v.w * H) / W;
    const w2 = clamp(v.w * f, 0.5, 400), h2 = (w2 * H) / W;
    setView({ w: w2, cx: v.cx - v.w / 2 + mx * v.w - (mx - 0.5) * w2, cy: v.cy - h / 2 + my * h - (my - 0.5) * h2 });
  };
  const goTo = (pl: Place) => {
    const v = viewRef.current; if (!v || !onMap(pl)) return;
    setView({ cx: pl.lon!, cy: mercY(pl.lat!), w: Math.min(v.w, 12) });
  };
  const choose = (id: string) => { centred.current = id; setPlace(place === id && card ? null : id); };
  const find = (id: string) => {   // from search: show it in the panel and bring it into view
    const pl = D.places.find((p) => p.id === id); if (!pl) return;
    centred.current = id; setGroup(null); setPlace(id); goTo(pl); setQ('');
  };
  // a place named in the address (a link from the side panel, or a bookmark): centre the map on its pin
  useEffect(() => {
    if (!place || !view || centred.current === place) return;
    centred.current = place;
    const pl = D.places.find((p) => p.id === place); if (!pl) return;
    setGroup(null); goTo(pl);
  }, [place, view]);

  const down = (e: React.PointerEvent) => {
    if (!view || (e.target as Element).closest('.mp-pin')) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, v = viewRef.current; if (!d || !v) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) { d.moved = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
    const k = v.w / sizeRef.current.W;
    setView({ ...v, cx: d.cx - dx * k, cy: d.cy - dy * k });
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    const v = view; if (!v || e.target !== e.currentTarget) return;
    const s = v.w * 0.12;
    if (e.key === '+' || e.key === '=') zoomAt(v, 1 / 1.3); else if (e.key === '-') zoomAt(v, 1.3);
    else if (e.key === 'ArrowLeft') setView({ ...v, cx: v.cx - s }); else if (e.key === 'ArrowRight') setView({ ...v, cx: v.cx + s });
    else if (e.key === 'ArrowUp') setView({ ...v, cy: v.cy - s }); else if (e.key === 'ArrowDown') setView({ ...v, cy: v.cy + s });
    else return;
    e.preventDefault();
  };

  const { W, H } = size;
  const h = view ? (view.w * H) / W : 0, px = view ? W / view.w : 1;   // px: screen pixels per map unit
  const vb = view ? `${view.cx - view.w / 2} ${view.cy - h / 2} ${view.w} ${h}` : '0 0 10 10';

  // labels: biggest places first, skipping any that would sit on top of one already placed
  const labels = useMemo(() => {
    if (!view) return new Set<string>();
    const used: { x0: number; y0: number; x1: number; y1: number }[] = [], keep = new Set<string>();
    for (const r of placed) {
      const x = (r.pl.lon! - view.cx) * px + W / 2, y = (mercY(r.pl.lat!) - view.cy) * px + H / 2;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const rad = 6 + 2.4 * Math.sqrt(r.people.length), tw = r.pl.name.length * 6.6;
      const b = { x0: x + rad + 3, y0: y - 8, x1: x + rad + 3 + tw, y1: y + 8 };
      if (used.some((u) => b.x0 < u.x1 && b.x1 > u.x0 && b.y0 < u.y1 && b.y1 > u.y0)) continue;
      used.push(b, { x0: x - rad, y0: y - rad, x1: x + rad, y1: y + rad }); keep.add(r.pl.id);
    }
    return keep;
  }, [view, placed, px, W, H]);

  const hits = useMemo(() => {
    const f = fold(q.trim()); if (!f) return [];
    return everything.filter(({ pl }) => [pl.name, ...pl.also].some((n) => fold(n).includes(f))).slice(0, 8).map((e) => e.pl);
  }, [q, everything]);

  return (
    <div className="mapview">
      <div className="mp-stage" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} tabIndex={0} onKeyDown={key} role="application" aria-label="Map of places connected to people. Arrow keys move, plus and minus zoom.">
        <svg width={W} height={H} viewBox={vb} aria-hidden={false} role="group" aria-label="Map">
          <rect x={view ? view.cx - view.w / 2 : 0} y={view ? view.cy - h / 2 : 0} width={view?.w ?? 10} height={h || 10} className="mp-sea" />
          <g className="mp-land">{D.land.map((c) => <path key={c.n} d={c.d} vectorEffect="non-scaling-stroke"><title>{c.n}</title></path>)}</g>
          {sel.line && <line className="mp-trail" x1={sel.line[0].lon!} y1={mercY(sel.line[0].lat!)} x2={sel.line[1].lon!} y2={mercY(sel.line[1].lat!)} vectorEffect="non-scaling-stroke" />}
          {placed.map((r) => {
            const x = r.pl.lon!, y = mercY(r.pl.lat!), rad = (6 + 2.4 * Math.sqrt(r.people.length)) / px, maybe = r.items.every((i) => i.either);
            const hot = sel.ids.has(r.pl.id), isOpen = place === r.pl.id;
            return (
              <g key={r.pl.id} className={`mp-pin${hot ? ' mp-hot' : ''}${isOpen ? ' mp-open' : ''}${maybe ? ' mp-maybe' : ''}`} role="button" tabIndex={0}
                aria-label={`${r.pl.name}, ${r.people.length} ${r.people.length === 1 ? 'person' : 'people'}. Show what the records say.`}
                onClick={() => choose(r.pl.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(r.pl.id); } }}>
                <circle cx={x} cy={y} r={rad} vectorEffect="non-scaling-stroke" />
                {labels.has(r.pl.id) && <text x={x + rad + 3 / px} y={y} fontSize={12 / px} strokeWidth={3 / px} dominantBaseline="central" className="mp-lab">{r.pl.name}</text>}
                <title>{`${r.pl.name}: ${r.people.length}`}</title>
              </g>
            );
          })}
        </svg>

        <div className="mp-top">
          <div className="mp-find">
            <input type="search" className="mp-search" placeholder="Find a place" aria-label="Find a place" value={q} autoComplete="off"
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) find(hits[0].id); else if (e.key === 'Escape') setQ(''); e.stopPropagation(); }} />
            {hits.length > 0 && <ul className="mp-hits" aria-label="Places found">{hits.map((pl) => <li key={pl.id}><button type="button" onClick={() => find(pl.id)}>{pl.name}<span className="dim"> · {pl.country}</span></button></li>)}</ul>}
          </div>
          <div className="ev-chips mp-filters" role="group" aria-label="Show">
            <button type="button" className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>All <span>{everyone}</span></button>
            {PLACE_GROUPS.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={group === g} disabled={!counts[g]} onClick={() => setGroup(group === g ? null : g)}><GroupIcon group={g} /> {g} <span>{counts[g]}</span></button>
            ))}
          </div>
        </div>

        <div className="mp-ctl" role="group" aria-label="Map controls">
          <span className="stepper">
            <button type="button" aria-label="Zoom out" onClick={() => view && zoomAt(view, 1.4)}>−</button>
            <button type="button" aria-label="Zoom in" onClick={() => view && zoomAt(view, 1 / 1.4)}>+</button>
          </span>
        </div>
      </div>
    </div>
  );
}
