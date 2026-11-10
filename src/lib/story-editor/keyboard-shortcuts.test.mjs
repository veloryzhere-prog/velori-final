import assert from "node:assert/strict";
import test from "node:test";
import { getStoryEditorShortcut, isStoryEditorEditableTarget } from "./keyboard-shortcuts.mjs";

test("story editor keyboard shortcuts map navigation and playback actions", () => {
  assert.equal(getStoryEditorShortcut("ArrowLeft"), "previous-slide");
  assert.equal(getStoryEditorShortcut("ArrowRight"), "next-slide");
  assert.equal(getStoryEditorShortcut("Home"), "first-slide");
  assert.equal(getStoryEditorShortcut("End"), "last-slide");
  assert.equal(getStoryEditorShortcut(" "), "toggle-playback");
  assert.equal(getStoryEditorShortcut("Delete"), "delete-selection");
  assert.equal(getStoryEditorShortcut("Escape"), "exit-preview");
});

test("shortcut handler ignores text editing and modifier shortcuts", () => {
  assert.equal(getStoryEditorShortcut(" ", { editable: true }), null);
  assert.equal(getStoryEditorShortcut("ArrowRight", { ctrlKey: true }), null);
  assert.equal(getStoryEditorShortcut("Delete", { metaKey: true }), null);
  assert.equal(getStoryEditorShortcut("x"), null);
});

test("editable story editor targets include controls, contenteditable and textbox roles", () => {
  assert.equal(isStoryEditorEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isStoryEditorEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isStoryEditorEditableTarget({ tagName: "BUTTON" }), true);
  assert.equal(isStoryEditorEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(
    isStoryEditorEditableTarget({ tagName: "DIV", getAttribute: () => "textbox" }),
    true,
  );
  assert.equal(isStoryEditorEditableTarget({ tagName: "DIV" }), false);
});
