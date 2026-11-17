// Pure layout for the Family view. One centre person; ancestors above and descendants below can each be
// expanded or collapsed, person by person. Returns positioned boxes, wires and link badges; React only draws them.
import { D, other, birthYear, levelOf, lineKind } from './data';
import type { Level, Rel } from './types';

export const W = 176, H = 120, CW = 196, CH = 128, GX = 32, GY = 84, PAIR = 72, PG = 72, MAXSIB = 3, MORE_W = 96, COUPLE = 2 * W + PAIR;

export interface GNode {
  key: string; gen: number; x: number; y: number; w: number; h: number; same?: Rel; slot?: Rel; centre?: boolean;
  id?: string; placeholder?: boolean; role?: string; of?: string;
  canUp: number; upOpen: boolean; frontierNoParents?: boolean; canSib: number; sibOpen: boolean; sibSide?: -1 | 1; canDown: number; downOpen: boolean; coupleDown?: boolean; partnerOf?: string;
}
export interface CoupleTab { x: number; y: number; count: number; open: boolean; key: string; names: string }
export interface Wire { d: string; kind: string; level: Level; conns: string[]; child?: string; junction?: boolean; rel?: 'partner' | 'sibling' }
export interface Mark { x: number; y: number }
export interface Dot { x: number; y: number; level: Level; conn: string }
export interface Conn { id: string; a: string; b: string }
export interface LinkBadge { x: number; y: number; level: Level; text: string; title: string }
export interface Chip { gen: number; text: string; x: number; y: number; w: number; toggleKey?: string }
export interface Band { x: number; y: number; w: number; h: number }
export interface Graph {
  pills: Band[]; marks: Mark[]; coupleTabs: CoupleTab[]; bands: Band[]; nodes: GNode[]; wires: Wire[]; badges: LinkBadge[]; dots: Dot[]; conns: Conn[]; chips: Chip[]; rowLabels: { text: string; y: number }[];
  width: number; height: number; centre: GNode; sameLabels: { x: number; y: number; w: number }[];
}

interface Slot { id?: string; rel?: Rel; placeholder?: boolean; role?: string; of?: string }
interface Tree {
  node: GNode; kids: Tree[]; w: number;
  // ancestor trees only: room for siblings on one side, so neighbouring branches never overlap
  span?: number; leftPad?: number; kidsTotal?: number; gap?: number; forest?: Tree[]; side?: -1 | 1; moreSibs?: number; partner?: GNode; partnerRel?: Rel;
}

/** The default expansion for a centre: nothing opened, so the map shows the centre person and their partner; the edge buttons open more. */
export function defaultExpansion(_c: string): string[] {
  return [];
}

/** People the records say are probably the same person (CROSS-RECORD MATCH). */
const matchedOf = (id: string) => (D.sameOf[id] ?? []).filter((r) => r.status === 'CROSS-RECORD MATCH').map((r) => other(r, id));
const weaker = (l: Level): Level => (l === 'Confirmed' ? 'Probable' : l);
/** Recorded parents, plus the parents of a matched person, whose links are never stronger than Probable. */
export function parentRels(id: string): Rel[] {
  const direct = D.parentsOf[id] ?? [], out = [...direct];
  for (const m of matchedOf(id)) for (const r of D.parentsOf[m] ?? []) {
    if (!out.some((d) => d.a === r.a)) out.push({ ...r, b: id, level: weaker(levelOf(r.status, r.level)) });
  }
  return out;
}

function parentSlots(id: string): Slot[] {
  const maleFirst = (a: Rel) => (D.person[a.a].sex === 'm' ? 0 : 1);
  const real: Slot[] = parentRels(id).slice().sort((a, b) => maleFirst(a) - maleFirst(b)).map((r) => ({ id: r.a, rel: r }));
  return real.slice(0, 2);
}

const genName = (g: number) => {
  if (g === 0) return 'SIBLINGS · PARTNER';
  if (g === -1) return 'PARENTS';
  if (g === -2) return 'GRANDPARENTS';
  if (g < 0) return `${g === -3 ? '' : `${-g - 2}× `}GREAT-GRANDPARENTS`;
  if (g === 1) return 'CHILDREN';
  if (g === 2) return 'GRANDCHILDREN';
  return `${g === 3 ? '' : `${g - 2}× `}GREAT-GRANDCHILDREN`;
};

