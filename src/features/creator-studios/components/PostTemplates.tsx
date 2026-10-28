import { ArrowUpRight } from "lucide-react";
import { uid, type Slide } from "../models";

const templates = [
  {
    name: "A fresh start",
    background: "#f5f3e9",
    color: "#34412a",
    text: "Your point of view.",
    family: "Manrope",
    size: 40,
  },
  {
    name: "The little things",
    background: "#e6ecd8",
    color: "#52613c",
    text: "Find the good\nin the everyday.",
    family: "Georgia",
    size: 42,
  },
  {
    name: "Make a statement",
    background: "#33422b",
    color: "#eee9cb",
    text: "An idea worth\nsharing.",
    family: "Manrope",
    size: 44,
  },
];
export function PostTemplates({ onApply }: { onApply: (slide: Slide) => void }) {
  return (
    <details className="post-template-library">
      <summary>
        START WITH A LAYOUT <ArrowUpRight size={13} />
      </summary>
      <div>
        {templates.map((template) => (
          <button
            key={template.name}
            type="button"
            onClick={() =>
              onApply({
                id: uid(),
                background: template.background,
                layers: [
                  {
                    id: uid(),
                    kind: "text",
                    name: template.name,
                    text: template.text,
                    color: template.color,
                    fontFamily: template.family,
                    fontSize: template.size,
                    fontWeight: template.family === "Georgia" ? 400 : 800,
                    textAlign: "center",
                    x: 10,
                    y: 30,
                    width: 80,
                    height: 40,
                    opacity: 1,
                  },
                ],
              })
            }
          >
            <span
              style={{
                background: template.background,
                color: template.color,
                fontFamily: template.family,
              }}
            >
              {template.text}
            </span>
            <strong>{template.name}</strong>
          </button>
        ))}
      </div>
      <small>Applies to this slide. Undo restores your previous design.</small>
    </details>
  );
}
