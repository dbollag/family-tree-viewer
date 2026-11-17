// "Relationship to the person I started from", from the parent/partner links.
// Strict pass uses the parent links as recorded; the loose pass also treats CROSS-RECORD MATCH
// people as one, and marks the result as conditional.
import { D, other } from './data';
import type { Sex } from './types';

interface G { find: (x: string) => string; up: Record<string, Set<string>>; down: Record<string, Set<string>> }

function build(loose: boolean): G {
  const rep: Record<string, string> = {};
  const find = (x: string): string => { while (rep[x] && rep[x] !== x) x = rep[x]; return x; };
  if (loose) for (const r of D.relationships) {
    if (r.type === 'same' && r.status === 'CROSS-RECORD MATCH') { const a = find(r.a), b = find(r.b); if (a !== b) rep[b] = a; }
  }
  const up: G['up'] = {}, down: G['down'] = {};
  for (const r of D.relationships) {
    if (r.type !== 'parent') continue;
    (up[find(r.b)] ||= new Set()).add(find(r.a));
    (down[find(r.a)] ||= new Set()).add(find(r.b));
  }
  // a recorded brother or sister with no recorded parents is placed under the other's parents, for the label only
  for (const r of D.relationships) {
    if (r.type !== 'sibling') continue;
    const a = find(r.a), b = find(r.b);
    const [from, to] = up[a]?.size && !up[b]?.size ? [a, b] : up[b]?.size && !up[a]?.size ? [b, a] : [a, a];
    if (from === to) continue;
    for (const p of up[from]) { (up[to] ||= new Set()).add(p); (down[p] ||= new Set()).add(to); }
  }
  return { find, up, down };
}

function walk(g: Record<string, Set<string>>, start: string) {
  const depth: Record<string, number> = { [start]: 0 }; let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const n of frontier) for (const m of g[n] ?? []) if (!(m in depth)) { depth[m] = depth[n] + 1; next.push(m); }
    frontier = next;
  }
  return depth;
}

const greats = (n: number) => (n <= 0 ? '' : n === 1 ? 'great-' : `${n}× great-`);
const pick = (sex: Sex, m: string, f: string, n: string) => (sex === 'm' ? m : sex === 'f' ? f : n);
const ordinal = (n: number) => ['', 'first', 'second', 'third', 'fourth', 'fifth'][n] || `${n}th`;

function label(u: number, d: number, sex: Sex): string {
  if (u === 0 && d === 0) return 'centre';
  if (d === 0) return u === 1 ? pick(sex, 'father', 'mother', 'parent') : greats(u - 2) + pick(sex, 'grandfather', 'grandmother', 'grandparent');
  if (u === 0) return d === 1 ? pick(sex, 'son', 'daughter', 'child') : greats(d - 2) + pick(sex, 'grandson', 'granddaughter', 'grandchild');
  if (u === 1 && d === 1) return pick(sex, 'brother', 'sister', 'brother or sister');
  if (d === 1) return greats(u - 2) + pick(sex, 'uncle', 'aunt', 'uncle or aunt');
  if (u === 1) return greats(d - 2) + pick(sex, 'nephew', 'niece', 'nephew or niece');
  const deg = Math.min(u, d) - 1, rem = Math.abs(u - d);
  return (deg > 1 ? ordinal(deg) + ' ' : '') + 'cousin' + (rem ? `, ${rem}× removed` : '');
}

let strict: G | undefined, loose: G | undefined;
function blood(g: G, startId: string, targetId: string): { text: string; gen: number } | null {
  const s = g.find(startId), t = g.find(targetId);
  const us = walk(g.up, s), ut = walk(g.up, t);
  let best: { tot: number; u: number; d: number } | null = null;
  for (const a in us) if (a in ut) { const tot = us[a] + ut[a]; if (!best || tot < best.tot) best = { tot, u: us[a], d: ut[a] }; }
  if (best) return { text: label(best.u, best.d, D.person[targetId].sex), gen: best.d - best.u };
  const dn = walk(g.down, s);
  return t in dn ? { text: label(0, dn[t], D.person[targetId].sex), gen: dn[t] } : null;
}

/** gen: generation of the person relative to the start (negative = older); null when not connected. */
export interface Relation { text: string; conditional: boolean; gen: number | null }

export function relation(startId: string, targetId: string): Relation {
  strict ||= build(false); loose ||= build(true);
  const t = D.person[targetId];
  if (startId === targetId) return { text: 'centre', conditional: false, gen: 0 };
  const own = blood(strict, startId, targetId);
  if (own) return { text: own.text, conditional: false, gen: own.gen };
  const lo = blood(loose, startId, targetId);
  if (lo) return { text: lo.text, conditional: true, gen: lo.gen };
  for (const r of D.partnersOf[targetId] ?? []) {
    if (r.a === startId || r.b === startId) return { text: pick(t.sex, 'husband', 'wife', 'spouse'), conditional: r.status === 'PUBLISHED BIO', gen: 0 };
  }
  for (const r of D.partnersOf[targetId] ?? []) {
    const q = other(r, targetId);
    const strictB = blood(strict, startId, q);
    const b = strictB ?? blood(loose, startId, q);
    if (b) return { text: `${pick(t.sex, 'husband', 'wife', 'spouse')} of ${D.person[q].short} (${b.text})`, conditional: !strictB, gen: b.gen };
  }
  return { text: '', conditional: false, gen: null };
}
