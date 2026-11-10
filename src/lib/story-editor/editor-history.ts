export interface EditorHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createEditorHistory<T>(initial: T): EditorHistory<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushEditorHistory<T>(
  history: EditorHistory<T>,
  next: T,
  limit = 100,
): EditorHistory<T> {
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
  };
}

export function undoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  if (history.past.length === 0) {
    return history;
  }

  const previous = history.past[history.past.length - 1];

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  if (history.future.length === 0) {
    return history;
  }

  const next = history.future[0];

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
