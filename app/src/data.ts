// Loads the JSON data files (public/data) and builds lookup tables. No fact lives in code.
import type { Conflict, Doc, Fact, Land, Level, Notes, Person, Place, Question, Rel, Source, Spelling, Status } from './types';

export interface Data {
  people: Person[]; relationships: Rel[]; facts: Fact[]; sources: Source[]; conflicts: Conflict[];
  questions: Question[]; documents: Doc[]; spelling: Spelling[]; notes: Notes; places: Place[]; land: Land[];
  person: Record<string, Person>; source: Record<string, Source>; doc: Record<string, Doc>; spell: Record<string, Spelling>;
  parentsOf: Record<string, Rel[]>; childrenOf: Record<string, Rel[]>; partnersOf: Record<string, Rel[]>; sameOf: Record<string, Rel[]>;
  fact: Record<string, Fact>; factPlace: Record<string, string>;   // a fact by id; the place a fact points at (a birth or death only when the record names one place)
  siblingOf: Record<string, Rel[]>; otherLinks: Record<string, Rel[]>; // explicit sibling links; in-law, grandparent and distinct-from links
}

export const D = {} as Data;

// Workbook ids (R51, K10, Q17, P62, S68 ...) and notes about the spreadsheet itself are for the researcher, not for the page.
const REF = /\b(?:[RKQFSLP]\d{2,3}|SR\d{2})\b/;
const INTERNAL = /\b(?:workbook|spreadsheet|searches tab|open question|the pack|claim)\b/i;
/** Removes bracketed ids; with `drop`, also removes whole sentences that mention an id or the workbook. */
export function tidy(t: string | undefined, drop = false): string {
  if (!t) return '';
  const s = t.replace(/\s*\([^()]*\)/g, (m) => (REF.test(m) ? '' : m));
  if (!drop) return s.trim();
  return s.split(/(?<=\.)\s+/).filter((x) => !REF.test(x) && !INTERNAL.test(x)).join(' ').replace(/[;,]\s*$/, '').trim();
}

const get = async <T,>(name: string): Promise<T> => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: 'no-cache' });   // always check for a newer file, so a rebuilt outline or data file is not hidden by the browser's cache
  if (!r.ok) throw new Error(`Could not load data/${name}.json`);
  return r.json() as Promise<T>;
};

export async function loadData(): Promise<void> {
  const [people, relationships, facts, sources, conflicts, questions, documents, spelling, notes, places, land] = await Promise.all([
    get<Person[]>('people'), get<Rel[]>('relationships'), get<Fact[]>('facts'), get<Source[]>('sources'), get<Conflict[]>('conflicts'),
    get<Question[]>('questions'), get<Doc[]>('documents'), get<Spelling[]>('spelling'), get<Notes>('notes'),
    get<Place[]>('places').catch(() => [] as Place[]), get<Land[]>('map').catch(() => [] as Land[])
  ]);
  for (const f of facts) { f.text = tidy(f.text); f.note = tidy(f.note, true); }
  for (const r of relationships) r.note = tidy(r.note, true);
  for (const c of conflicts) { c.note = tidy(c.note, true); for (const v of c.versions) v.value = tidy(v.value); }
  for (const p of people) p.howSure = tidy(p.howSure, true);
  Object.assign(D, { people, relationships, facts, sources, conflicts, questions, documents, spelling, notes, places, land });
  D.person = Object.fromEntries(people.map((p) => [p.id, p]));
  D.source = Object.fromEntries(sources.map((s) => [s.id, s]));
  D.doc = Object.fromEntries(documents.map((d) => [d.id, d]));
  D.spell = Object.fromEntries(spelling.map((s) => [s.id, s]));
  D.fact = Object.fromEntries(facts.map((f) => [f.id, f]));
  D.factPlace = {};
  for (const f of facts) if (f.place) D.factPlace[f.id] = f.place;
  for (const pl of places) {
    for (const l of pl.facts ?? []) D.factPlace[l.id] = pl.id;
    for (const l of pl.people) if (l.fact && !l.either) D.factPlace[l.fact] = pl.id;
  }
  D.parentsOf = {}; D.childrenOf = {}; D.partnersOf = {}; D.sameOf = {}; D.siblingOf = {}; D.otherLinks = {};
  const add = (m: Record<string, Rel[]>, k: string, v: Rel) => { (m[k] ||= []).push(v); };
  for (const r of relationships) {
    if (r.type === 'parent') { add(D.parentsOf, r.b, r); add(D.childrenOf, r.a, r); }
    else if (r.type === 'partner') { add(D.partnersOf, r.a, r); add(D.partnersOf, r.b, r); }
    else if (r.type === 'same') { add(D.sameOf, r.a, r); add(D.sameOf, r.b, r); }
    else if (r.type === 'sibling') { add(D.siblingOf, r.a, r); add(D.siblingOf, r.b, r); }
    else { add(D.otherLinks, r.a, r); add(D.otherLinks, r.b, r); }
  }
}

