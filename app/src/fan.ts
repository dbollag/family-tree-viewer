// Pure layout for the Fan view: the centre person in the middle, each generation of direct ancestors in a ring around them.
// Reading clockwise from the top: the father's line first (right half), then the mother's (left half); unknown ancestors leave an empty wedge (never a labelled box).
import { D } from './data';
import { parentRels } from './layout';

export interface Wedge { id: string; gen: number; slot: number; a0: number; a1: number; r0: number; r1: number }

export const R0 = 70, RING = 92;
export const fanRadius = (gens: number) => R0 + (gens - 1) * RING;

/** Father and mother of someone, by recorded sex (a parent of unstated sex fills whichever slot is free). */
export function fanParents(id: string): [string | null, string | null] {
  const ps = parentRels(id).map((r) => r.a);
  let father = ps.find((p) => D.person[p].sex === 'm') ?? null;
  let mother = ps.find((p) => D.person[p].sex === 'f' && p !== father) ?? null;
  for (const p of ps) {
    if (p === father || p === mother) continue;
    if (!father) father = p; else if (!mother) mother = p;
  }
  return [father, mother];
}

/** Angles in degrees, 0 = straight up, clockwise. Generation g has 2^g wedges of 360 / 2^g degrees; the centre is generation 0. */
export function buildFan(centre: string, gens: number): Wedge[] {
  const out: Wedge[] = [];
  const walk = (id: string, gen: number, slot: number) => {
    const span = 360 / 2 ** gen;
    const a0 = slot * span;
    out.push({ id, gen, slot, a0: gen === 0 ? 0 : a0, a1: gen === 0 ? 360 : a0 + span, r0: gen === 0 ? 0 : R0 + (gen - 1) * RING, r1: gen === 0 ? R0 : R0 + gen * RING });
    if (gen >= gens - 1) return;
    const [f, m] = fanParents(id);
    if (f) walk(f, gen + 1, slot * 2);
    if (m) walk(m, gen + 1, slot * 2 + 1);
  };
  walk(centre, 0, 0);
  return out;
}

/** How many generations the fan can show for this centre: the centre alone is 1, with parents 2, and so on up the longest line. */
export function maxFanGens(centre: string, cap = 10): number {
  const depth = (id: string, seen: Set<string>): number => {
    if (seen.size >= cap) return 1;
    const [f, m] = fanParents(id);
    const next = new Set(seen).add(id);
    return 1 + Math.max(0, ...[f, m].filter((x): x is string => !!x && !next.has(x)).map((x) => depth(x, next)));
  };
  return Math.min(cap, depth(centre, new Set()));
}
