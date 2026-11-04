import { useCallback, useEffect, useRef, useState } from "react";
import { clearReelDraft, readReelDraft, writeReelDraft } from "../../lib/reel-editor/draft.ts";
import { normalizeProject } from "../../lib/reel-editor/timeline.ts";
import type { ReelProject } from "../../lib/reel-editor/types.ts";

const HISTORY_LIMIT = 60;

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface ReelProjectController {
  project: ReelProject;
  saveStatus: SaveStatus;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Applies a change and records it in the undo history. */
  commit: (updater: ReelProject | ((current: ReelProject) => ReelProject)) => void;
  /** Applies a change without touching the history. Used while dragging. */
  preview: (updater: ReelProject | ((current: ReelProject) => ReelProject)) => void;
  /** Records the current state so a drag can be undone in one step. */
  beginTransaction: () => void;
  undo: () => void;
  redo: () => void;
  reset: (project: ReelProject) => void;
  /** Writes the current project to draft storage immediately. */
  saveNow: () => Promise<void>;
  discardDraft: () => Promise<void>;
}

export function useReelProject(userId: string | null, initial: ReelProject): ReelProjectController {
  const [project, setProject] = useState<ReelProject>(initial);
  const [past, setPast] = useState<ReelProject[]>([]);
  const [future, setFuture] = useState<ReelProject[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const projectRef = useRef(project);
  projectRef.current = project;
  const saveTimerRef = useRef<number | null>(null);
  const pendingWritesRef = useRef(new Set<Promise<void>>());
  const discardGenerationRef = useRef(0);
  const discardedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    discardedRef.current = false;
    discardGenerationRef.current += 1;
    const generation = discardGenerationRef.current;
    if (!userId) return;
    void readReelDraft(userId).then((draft) => {
      if (!draft || cancelled || generation !== discardGenerationRef.current) return;
      if (!draft.clips.length && !draft.texts.length) return;
      setProject(draft);
      setPast([]);
      setFuture([]);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || discardedRef.current) return;
    setSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (discardedRef.current) return;
      setSaveStatus("saving");
      const write = writeReelDraft(userId, project);
      pendingWritesRef.current.add(write);
      void write.then(
        () => {
          setSaveStatus("saved");
          pendingWritesRef.current.delete(write);
        },
        () => {
          setSaveStatus("unsaved");
          pendingWritesRef.current.delete(write);
        },
      );
    }, 900);
    saveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (saveTimerRef.current === timer) saveTimerRef.current = null;
    };
  }, [project, userId]);

  const commit = useCallback((updater: ReelProject | ((current: ReelProject) => ReelProject)) => {
    const current = projectRef.current;
    const next = typeof updater === "function" ? updater(current) : updater;
    if (next === current) return;
    setPast((items) => [...items, current].slice(-HISTORY_LIMIT));
    setFuture([]);
    setProject(next);
  }, []);

  const preview = useCallback((updater: ReelProject | ((current: ReelProject) => ReelProject)) => {
    const current = projectRef.current;
    const next = typeof updater === "function" ? updater(current) : updater;
    if (next === current) return;
    setProject(next);
  }, []);

  const beginTransaction = useCallback(() => {
    const current = projectRef.current;
    setPast((items) => [...items, current].slice(-HISTORY_LIMIT));
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((forward) => [projectRef.current, ...forward].slice(0, HISTORY_LIMIT));
      setProject(previous);
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setPast((backward) => [...backward, projectRef.current].slice(-HISTORY_LIMIT));
      setProject(next);
      return items.slice(1);
    });
  }, []);

  const reset = useCallback((next: ReelProject) => {
    setPast([]);
    setFuture([]);
    setProject(normalizeProject(next));
  }, []);

  const saveNow = useCallback(async () => {
    if (!userId) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await Promise.all([...pendingWritesRef.current].map((write) => write.catch(() => undefined)));
    setSaveStatus("saving");
    const write = writeReelDraft(userId, projectRef.current);
    pendingWritesRef.current.add(write);
    try {
      await write;
      setSaveStatus("saved");
    } catch (cause) {
      setSaveStatus("unsaved");
      throw cause;
    } finally {
      pendingWritesRef.current.delete(write);
    }
  }, [userId]);

  const discardDraft = useCallback(async () => {
    if (!userId) throw new Error("Sign in again before clearing this draft.");
    discardedRef.current = true;
    discardGenerationRef.current += 1;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await Promise.all([...pendingWritesRef.current].map((write) => write.catch(() => undefined)));
      await clearReelDraft(userId);
    } catch (cause) {
      discardedRef.current = false;
      throw cause;
    }
  }, [userId]);

  return {
    project,
    saveStatus,
    isDirty: past.length > 0 || future.length > 0,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    commit,
    preview,
    beginTransaction,
    undo,
    redo,
    reset,
    saveNow,
    discardDraft,
  };
}
