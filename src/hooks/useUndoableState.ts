// useUndoableState.ts
import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  limit?: number;
  storageKey?: string;
  saveDebounceMs?: number;
};

type UndoApi<T> = {
  present: T;

  // Push a history entry and apply changes
  set: (updater: (draft: T) => T) => void;

  // Apply changes without pushing history (UI updates / live drags)
  mutate: (updater: (draft: T) => T) => void;

  // Replace present (no history)
  replace: (next: T) => void;

  // Push the current present into history (no present change)
  // Use this once at the start of a gesture to create a single undo point.
  checkpoint: () => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // True after mount (client)
  hydrated: boolean;
};

export function useUndoableState<T>(initial: () => T, opts: Options = {}): UndoApi<T> {
  const { limit = 200, storageKey, saveDebounceMs = 350 } = opts;

  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(() => initial());
  const [future, setFuture] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const navLockRef = useRef(false);
  const startNavLock = () => {
    navLockRef.current = true;
    (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(cb, 0))(
      () => { navLockRef.current = false; }
    );
  };

  const clone = (obj: T): T =>
    (typeof structuredClone === "function") ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

  // Load persisted doc after mount
  useEffect(() => {
    setHydrated(true);
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const loaded = JSON.parse(raw) as T;
      const cur = JSON.stringify(present);
      const nxt = JSON.stringify(loaded);
      if (cur !== nxt) {
        setPresent(loaded);
        setPast([]);
        setFuture([]);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const mutate = useCallback((updater: (draft: T) => T) => {
    setPresent(prev => updater(clone(prev)));
  }, []);

  const checkpoint = useCallback(() => {
    if (navLockRef.current) return; // don’t create a new branch right after undo/redo
    setPast(prevPast => {
      const next = [...prevPast, present];
      if (next.length > limit) next.splice(0, next.length - limit);
      return next;
    });
    setFuture([]); // forking timeline
  }, [present, limit]);

  const set = useCallback((updater: (draft: T) => T) => {
    if (navLockRef.current) {
      setPresent(prev => updater(clone(prev)));
      return;
    }
    setPast(prevPast => {
      const next = [...prevPast, present];
      if (next.length > limit) next.splice(0, next.length - limit);
      return next;
    });
    setPresent(prev => updater(clone(prev)));
    setFuture([]);
  }, [present, limit]);

  const replace = useCallback((next: T) => { setPresent(next); }, []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    setPast(prev => {
      if (!prev.length) return prev;
      startNavLock();
      const last = prev[prev.length - 1];
      setFuture(f => [present, ...f]);
      setPresent(last);
      return prev.slice(0, -1);
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (!prev.length) return prev;
      startNavLock();
      const [head, ...rest] = prev;
      setPast(p => [...p, present]);
      setPresent(head);
      return rest;
    });
  }, [present]);

  const clearHistory = useCallback(() => { setPast([]); setFuture([]); }, []);

  // Debounced autosave
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(present)); } catch {}
    }, saveDebounceMs);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [present, storageKey, saveDebounceMs]);

  return { present, set, mutate, replace, checkpoint, canUndo, canRedo, undo, redo, clearHistory, hydrated };
}
