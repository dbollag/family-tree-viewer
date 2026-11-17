import { useEffect, useRef, useState } from 'react';

/** A setting remembered in this browser (per viewer; the page works without it). */
export function useSetting(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => { try { const s = localStorage.getItem(key); return s === null ? initial : s === '1'; } catch { return initial; } });
  const set = (on: boolean) => { setV(on); try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* not remembered */ } };
  return [v, set];
}

export function usePhone(): boolean {
  const q = '(max-width: 860px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q); const f = () => setM(mq.matches);
    mq.addEventListener('change', f); return () => mq.removeEventListener('change', f);
  }, []);
  return m;
}

/** Click selects, double-click centres. Wide screens wait a moment after a click to see whether a second one follows, because the
 *  first click opens the panel and moves the map, which would spoil the second; phones act on the first tap straight away. */
export function useClickOrDouble(onSingle: (id: string) => void, onDouble: (id: string) => void, enabled = true) {
  const pending = useRef<{ id: string; t: number } | null>(null);
  const flush = () => { const p = pending.current; if (p) { clearTimeout(p.t); pending.current = null; onSingle(p.id); } };
  const click = (id: string) => {
    if (!enabled) { onSingle(id); return; }
    if (pending.current && pending.current.id !== id) flush();   // a different box: do the first one now
    if (pending.current) return;
    pending.current = { id, t: window.setTimeout(() => { pending.current = null; onSingle(id); }, 230) };
  };
  const dbl = (id: string) => {
    if (pending.current) { clearTimeout(pending.current.t); pending.current = null; }
    onDouble(id);
  };
  return [click, dbl] as const;
}
