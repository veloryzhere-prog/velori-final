import { useCallback, useEffect, useRef, useState } from "react";
import { readReelDraft, writeReelDraft } from "../../lib/reel-editor/draft.ts";
import { normalizeProject } from "../../lib/reel-editor/timeline.ts";
import type { ReelProject } from "../../lib/reel-editor/types.ts";

const HISTORY_LIMIT = 60;

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface ReelProjectController {
  project: ReelProject;
  saveStatus: SaveStatus;
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
}

export function useReelProject(userId: string | null, initial: ReelProject): ReelProjectController {
  const [project, setProject] = useState<ReelProject>(initial);
  const [past, setPast] = useState<ReelProject[]>([]);
  const [future, setFuture] = useState<ReelProject[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    void readReelDraft(userId).then((draft) => {
      if (!draft || cancelled) return;
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
    if (!userId) return;
    setSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      void writeReelDraft(userId, project)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("unsaved"));
    }, 900);
    return () => window.clearTimeout(timer);
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
    setSaveStatus("saving");
    try {
      await writeReelDraft(userId, projectRef.current);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [userId]);

  return {
    project,
    saveStatus,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    commit,
    preview,
    beginTransaction,
    undo,
    redo,
    reset,
    saveNow,
  };
}
