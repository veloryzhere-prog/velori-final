export type StoryEditorShortcut =
  | "previous-slide"
  | "next-slide"
  | "first-slide"
  | "last-slide"
  | "toggle-playback"
  | "delete-selection"
  | "exit-preview";
export function getStoryEditorShortcut(
  key: string,
  modifiers?: { editable?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): StoryEditorShortcut | null;
export function isStoryEditorEditableTarget(target: Element | null): boolean;
