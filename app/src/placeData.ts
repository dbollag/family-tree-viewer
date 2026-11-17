// What the records say about places, in the shape the Map and the side panel both need.
import { D } from './data';
import { PLACE_GROUPS, type Place, type PlaceGroup } from './types';

/** One person's connection to one place: a birth or death from the People tab, or a fact from the Facts tab. */
export interface Item { person: string; group: PlaceGroup; either: boolean; fact: string }
export const groupOrder = (g: PlaceGroup) => PLACE_GROUPS.indexOf(g);

let cache: Map<string, Item[]> | null = null;
/** Every connection to a place, born and died first. Facts that are hidden or whose person is not in the app are left out. */
export function itemsOf(pl: Place): Item[] {
  if (!cache) cache = new Map();
  let r = cache.get(pl.id);
  if (!r) {
    r = [
      ...pl.people.filter((l) => l.fact && D.fact[l.fact]).map((l) => ({ person: l.person, group: (l.kind === 'birth' ? 'Born' : 'Died') as PlaceGroup, either: l.either, fact: l.fact! })),
      ...(pl.facts ?? []).filter((l) => D.fact[l.id] && !pl.people.some((q) => q.fact === l.id)).map((l) => ({ person: l.person, group: l.group, either: false, fact: l.id }))
    ].filter((i) => D.person[i.person]);
    cache.set(pl.id, r);
  }
  return r;
}

/** The places a person is connected to, the ones tied to their birth or death first. */
export function placesOfPerson(id: string): { pl: Place; groups: PlaceGroup[] }[] {
  return D.places.map((pl) => ({ pl, groups: [...new Set(itemsOf(pl).filter((i) => i.person === id).map((i) => i.group))].sort((a, b) => groupOrder(a) - groupOrder(b)) }))
    .filter((x) => x.groups.length)
    .sort((a, b) => groupOrder(a.groups[0]) - groupOrder(b.groups[0]) || a.pl.name.localeCompare(b.pl.name));
}

/** The centre and everyone above them (parents, grandparents, ...) or below them (children, grandchildren, ...). */
export function lineOf(centre: string, dir: 'up' | 'down'): Set<string> {
  const out = new Set([centre]), todo = [centre];
  while (todo.length) {
    const id = todo.pop()!;
    for (const r of (dir === 'up' ? D.parentsOf[id] : D.childrenOf[id]) ?? []) { const n = dir === 'up' ? r.a : r.b; if (!out.has(n)) { out.add(n); todo.push(n); } }
  }
  return out;
}
