// Documents and photographs, filtered for the Sources view (and for stepping through them in the viewer).
import { D, nameHaystack } from './data';
import { relation } from './kinship';
import type { Doc } from './types';

export type SourceKind = 'all' | 'documents' | 'photographs';
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filterDocs(kind: SourceKind, q: string, person: string | null = null): Doc[] {
  const f = fold(q.trim());
  return D.documents.filter((d) => {
    if (person && !d.persons.includes(person)) return false;
    if (kind === 'documents' && d.isPhoto) return false;
    if (kind === 'photographs' && !d.isPhoto) return false;
    return !f || fold([d.title, d.caption, ...d.persons.map((p) => (D.person[p] ? nameHaystack(D.person[p]) : ''))].join(' ')).includes(f);
  });
}

export interface SourceGroup { person: string | null; relation: string; docs: Doc[] }
/** Closeness to the centre: the person themself, then partner, parents, children and siblings, then grandparents and grandchildren, aunts and
 *  uncles, cousins, and the rest in order of generation distance. */
const closeness = (centre: string, id: string): number => {
  if (id === centre) return -1;
  const r = relation(centre, id), t = r.text.toLowerCase();
  if (!t) return 1e6;
  if (/ of |in-law|great|second|step/.test(t)) return 6 + Math.abs(r.gen ?? 9);
  if (/^(husband|wife|spouse|partner)/.test(t)) return 1;
  if (/^(father|mother|parent|son|daughter|child)\b/.test(t)) return 1.2;
  if (/^(brother|sister|sibling)/.test(t)) return 1.5;
  if (/^grand/.test(t)) return 2;
  if (/aunt|uncle|niece|nephew/.test(t)) return 3;
  if (/cousin/.test(t)) return 4;
  return 5 + Math.abs(r.gen ?? 9);
};

/** Each document once, under the person closest to the centre among the people it is linked to; groups run from the centre outwards.
 *  With a person chosen, one flat group holds everything linked to them. */
export function sourceGroups(kind: SourceKind, q: string, person: string | null, centre: string): SourceGroup[] {
  const docs = filterDocs(kind, q, person);
  if (person) return docs.length ? [{ person, relation: relation(centre, person).text, docs }] : [];
  const by = new Map<string | null, Doc[]>();
  for (const d of docs) {
    const people = d.persons.filter((p) => D.person[p]).sort((a, b) => closeness(centre, a) - closeness(centre, b) || D.person[a].name.localeCompare(D.person[b].name));
    const k = people[0] ?? null;
    by.set(k, [...(by.get(k) ?? []), d]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : closeness(centre, a) - closeness(centre, b) || D.person[a].name.localeCompare(D.person[b].name)))
    .map(([p, ds]) => ({ person: p, relation: p ? relation(centre, p).text : '', docs: ds }));
}
