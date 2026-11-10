import { useState } from "react";
import type { StoryBrandKit, StoryTemplateLocks } from "../../lib/story-editor/templates.mjs";
import { STORY_TEMPLATES } from "../../lib/story-editor/templates.mjs";

interface TemplatesBrandKitPanelProps {
  mode?: "all" | "templates" | "brand";
  brandKit: StoryBrandKit;
  locks: StoryTemplateLocks;
  onBrandKitChange: (patch: Partial<StoryBrandKit>) => void;
  onLocksChange: (patch: Partial<StoryTemplateLocks>) => void;
  onApplyBrandKit: () => void;
  onApplyTemplate: (templateId: string) => void;
}

const fonts = ["DM Sans", "Manrope", "Playfair Display", "Georgia", "Arial", "monospace"];

export function TemplatesBrandKitPanel({
  mode = "all",
  brandKit,
  locks,
  onBrandKitChange,
  onLocksChange,
  onApplyBrandKit,
  onApplyTemplate,
}: TemplatesBrandKitPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(STORY_TEMPLATES[0].id);
  const selected = STORY_TEMPLATES.find((template) => template.id === selectedTemplate);

  return (
    <section aria-label="Story templates and brand kit" className="story-editor-templates-panel">
      <header>
        <span className="story-editor-eyebrow">
          {mode === "templates"
            ? "LAYOUT"
            : mode === "brand"
              ? "BRAND KIT"
              : "TEMPLATES & BRAND KIT"}
        </span>
        <h2>{mode === "templates" ? "Choose a layout" : "Your brand style"}</h2>
        <p>
          {mode === "templates"
            ? "Apply a ready-made arrangement to the current slide."
            : "Keep your story aligned with your brand."}
        </p>
      </header>

      {mode !== "brand" ? (
        <fieldset>
          <legend>Story templates</legend>
          <label>
            Template
            <select
              onChange={(event) => setSelectedTemplate(event.target.value)}
              value={selectedTemplate}
            >
              {STORY_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <p>{selected?.description}</p>
          <button
            className="story-editor-template-apply"
            onClick={() => onApplyTemplate(selectedTemplate)}
            type="button"
          >
            Apply to current slide
          </button>
          <small>
            Replaces current text overlays and background color only. Media and stickers stay.
          </small>
        </fieldset>
      ) : null}

      {mode !== "templates" ? (
        <fieldset>
          <legend>Brand kit</legend>
          <label className="story-editor-template-check">
            <input
              checked={brandKit.autoApply}
              onChange={(event) => onBrandKitChange({ autoApply: event.target.checked })}
              type="checkbox"
            />
            Apply my brand style to new story text
          </label>
          <details className="story-editor-brand-customize">
            <summary>Customize brand kit</summary>
            <label>
              Kit name
              <input
                maxLength={48}
                onChange={(event) => onBrandKitChange({ name: event.target.value })}
                value={brandKit.name}
              />
            </label>
            <div className="story-editor-brand-colors">
              {(
                [
                  ["Primary text", "primaryColor"],
                  ["Secondary background", "secondaryColor"],
                  ["Accent", "accentColor"],
                ] as const
              ).map(([label, key]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    disabled={locks.colors}
                    onChange={(event) => onBrandKitChange({ [key]: event.target.value })}
                    type="color"
                    value={brandKit[key]}
                  />
                </label>
              ))}
            </div>
            <label>
              Brand font
              <select
                onChange={(event) => onBrandKitChange({ fontFamily: event.target.value })}
                value={brandKit.fontFamily}
              >
                {fonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={onApplyBrandKit} type="button">
              Apply brand style now
            </button>
            <p className="story-editor-template-note">
              Auto-apply updates text fonts/colors and solid slide backgrounds. Uploaded logos
              remain in the Logo overlay controls below.
            </p>
          </details>

          <details className="story-editor-brand-customize">
            <summary>Advanced brand controls</summary>
            <label className="story-editor-template-check">
              <input
                checked={locks.logoPosition}
                onChange={(event) => onLocksChange({ logoPosition: event.target.checked })}
                type="checkbox"
              />
              Lock logo position
            </label>
            <label className="story-editor-template-check">
              <input
                checked={locks.colors}
                onChange={(event) => onLocksChange({ colors: event.target.checked })}
                type="checkbox"
              />
              Lock template and text colors
            </label>
            <p className="story-editor-template-note">
              Unlock colors to edit the palette, slide background colors, or text colors.
            </p>
          </details>
        </fieldset>
      ) : null}
    </section>
  );
}
