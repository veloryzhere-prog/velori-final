const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

export function getStoryEditorShortcut(
  key,
  { editable = false, altKey = false, ctrlKey = false, metaKey = false } = {},
) {
  if (editable || altKey || ctrlKey || metaKey) return null;
  switch (key) {
    case "ArrowLeft":
      return "previous-slide";
    case "ArrowRight":
      return "next-slide";
    case "Home":
      return "first-slide";
    case "End":
      return "last-slide";
    case " ":
      return "toggle-playback";
    case "Delete":
    case "Backspace":
      return "delete-selection";
    case "Escape":
      return "exit-preview";
    default:
      return null;
  }
}

export function isStoryEditorEditableTarget(target) {
  return Boolean(
    target &&
    (target.isContentEditable ||
      EDITABLE_TAGS.has(target.tagName) ||
      target.getAttribute?.("role") === "textbox"),
  );
}
