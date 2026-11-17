// Small line icons for the kinds of fact a place can hold. Calm and plain, drawn in the current text colour.
import type { PlaceGroup } from './types';

const P: Record<PlaceGroup, React.ReactNode> = {
  Born: <><path d="M8 14V7.5" /><path d="M8 8.5C8 5.8 6.2 4.2 3.5 4.2 3.5 6.9 5.3 8.5 8 8.5Z" /><path d="M8 7C8 4.6 9.6 3 12.5 3 12.5 5.6 10.9 7 8 7Z" /></>,
  Died: <><rect x="5.5" y="8" width="5" height="6" rx="0.8" /><path d="M8 8V6.8" /><path d="M8 1.8C9.4 3.2 9.8 4 9.8 4.9A1.8 1.8 0 0 1 6.2 4.9C6.2 4 6.6 3.2 8 1.8Z" /></>,
  Lived: <><path d="M2.5 8 8 3l5.5 5" /><path d="M4 7v6.2h8V7" /><path d="M6.8 13.2V9.6h2.4v3.6" /></>,
  Married: <><circle cx="5.8" cy="9" r="3.4" /><circle cx="10.2" cy="9" r="3.4" /><path d="M8 3.2 8.8 4.4 8 5.4 7.2 4.4Z" /></>,
  Buried: <><path d="M4 14V6.8A4 4 0 0 1 12 6.8V14Z" /><path d="M2.5 14h11" /><path d="M8 6v3.4M6.5 7.6h3" /></>,
  'War and camps': <><rect x="2.5" y="3.5" width="11" height="9" rx="1" /><path d="M5.8 3.5v9M8 3.5v9M10.2 3.5v9" /></>,
  Other: <><circle cx="4" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12" cy="8" r="1" /></>
};

export function GroupIcon({ group, size = 14 }: { group: PlaceGroup; size?: number }) {
  return <svg className="gicon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[group]}</svg>;
}
