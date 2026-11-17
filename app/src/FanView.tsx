// The Fan view: the centre person in the middle and each generation of direct ancestors in a ring around them.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { D, levelClass, levelOf } from './data';
import { buildFan, fanRadius, maxFanGens, R0, RING, type Wedge } from './fan';
import { useClickOrDouble, usePhone } from './hooks';

interface Props { centre: string; selected: string | null; select: (id: string) => void; centreOn: (id: string) => void }

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
const f = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = pt(cx, cy, r1, a0), [x1, y1] = pt(cx, cy, r1, a1), [x2, y2] = pt(cx, cy, r0, a1), [x3, y3] = pt(cx, cy, r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${f(x0)} ${f(y0)} A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)} Z`;
}
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  return `M${f(x0)} ${f(y0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
};

const yr = (s: string) => /\d{4}/.exec(s)?.[0];
function lifeSpan(id: string): string {
  const p = D.person[id], b = yr(p.birth || p.years), d = p.living ? undefined : yr(p.death);
  return b && d ? `${b}–${d}` : b ? `b. ${b}` : d ? `d. ${d}` : '';
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
/** Split a name into at most two lines of about n characters. */
function lines(name: string, n: number): string[] {
  if (name.length <= n) return [name];
  const w = name.split(' '); let a = '';
  while (w.length > 1 && (a + ' ' + w[0]).trim().length <= n) a = (a + ' ' + w.shift()).trim();
  return [clip(a || w.shift()!, n), clip(w.join(' '), n)].filter(Boolean);
}

export function FanView({ centre, selected, select, centreOn }: Props) {
  const phone = usePhone();
  const [tapWedge, doubleWedge] = useClickOrDouble(select, centreOn, !phone);
  const [wanted, setWanted] = useState<number>(() => { try { return clamp(+(localStorage.getItem('fanGens') ?? 5) || 5, 2, 10); } catch { return 5; } });
  const most = useMemo(() => maxFanGens(centre), [centre]);   // as many generations as this person has, and no empty rings beyond them
  const gens = Math.max(1, Math.min(wanted, most));
  const chooseGens = (n: number) => { setWanted(n); try { localStorage.setItem('fanGens', String(n)); } catch { /* not remembered */ } };
  const [zoom, setZoom] = useState<{ mode: 'fit' } | { mode: 'manual'; v: number }>({ mode: 'fit' });
  const [avail, setAvail] = useState({ w: 1000, h: 700 });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setAvail({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const R = fanRadius(gens), size = 2 * (R + 16), cx = size / 2, cy = size / 2;
  const fitScale = clamp(Math.min((avail.w - 24) / size, (avail.h - 24) / size), 0.35, 2.5);
  const z = zoom.mode === 'manual' ? zoom.v : fitScale;
  const zRef = useRef(z); zRef.current = z;
  const step = (d: number) => setZoom({ mode: 'manual', v: clamp(Math.round((z + d) * 20) / 20, 0.3, 2.5) });

  // Ctrl/Cmd + wheel (or a trackpad pinch) zooms; the plain wheel scrolls
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom({ mode: 'manual', v: clamp(Math.round(zRef.current * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.004)) * 100) / 100, 0.3, 2.5) });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useLayoutEffect(() => {   // keep the middle of the fan in view when the size changes
    const el = scroller.current; if (!el) return;
    el.scrollLeft = Math.max(0, (size * z - el.clientWidth) / 2); el.scrollTop = Math.max(0, (size * z - el.clientHeight) / 2);
  }, [z, size, centre]);

  const wedges = useMemo(() => buildFan(centre, gens), [centre, gens]);
  const dash = (id: string) => { const l = levelOf(D.person[id].status, D.person[id].level); return l === 'Confirmed' ? undefined : l === 'Open' ? '2 5' : '7 5'; };
  const strip = (id: string) => (D.person[id].sex === 'm' ? 'var(--c-male)' : D.person[id].sex === 'f' ? 'var(--c-female)' : 'var(--c-unknown)');
  const tint = (id: string) => (D.person[id].sex === 'm' ? 'rgba(111,168,232,.10)' : D.person[id].sex === 'f' ? 'rgba(229,143,184,.10)' : 'rgba(152,163,176,.08)');
  const key = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); }
    else if (e.key === 'c' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); centreOn(id); }
  };

  const label = (w: Wedge) => {
    const p = D.person[w.id], mid = (w.a0 + w.a1) / 2, rm = (w.r0 + w.r1) / 2, [x, y] = pt(cx, cy, rm, mid);
    const span = lifeSpan(w.id);
    if (w.gen <= 2) {
      const ls = lines(p.name, w.gen === 1 ? 12 : 14);
      return (
        <text className="fan-t" x={f(x)} y={f(y - (ls.length * 7))} textAnchor="middle">
          {ls.map((l, i) => <tspan key={i} x={f(x)} dy={i === 0 ? 0 : 15}>{l}</tspan>)}
          {span && <tspan className="fan-y" x={f(x)} dy={17}>{span}</tspan>}
        </text>
      );
    }
    const rot = mid < 180 ? mid - 90 : mid + 90;           // along the radius, upright on both halves
    const max = Math.floor((RING - 14) / 6.4);
    const ls = lines(p.short.length > 3 ? p.name : p.name, max).slice(0, w.gen >= 5 ? 1 : 2);
    return (
      <text className="fan-t" transform={`translate(${f(x)} ${f(y)}) rotate(${f(rot)})`} textAnchor="middle">
        {ls.map((l, i) => <tspan key={i} x={0} dy={i === 0 ? `${-(ls.length - 1) * 0.55 + 0.35}em` : '1.15em'}>{clip(l, max)}</tspan>)}
        {span && w.gen <= 4 && <tspan className="fan-y" x={0} dy="1.2em">{span}</tspan>}
      </text>
    );
  };

  return (
    <div className="mapwrap fanwrap">
      <div className="scroller" ref={scroller}>
        <svg className="fan" width={size * z} height={size * z} viewBox={`0 0 ${size} ${size}`} role="group" aria-label="Fan view: direct ancestors in rings around the centre person"
          style={{ display: 'block', margin: size * z < avail.w ? '0 auto' : undefined }}>
          {Array.from({ length: gens - 1 }, (_, i) => <circle key={i} cx={cx} cy={cy} r={R0 + i * RING} className="fan-guide" />)}
          <circle cx={cx} cy={cy} r={R0 + (gens - 1) * RING} className="fan-guide" />
          {wedges.map((w) => {
            const p = D.person[w.id], sel = selected === w.id, c = w.gen === 0;
            const a0 = w.a0 + (c ? 0 : 0.6), a1 = w.a1 - (c ? 0 : 0.6), r0 = w.r0 + (c ? 0 : 1.5), r1 = w.r1 - 1.5;
            const d = c ? `M${cx - r1} ${cy} a${r1} ${r1} 0 1 0 ${2 * r1} 0 a${r1} ${r1} 0 1 0 ${-2 * r1} 0` : sector(cx, cy, r0, r1, a0, a1);
            return (
              <g key={w.id + w.gen + w.slot} className={`wedge ${levelClass(levelOf(p.status, p.level))}${sel ? ' selected' : ''}${c ? ' fan-centre' : ''}`} data-id={w.id} data-gen={w.gen}
                role="button" tabIndex={0} aria-pressed={sel} aria-label={`${p.name}${c ? ' (centre)' : ''}. Open details. Double-click to make them the centre.`}
                onClick={() => tapWedge(w.id)} onDoubleClick={() => doubleWedge(w.id)} onKeyDown={(e) => key(e, w.id)}>
                <title>{`${p.name}${lifeSpan(w.id) ? ', ' + lifeSpan(w.id) : ''}`}</title>
                <path d={d} fill={tint(w.id)} stroke={sel ? 'var(--focus)' : '#5b6878'} strokeWidth={sel ? 3 : 1.5} strokeDasharray={sel ? undefined : dash(w.id)} />
                {!c && <path d={arc(cx, cy, r1 - 3, a0 + 1, a1 - 1)} stroke={strip(w.id)} strokeWidth={4} fill="none" strokeLinecap="round" />}
                {c
                  ? <text className="fan-t fan-tc" x={cx} y={cy - 4} textAnchor="middle">{lines(p.name, 14).map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : 17}>{l}</tspan>)}<tspan className="fan-y" x={cx} dy={17}>{lifeSpan(w.id)}</tspan></text>
                  : label(w)}
              </g>
            );
          })}
        </svg>
      </div>
      {most > 2 && <label className="fanctl">Generations <select value={gens} onChange={(e) => chooseGens(+e.target.value)} aria-label="Generations shown">
        {Array.from({ length: Math.max(1, most - 1) }, (_, i) => i + 2).filter((n) => n <= most).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
      <div className="zoomctl" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" onClick={() => step(-0.1)}>−</button>
        <button type="button" onClick={() => setZoom({ mode: 'fit' })} aria-pressed={zoom.mode === 'fit'}>Fit</button>
        <button type="button" aria-label="Zoom in" onClick={() => step(0.1)}>+</button>
        <span className="zoomval" aria-live="polite">{Math.round(z * 100)}%</span>
      </div>
      {phone ? null : null}
    </div>
  );
}