export function buildGraph(c: string, exp: ReadonlySet<string>, opts: { siblings?: boolean } = {}): Graph {
  const withSiblings = opts.siblings !== false;
  const nodes: GNode[] = [], chipRaw: Omit<Chip, 'y'>[] = [];
  const add = (n: Partial<GNode> & { key: string; gen: number }): GNode => {
    const g: GNode = { x: 0, y: 0, w: W, h: H, canUp: 0, upOpen: false, canSib: 0, sibOpen: false, canDown: 0, downOpen: false, ...n }; nodes.push(g); return g;
  };
  const real = (id: string) => parentRels(id).length;
  // the children of a matched parent count as brothers and sisters too
  const matched = matchedOf;
  const sibsOf = (id: string): string[] => !withSiblings ? [] : [...new Set([...parentRels(id).flatMap((r) => [r.a, ...matched(r.a)].flatMap((q) => (D.childrenOf[q] ?? []).map((x) => x.b))), ...(D.siblingOf[id] ?? []).map((r) => other(r, id))])]
    .filter((x) => x !== id && !matched(id).includes(x)).sort((a, b) => birthYear(D.person[a]) - birthYear(D.person[b]));
  const sibLinks: { t: Tree; sib: GNode }[] = [];
  const sibForests: Tree[] = [];

  // ---- descendants (also used for the children of siblings: nephews, nieces, cousins)
  const down = (id: string, gen: number, rel: Rel | undefined, existing: GNode | undefined, prefix = 'd'): Tree => {
    const kidsRels = (D.childrenOf[id] ?? []).slice().sort((a, b) => birthYear(D.person[a.b]) - birthYear(D.person[b.b]));
    const node = existing ?? add({ key: `${prefix}:${id}`, id, gen, slot: rel });
    node.canDown = kidsRels.length;
    node.downOpen = kidsRels.length > 0 && exp.has(`down:${id}`);
    const kids = node.downOpen ? kidsRels.map((r) => down(r.b, gen + 1, r, undefined, prefix)) : [];
    // a partner who is not drawn elsewhere stands beside the person, so the couple and their children are visible
    let partner: GNode | undefined, partnerRel: Rel | undefined;
    if (id !== c) {
      const cands = (D.partnersOf[id] ?? []).filter((r) => !nodes.some((n) => n.id === other(r, id) && !n.same));
      partnerRel = cands.find((r) => kidsRels.some((k) => (D.parentsOf[k.b] ?? []).some((q) => q.a === other(r, id)))) ?? cands[0];
      if (partnerRel) { const pidd = other(partnerRel, id); partner = add({ key: `${prefix}~${pidd}`, id: pidd, gen, partnerOf: id }); }
    }
    const kw = kids.length ? kids.reduce((s, k) => s + k.w, 0) + (kids.length - 1) * GX : 0;
    const w = Math.max(kw, partner ? COUPLE : W);
    return { node, kids, w, partner, partnerRel };
  };
  const placeDown = (t: Tree, centreX: number) => {
    if (t.partner) { t.node.x = centreX - COUPLE / 2; t.partner.x = t.node.x + W + PAIR; }
    let x = centreX - (t.kids.reduce((s, k) => s + k.w, 0) + Math.max(0, t.kids.length - 1) * GX) / 2;
    for (const k of t.kids) { k.node.x = x + (k.w - W) / 2; placeDown(k, x + k.w / 2); x += k.w + GX; }
  };

  // ---- ancestors
  const up = (id: string, gen: number, depth: number, rel?: Rel, side: -1 | 1 = -1): Tree => {
    const centre = depth === 0;
    const node = add({ key: `p:${id}`, id, gen, slot: rel, centre, ...(centre ? { w: CW, h: CH } : {}) });
    const slots = parentSlots(id);
    node.canUp = real(id);
    node.upOpen = node.canUp > 0 && exp.has(`up:${id}`);
    node.frontierNoParents = depth >= 2 && node.canUp === 0 && !D.person[id].unattached;
    node.canSib = node.canUp > 0 ? sibsOf(id).length : 0;
    node.sibOpen = node.canSib > 0 && exp.has(`sib:${id}`);
    node.sibSide = side;
    const kids: Tree[] = [];
    if (node.upOpen) {
      let k = 0;
      for (const s of slots) {
        kids.push(up(s.id!, gen - 1, depth + 1, s.rel, k === 0 ? -1 : 1));
        k++;
      }
    }
    const gap = kids.every((x) => !x.kids.length) ? PAIR : 40;
    const kidsTotal = kids.length ? kids.reduce((sum, x) => sum + x.w, 0) + (kids.length - 1) * gap : 0;
    const span = Math.max(kidsTotal, node.w);
    let leftPad = 0, rightPad = 0, moreSibs = 0, forest: Tree[] | undefined;
    if (node.sibOpen) {
      const all = sibsOf(id);
      // the centre's own brothers and sisters: first few, then a "+N more" chip
      const shown = centre && !exp.has(`sibmore:${id}`) ? all.slice(0, MAXSIB) : all;
      moreSibs = all.length - shown.length;
      forest = shown.map((sid) => down(sid, gen, undefined, undefined, `sb${id}`));
      const sibW = forest.reduce((sum, f) => sum + f.w + GX, 0) + (moreSibs ? MORE_W + GX : 0);
      const room = (span - node.w) / 2;
      if (side < 0) leftPad = Math.max(0, sibW - room); else rightPad = Math.max(0, sibW - room);
    }
    return { node, kids, w: leftPad + span + rightPad, span, leftPad, kidsTotal, gap, forest, side, moreSibs };
  };
  const root = up(c, 0, 0);
  const cn = root.node;

  const place = (t: Tree, left: number) => {
    const span = t.span ?? t.node.w, kidsTotal = t.kidsTotal ?? 0, gap = t.gap ?? 0;   // placeholders carry no padding
    const spanLeft = left + (t.leftPad ?? 0);
    t.node.x = spanLeft + (span - t.node.w) / 2;
    let x = spanLeft + (span - kidsTotal) / 2;
    for (const k of t.kids) { place(k, x); x += k.w + gap; }
    if (t.forest) {
      const leftSide = (t.side ?? -1) < 0;
      let cursor = leftSide ? t.node.x - GX : t.node.x + t.node.w + GX;
      for (const f of leftSide ? [...t.forest].reverse() : t.forest) {   // eldest leftmost, so the row reads in birth order
        const x0 = leftSide ? cursor - f.w : cursor;
        f.node.x = x0 + (f.w - W) / 2; placeDown(f, x0 + f.w / 2);
        cursor = leftSide ? x0 - GX : x0 + f.w + GX;
        sibLinks.push({ t, sib: f.node }); sibForests.push(f);
      }
      if (t.moreSibs) chipRaw.push({ gen: t.node.gen, text: `+${t.moreSibs} more`, x: leftSide ? cursor - MORE_W : cursor, w: MORE_W, toggleKey: `sibmore:${t.node.id}` });
    }
  };
  place(root, 0);

  // ---- partners of the centre
  let px = cn.x + CW + PG;
  const partnerNodes = (D.partnersOf[c] ?? []).map((r) => {
    const id = other(r, c); const n = add({ key: `s:${id}`, id, gen: 0, partnerOf: c }); n.x = px; px += W + PG; return { r, id, n };
  });

  // ---- descendants of the centre
  const dRoot = down(c, 0, undefined, cn);
  const coPartner = partnerNodes.find((p) => dRoot.kids.some((k) => (D.parentsOf[k.node.id!] ?? []).some((q) => q.a === p.id)));
  const kidMid = coPartner ? (cn.x + CW / 2 + coPartner.n.x + W / 2) / 2 : cn.x + CW / 2;
  placeDown(dRoot, kidMid);
  const kw = dRoot.kids.reduce((s, k) => s + k.w, 0) + Math.max(0, dRoot.kids.length - 1) * GX;
  if (D.person[c].unattached && !(D.parentsOf[c]?.length || D.childrenOf[c]?.length || D.partnersOf[c]?.length)) chipRaw.push({ gen: 0, text: 'Unattached on purpose: the pack cannot assign this person to a household, so no parent, partner or child link is drawn.', x: cn.x + CW + 40, w: 300 });
  const unnamed = D.person[c].unnamedChildren;
  if (unnamed && cn.downOpen) chipRaw.push({ gen: 1, text: `+${unnamed} more children: not named in the pack`, x: kidMid + kw / 2 + GX, w: W });

  // ---- row y positions
  const gens = [...new Set([...nodes.map((n) => n.gen), ...chipRaw.map((ch) => ch.gen)])].sort((a, b) => a - b);
  // when the top row has parents still to open, leave an empty row above it: the centre sits lower and the ancestors open into view
  let roomAbove = false;
  const topGen = Math.min(...nodes.filter((n) => !n.same).map((n) => n.gen));
  if (nodes.some((n) => !n.same && n.gen === topGen && n.canUp > 0 && !n.upOpen)) { gens.unshift(topGen - 1); roomAbove = true; }
  const ys = new Map<number, number>(); let y = roomAbove ? 110 : 0;   // a row and a half of room above the centre
  gens.forEach((g) => { ys.set(g, y); y += CH + GY; });
  for (const n of nodes) n.y = ys.get(n.gen)! + (n.centre ? 0 : (CH - n.h) / 2);
  const rowLabels = gens.map((g) => ({ text: genName(g), y: ys.get(g)! + CH / 2 }));
  const chips: Chip[] = chipRaw.map((ch) => ({ ...ch, y: ys.get(ch.gen)! + 18 }));

  // ---- same-person strip (claims kept separate, never merged)
  const sameLabels: Graph['sameLabels'] = [];
  const badgesLate: LinkBadge[] = [];
  const sames = (D.sameOf[c] ?? []).map((r) => ({ r, id: other(r, c) }));
  if (sames.length) {
    const sameY = y - GY + 84;
    const total = sames.length * W + (sames.length - 1) * GX;
    sames.forEach((s, i) => {
      const n = add({ key: `same:${s.id}`, id: s.id, gen: 99, same: s.r, h: 108 });
      n.x = cn.x + CW / 2 - total / 2 + i * (W + GX); n.y = sameY;
      const lv = levelOf(s.r.status, s.r.level);
      sameLabels.push({ x: n.x, y: n.y - 22, w: n.w });
      badgesLate.push({ x: n.x + n.w / 2, y: n.y - 44, level: lv, text: `Same person? · ${lv}`, title: s.r.note });
    });
    y = sameY + 108 + 20;
  }

  // ---- a couple stays side by side: boxes that ended up between two partners (for example cousins) move out to the left
  const couples: [GNode, GNode][] = partnerNodes.map((p) => [cn, p.n] as [GNode, GNode]);
  const collectCouples = (t: Tree) => {
    const [a, b] = t.kids;
    if (t.kids.length === 2 && a && b && !a.node.placeholder && !b.node.placeholder && (D.partnersOf[a.node.id!] ?? []).some((q) => other(q, a.node.id!) === b.node.id)) couples.push([a.node, b.node]);
    t.kids.forEach(collectCouples);
  };
  collectCouples(root);
  for (const [a0, b0] of couples) {
    const a = a0.x < b0.x ? a0 : b0, b = a === a0 ? b0 : a0;
    const row = nodes.filter((n) => n.gen === a.gen).sort((p, q) => p.x - q.x);
    const ia = row.indexOf(a), ib = row.indexOf(b);
    if (ib - ia < 2) continue;
    const order = [...row.slice(ia + 1, ib), a, b];
    let x = row[ia].x;
    order.forEach((n, i) => { n.x = x; x += n.w + (i === order.length - 2 ? PAIR : GX); });
  }

  // ---- keep boxes in one row from overlapping (shift right; wires follow the boxes)
  for (const g of gens) {
    if (g === 99) continue;
    const row = nodes.filter((n) => n.gen === g).sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const min = row[i - 1].x + row[i - 1].w + GX;
      if (row[i].x < min) row[i].x = min;
    }
  }

  // ---- normalise x
  const minX = Math.min(...nodes.map((n) => n.x), ...chips.map((ch) => ch.x));
  const shift = 44 - minX;
  for (const n of nodes) n.x += shift;
  for (const ch of chips) ch.x += shift;
  for (const b of badgesLate) b.x += shift;
  for (const l of sameLabels) l.x += shift;
  const width = Math.max(...nodes.map((n) => n.x + n.w), ...chips.map((ch) => ch.x + ch.w)) + 40;

  // ---- a faint band behind each opened group of brothers and sisters
  const bands: Band[] = [];
  const bandOf = new Map<string, { xs: number[]; xe: number[]; y: number; h: number }>();
  for (const { t, sib } of sibLinks) {
    const k = t.node.key, b = bandOf.get(k) ?? { xs: [t.node.x], xe: [t.node.x + t.node.w], y: t.node.y, h: t.node.h };
    b.xs.push(sib.x); b.xe.push(sib.x + sib.w);
    for (const sp of nodes) if (sp.partnerOf === sib.id && sp.gen === sib.gen) { b.xs.push(sp.x); b.xe.push(sp.x + sp.w); }   // a sibling's spouse stands inside the band
    bandOf.set(k, b);
  }
  for (const ch of chips) if (ch.toggleKey?.startsWith('sibmore:')) {
    const b = bandOf.get(`p:${ch.toggleKey.slice(8)}`); if (b) { b.xs.push(ch.x); b.xe.push(ch.x + ch.w); }
  }
  bandOf.forEach((b) => bands.push({ x: Math.min(...b.xs) - 12, y: b.y - 16, w: Math.max(...b.xe) - Math.min(...b.xs) + 24, h: b.h + 32 }));

  // ---- edges (parent -> child), drawn into the top of the lower box
  interface Edge { p: GNode; c: GNode; level: Level; rel?: Rel; i: number; n: number; conn: string }
  const edges: Edge[] = [];
  const link = (p: GNode, ch: GNode, rel?: Rel) => edges.push({ p, c: ch, level: rel ? levelOf(rel.status, rel.level) : 'Open', rel, i: 0, n: 1, conn: `pc:${p.key}>${ch.key}` });
  const upWalk = (t: Tree) => t.kids.forEach((k) => { link(k.node, t.node, k.node.placeholder ? undefined : k.node.slot); upWalk(k); });
  upWalk(root);
  sibLinks.forEach(({ t, sib }) => t.kids.forEach((pk) => {
    if (pk.node.placeholder) return;
    const direct = (D.parentsOf[sib.id!] ?? []).find((q) => q.a === pk.node.id);
    // a brother or sister through a probable match is drawn with a weaker link than the record alone
    const viaMatch = direct ? undefined : (D.parentsOf[sib.id!] ?? []).find((q) => matched(pk.node.id!).includes(q.a));
    if (direct) link(pk.node, sib, direct);
    else if (viaMatch) link(pk.node, sib, { ...viaMatch, level: weaker(levelOf(viaMatch.status, viaMatch.level)) });
  }));
  const downWalk = (t: Tree) => t.kids.forEach((k) => {
    link(t.node, k.node, k.node.slot);
    if (t.partner) { const r = (D.parentsOf[k.node.id!] ?? []).find((q) => q.a === t.partner!.id); if (r) link(t.partner, k.node, r); }
    downWalk(k);
  });
  downWalk(dRoot);
  sibForests.forEach(downWalk);
  dRoot.kids.forEach((k) => partnerNodes.forEach((p) => { const r = (D.parentsOf[k.node.id!] ?? []).find((q) => q.a === p.id); if (r) link(p.n, k.node, r); }));
  const incoming = new Map<GNode, Edge[]>();
  for (const e of edges) { const l = incoming.get(e.c) ?? []; l.push(e); incoming.set(e.c, l); }
  for (const l of incoming.values()) l.forEach((e, i) => { e.i = i; e.n = l.length; });

  const wires: Wire[] = [], dots: Dot[] = [], conns: Conn[] = [];
  for (const e of edges) conns.push({ id: e.conn, a: e.p.key, b: e.c.key });

  // couples drawn as one straight marriage line (nothing between them) can share a junction
  const straight = new Map<string, { mx: number; yy: number; conn: string; bottom: number }>();
  const pairKey = (a: GNode, b: GNode) => [a.key, b.key].sort().join('|');
  const pills: Band[] = [], marks: Mark[] = [];
  const pair = (a0: GNode, b0: GNode, rel: Rel, high = false, kind: 'partner' | 'sibling' = 'partner') => {
    const a = a0.x < b0.x ? a0 : b0, b = a === a0 ? b0 : a0;
    const lv = levelOf(rel.status, rel.level);
    const conn = `pt:${a.key}~${b.key}`;
    conns.push({ id: conn, a: a.key, b: b.key });
    const between = nodes.some((n) => n !== a && n !== b && n.gen === a.gen && n.x > a.x + a.w - 1 && n.x + n.w < b.x + 1);
    if (between) { // other boxes sit between the two: run the link under the row instead of through the boxes
      const yb = a.y + a.h + 12;
      wires.push({ d: `M${a.x + a.w / 2} ${a.y + a.h} V${yb} H${b.x + b.w / 2} V${b.y + b.h}`, kind: lineKind(lv), level: lv, conns: [conn], rel: kind });
      return;
    }
    const yy = a.y + (high ? 30 : a.h / 2), mx = (a.x + a.w + b.x) / 2;
    wires.push({ d: `M${a.x + a.w} ${yy} H${b.x}`, kind: lineKind(lv), level: lv, conns: [conn], rel: kind });
    let bottom = Math.max(a.y + a.h, b.y + b.h);
    if (kind === 'partner') {   // a married pair is one unit: a soft outline round both boxes, and a mark of two rings on the line
      const top = Math.min(a.y, b.y) - 8;
      bottom += 8;
      pills.push({ x: a.x - 8, y: top, w: b.x + b.w - a.x + 16, h: bottom - top });
      marks.push({ x: mx, y: yy });
    }
    straight.set(pairKey(a, b), { mx, yy, conn, bottom });
  };
  partnerNodes.forEach((p) => pair(cn, p.n, p.r));
  const pairOf = (a: GNode, b: GNode) => (D.partnersOf[a.id!] ?? []).find((q) => other(q, a.id!) === b.id);
  const pairUp = (t: Tree) => {
    const [a, b] = t.kids;
    if (t.kids.length === 2 && a && b && !a.node.placeholder && !b.node.placeholder) { const r = pairOf(a.node, b.node); if (r) pair(a.node, b.node, r); }
    t.kids.forEach(pairUp);
  };
  pairUp(root);
  // a brother or sister recorded without shared parents (two siblings recorded without shared parents) is joined to the person by a line
  for (const r of D.relationships) {
    if (r.type !== 'sibling') continue;
    const a = nodes.find((n) => n.id === r.a && !n.same), b = nodes.find((n) => n.id === r.b && !n.same);
    if (!a || !b || a.gen !== b.gen) continue;
    if ((D.parentsOf[r.a] ?? []).some((p) => (D.parentsOf[r.b] ?? []).some((q) => q.a === p.a))) continue;
    pair(a, b, r, true, 'sibling');   // high on the box, clear of the siblings control on the side edge
  }
  // brothers and sisters shown while their parents are hidden: a line joins each to the next in the row
  const sibRel = (a: string, b: string): Rel | undefined => {
    const rank: Record<Level, number> = { Confirmed: 0, Probable: 1, Possible: 2, Open: 3 };
    const pa = parentRels(a), pb = parentRels(b);
    let best: Rel | undefined, bl: Level = 'Confirmed';
    for (const x of pa) for (const y of pb) {
      if (x.a !== y.a && !matchedOf(x.a).includes(y.a) && !matchedOf(y.a).includes(x.a)) continue;
      const lx = levelOf(x.status, x.level), ly = levelOf(y.status, y.level);
      let l = rank[lx] >= rank[ly] ? lx : ly; if (x.a !== y.a) l = weaker(l);
      if (!best || rank[l] > rank[bl]) { best = x; bl = l; }
    }
    if (best) return { ...best, level: bl };
    const explicit = (D.siblingOf[a] ?? []).find((r) => other(r, a) === b);
    return explicit;
  };
  const sibRows = new Map<Tree, GNode[]>();
  sibLinks.forEach(({ t, sib }) => { if (!t.node.upOpen) sibRows.set(t, [...(sibRows.get(t) ?? []), sib]); });
  sibRows.forEach((sibs, t) => {
    let prev = t.node;
    for (const s of sibs) {
      const rel = sibRel(prev.id!, s.id!) ?? sibRel(t.node.id!, s.id!);
      if (rel && prev.gen === s.gen && !straight.has(pairKey(prev, s))) pair(prev, s, rel, true, 'sibling');
      prev = s;
    }
  });
  const pairTree = (t: Tree) => { if (t.partner && t.partnerRel) pair(t.node, t.partner, t.partnerRel); t.kids.forEach(pairTree); };
  sibForests.forEach(pairTree); dRoot.kids.forEach(pairTree);

  // a couple drawn side by side whose children are all shared: one control on the line between them, not on one parent's box
  const coupleTabs: CoupleTab[] = [];
  for (const n of nodes) {
    if (n.same || !n.id || n.canDown === 0) continue;
    for (const q of nodes) {
      if (q === n || q.same || !q.id || !straight.has(pairKey(n, q))) continue;
      if (!(D.partnersOf[n.id] ?? []).some((r) => other(r, n.id!) === q.id)) continue;
      const shared = (D.childrenOf[n.id] ?? []).filter((r) => (D.parentsOf[r.b] ?? []).some((pr) => pr.a === q.id));
      if (shared.length !== n.canDown) continue;   // some children are not the partner's: the control stays on this person's box
      const sp = straight.get(pairKey(n, q))!;
      n.coupleDown = true;
      coupleTabs.push({ x: sp.mx, y: sp.bottom, count: n.canDown, open: n.downOpen, key: `down:${n.id}`, names: `${D.person[n.id].short} and ${D.person[q.id].short}` });
      break;
    }
  }

  // one junction wire per child when both parents are an adjacent couple and both links have the same level
  const rank: Record<Level, number> = { Confirmed: 0, Probable: 1, Possible: 2, Open: 3 };
  const joined = new Set<Edge>(); const dotted = new Set<string>();
  for (const [child, es] of incoming) {
    if (es.length !== 2) continue;
    const [e0, e1] = es;
    const sp = straight.get(pairKey(e0.p, e1.p));
    if (!sp || !e0.rel || !e1.rel || e0.level !== e1.level) continue;
    const bus = Math.max(e0.p.y + e0.p.h, e1.p.y + e1.p.h) + 44 + rank[e0.level] * 5;   // below the children control that hangs from the couple
    wires.push({ d: `M${sp.mx} ${sp.yy} V${bus} H${child.x + child.w / 2} V${child.y}`, kind: lineKind(e0.level), level: e0.level, conns: [e0.conn, e1.conn, sp.conn], child: child.id, junction: true });
    if (!dotted.has(sp.conn)) { dotted.add(sp.conn); dots.push({ x: sp.mx, y: sp.yy, level: e0.level, conn: sp.conn }); }
    joined.add(e0); joined.add(e1);
  }
  for (const e of edges) {
    if (joined.has(e)) continue;
    const offs = e.n === 1 ? [0] : [-46, 46];
    const tx = e.c.x + e.c.w / 2 + offs[e.i];
    const ty = e.c.y, sx = e.p.x + e.p.w / 2, sy = e.p.y + e.p.h;
    const bus = sy + 28 + e.i * 9;
    const group = edges.filter((o) => !joined.has(o) && o.p === e.p && o.level === e.level && o.i === e.i && o.n === e.n);
    if (group.length < 2) { wires.push({ d: `M${sx} ${sy} V${bus} H${tx} V${ty}`, kind: lineKind(e.level), level: e.level, conns: [e.conn], child: e.c.id }); continue; }
    // children of one parent share one trunk and bar, with a short drop to each child (no overlapping dashes)
    if (group[0] === e) {
      const xs = group.map((o) => o.c.x + o.c.w / 2 + (o.n === 1 ? 0 : [-46, 46][o.i]));
      wires.push({ d: `M${sx} ${sy} V${bus} M${Math.min(sx, ...xs)} ${bus} H${Math.max(sx, ...xs)}`, kind: lineKind(e.level), level: e.level, conns: group.map((o) => o.conn) });
    }
    wires.push({ d: `M${tx} ${bus} V${ty}`, kind: lineKind(e.level), level: e.level, conns: [e.conn], child: e.c.id });
  }

  return { pills, marks, coupleTabs, bands, nodes, wires, badges: badgesLate, dots, conns, chips, rowLabels, width, height: y, centre: cn, sameLabels };
}
