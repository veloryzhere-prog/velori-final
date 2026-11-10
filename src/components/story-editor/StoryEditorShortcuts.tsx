import { useEffect } from "react";

export interface StoryEditorShortcutActions {
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  deselect: () => void;
  saveDraft: () => void;
}

export default function useStoryEditorShortcuts(actions: StoryEditorShortcutActions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;

      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();

        if (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select") {
          return;
        }
      }

      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          actions.redo();
        } else {
          actions.undo();
        }

        return;
      }

      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        actions.redo();
        return;
      }

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        actions.saveDraft();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        actions.deleteSelected();
        return;
      }

      if (event.key === "Escape") {
        actions.deselect();
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [actions]);
}
