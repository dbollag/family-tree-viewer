// Status = the pack's own label for the source ("basis"). Level = the simple label shown in the interface.
export type Status = 'RECORD' | 'DATABASE ENTRY' | 'DERIVATIVE LIST' | 'CROSS-RECORD MATCH' | 'PUBLISHED BIO' | 'OPEN' | 'CONFIRMED BY OWNER' | 'FAMILY' | 'FAMILY ACCOUNT' | 'CONFIRMED BY DIDI' | 'INFERENCE' | 'SEARCH RESULT';
export type Level = 'Confirmed' | 'Probable' | 'Possible' | 'Open';
export type Sex = 'm' | 'f' | null;

export interface Person {
  id: string; photo?: string; living?: 'Yes' | 'Possibly'; name: string; short: string; sex: Sex; years: string; status: Status;
  line: string; level?: Level; variants: string[]; spelling: string[]; summary: string; howSure: string;
  maidenName?: string; birth: string; death: string; unattached?: boolean; unnamedChildren?: number;
  alsoRecordedAs?: { id: string; name: string; note: string }[]; conflicts?: string[];
}
export interface Rel {
  id: string; type: 'parent' | 'partner' | 'same' | 'distinct' | 'sibling' | 'inlaw' | 'grandparent'; a: string; b: string; status: Status;
  label?: string; level?: Level; sources: string[]; note: string; conflict?: string;
}
export interface Fact { id: string; person: string; kind: string; date: string; text: string; status: Status; level?: Level; sources: string[]; conflict?: string; hidden?: boolean; hiddenReason?: string; note?: string; asName?: string; place?: string; year?: string }
export interface Source { id: string; label: string; publisher: string; url: string | null; scans: number[]; type?: string; status?: string; note?: string }
export interface Conflict { id: string; persons: string[]; topic: string; versions: { value: string; status?: Status; sources: string[] }[]; note: string; status?: string; sources?: string[] }
export interface Question { id: string; persons: string[]; text: string; status?: string; next?: string }
export interface Doc {
  id: string; scan: number | null; title: string; image: string | null; caption: string; notes: string[]; status: Status;
  persons: string[]; archiveUrl: string | null; driveViewUrl: string | null; isPhoto?: boolean; whoIsWho?: string; lineup?: (string | null)[];
  redacted?: boolean; notOurFamily?: boolean; maybePersons?: string[]; closeUps?: { title: string; image: string }[]; portraitCaveat?: boolean; cropOf?: number; placeholder?: boolean; notStoredLocally?: boolean;
}
export interface Spelling { id: string; group: string; variants: string[]; note: string }
export interface Notes { title: string; defaultCentre: string; howToRead: string[]; excluded: string[] }

export interface PlaceLink { person: string; kind: 'birth' | 'death'; either: boolean; fact?: string }
export const PLACE_GROUPS = ['Born', 'Died', 'Lived', 'Married', 'Buried', 'War and camps', 'Other'] as const;
export type PlaceGroup = (typeof PLACE_GROUPS)[number];
/** A fact from the Facts tab that points at a place; the group is decided by the importer from the fact's kind. */
export interface PlaceFact { id: string; person: string; group: PlaceGroup }
export interface Place { id: string; name: string; also: string[]; country: string; lat: number | null; lon: number | null; quality: string; note: string; people: PlaceLink[]; facts: PlaceFact[] }
export interface Land { n: string; d: string }
