// A place, in the side panel: what the records say happened there, grouped by kind, with who it is about.
import { D, levelOf, tidy } from './data';
import { PLACE_GROUPS } from './types';
import { GroupIcon } from './GroupIcon';
import { itemsOf, type Item } from './placeData';
import type { Place } from './types';

interface Props { place: Place; close: () => void; select: (id: string) => void }
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

export function PlaceCard({ place, close, select }: Props) {
  const items = itemsOf(place);
  const people = new Set(items.map((i) => i.person)).size;
  const note = tidy(place.note, true);
  const pinned = place.lat != null;
  const where = [place.country, place.quality === 'Approximate' ? 'position approximate' : place.quality === 'Country' ? 'pin marks the country, at its capital' : !pinned ? 'shown as the whole country' : ''].filter(Boolean).join(' · ');

  const line = (i: Item) => {
    const f = D.fact[i.fact], lv = levelOf(f.status, f.level);
    const meta = [f.year, i.either ? 'one of several possible places' : '', lv === 'Confirmed' ? '' : lv].filter(Boolean).join(' · ');
    return <li key={i.fact}><span className="pc-text">{cap(f.text)}</span>{meta && <span className="pc-meta dim"> · {meta}</span>}</li>;
  };

  return (
    <>
      <header className="phead">
        <div className="peyebrow">PLACE{place.country ? ` · ${place.country.toUpperCase()}` : ''}</div>
        <span className="pheadbtns"><button className="close" type="button" aria-label="Close the side panel" onClick={close}>✕</button></span>
      </header>
      <div className="pbody">
        <div className="pnamerow"><h2>{place.name}</h2></div>
        <div className="pyears dim">{where}{where && ' · '}{people} {people === 1 ? 'person' : 'people'}</div>
        {note && <p className="summary">{note}</p>}
        {items.length === 0 && <p className="note">No fact in the app points to this place.</p>}
        {PLACE_GROUPS.filter((g) => items.some((i) => i.group === g)).map((g) => {
          const mine = items.filter((i) => i.group === g);
          const byPerson = [...new Set(mine.map((i) => i.person))].sort((a, b) => D.person[a].name.localeCompare(D.person[b].name));
          return (
            <section key={g} className="pc-group" aria-label={g}>
              <h3 className="pc-h"><GroupIcon group={g} /> {g}</h3>
              <ul className="pc-people">
                {byPerson.map((pid) => {
                  const rows = mine.filter((i) => i.person === pid);
                  const shown = rows.slice(0, 2), rest = rows.slice(2);
                  return (
                    <li key={pid} className="pc-person">
                      <button type="button" className="linkbtn" onClick={() => select(pid)}>{D.person[pid].name}</button>{D.person[pid].years && <span className="dim"> · {D.person[pid].years}</span>}
                      <ul className="pc-facts">{shown.map(line)}</ul>
                      {rest.length > 0 && <details className="pc-more"><summary>{rest.length} more</summary><ul className="pc-facts">{rest.map(line)}</ul></details>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
