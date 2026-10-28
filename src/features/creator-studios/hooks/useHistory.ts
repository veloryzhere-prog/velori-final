import { useCallback, useEffect, useRef, useState } from "react";

export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState(initial);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const presentRef = useRef(present);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);
  const resolveUpdate = (updater: T | ((current: T) => T), current: T) =>
    typeof updater === "function" ? (Reflect.apply(updater, undefined, [current]) as T) : updater;

  const commit = useCallback((updater: T | ((current: T) => T)) => {
    setPast((items) => [...items.slice(-49), presentRef.current]);
    setPresent((current) => resolveUpdate(updater, current));
    setFuture([]);
  }, []);

  const replace = useCallback((updater: T | ((current: T) => T)) => {
    setPresent((current) => resolveUpdate(updater, current));
  }, []);

  const checkpoint = useCallback((snapshot: T) => {
    setPast((items) => [...items.slice(-49), snapshot]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((next) => [presentRef.current, ...next].slice(0, 50));
      setPresent(previous);
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setPast((previous) => [...previous.slice(-49), presentRef.current]);
      setPresent(next);
      return items.slice(1);
    });
  }, []);

  return {
    present,
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    canUndo: !!past.length,
    canRedo: !!future.length,
  };
}