export const other = (rel: Rel, id: string) => (rel.a === id ? rel.b : rel.a);
export const birthYear = (p: Person) => { const m = /\d{4}/.exec(p.years || ''); return m ? +m[0] : 9999; };

export type LineKind = 'solid' | 'long' | 'short' | 'dotted';

// The simple levels shown in the interface, with the line style that repeats them.
export const LEVELS: { id: Level; glyph: string; line: LineKind; lineName: string; text: string }[] = [
  { id: 'Confirmed', glyph: '●', line: 'solid', lineName: 'solid line', text: 'Backed by an original archival record that was inspected as a scan, or confirmed by you.' },
  { id: 'Probable', glyph: '◆', line: 'long', lineName: 'long-dashed line', text: 'Backed by an archive database entry or a memorial-book list, or by two records that very probably describe the same person.' },
  { id: 'Possible', glyph: '▲', line: 'short', lineName: 'short-dashed line', text: 'Rests on a published biography alone, or on a link the pack calls plausible but unconfirmed.' },
  { id: 'Open', glyph: '○', line: 'dotted', lineName: 'dotted grey line', text: 'Unresolved or not checked.' }
];
export const levelInfo = Object.fromEntries(LEVELS.map((l) => [l.id, l])) as Record<Level, (typeof LEVELS)[number]>;

// The pack's own source labels, mapped to the simple level (shown as "basis" in the side panel).
export const BASES: { id: Status; level: Level; text: string }[] = [
  { id: 'RECORD', level: 'Confirmed', text: 'Stated on an original archival document inspected as a scan.' },
  { id: 'CONFIRMED BY OWNER', level: 'Confirmed', text: 'Confirmed by you; not stated in the research pack.' },
  { id: 'DATABASE ENTRY', level: 'Probable', text: 'From an archive database record whose underlying scan was not inspected.' },
  { id: 'DERIVATIVE LIST', level: 'Probable', text: 'From a published memorial-book necrology as reproduced in a database; not an original document.' },
  { id: 'CROSS-RECORD MATCH', level: 'Probable', text: 'Identifying the same person across two documents: a reasoned conclusion that no single document states.' },
  { id: 'PUBLISHED BIO', level: 'Possible', text: 'Stated only by a published biography (Prabook). Not a registry.' },
  { id: 'FAMILY', level: 'Probable', text: 'Stated by a family member, not by a document; included for orientation, never archival proof.' },
  { id: 'FAMILY ACCOUNT', level: 'Probable', text: 'A relative said it or wrote it down: a family tree, notes or a photo caption. Never archival proof.' },
  { id: 'INFERENCE', level: 'Possible', text: 'A reasoned conclusion from more than one source, stated by no single one; conditional until a record confirms it.' },
  { id: 'SEARCH RESULT', level: 'Open', text: 'The outcome of a stated search; an empty result is not proof of absence.' },
  { id: 'OPEN', level: 'Open', text: 'Unresolved.' }
];
const baseLevel = Object.fromEntries(BASES.map((b) => [b.id, b.level])) as Record<Status, Level>;
export const baseText = Object.fromEntries(BASES.map((b) => [b.id, b.text])) as Record<Status, string>;

/** Level for an item: an explicit override wins, otherwise the level of its basis. */
export const levelOf = (basis: Status, override?: Level): Level => override ?? baseLevel[basis];
export const levelClass = (l: Level) => 's-' + l.toLowerCase();
export const lineKind = (l: Level): LineKind => levelInfo[l].line;

/** Facts shown for a person. Facts that only repeat a family relation or a same-person claim are kept in the data but hidden. */
export const factsOf = (id: string) => D.facts.filter((f) => f.person === id && !f.hidden && f.kind !== 'BIRTH' && f.kind !== 'DEATH');
/** Birth and death are shown as fields at the top of the panel, with their sources. */
export const lifeFact = (id: string, kind: 'BIRTH' | 'DEATH') => D.facts.find((f) => f.person === id && f.kind === kind);

const foldAlias = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Everything a name search looks at for one person: the name, short name, alternative names and maiden name. */
export const nameHaystack = (p: { name: string; short: string; variants: string[]; maidenName?: string }) =>
  foldAlias([p.name, p.short, ...p.variants, p.maidenName ?? ''].join(' '));
/** The alternative name that made someone match a search, when their own name did not (so a result never looks random). */
export function matchedAlias(p: { name: string; short: string; variants: string[]; maidenName?: string }, query: string): string | null {
  const f = foldAlias(query.trim()); if (!f) return null;
  if (foldAlias(`${p.name} ${p.short}`).includes(f)) return null;
  return [...p.variants, p.maidenName ?? ''].find((v) => v && foldAlias(v).includes(f)) ?? null;
}
