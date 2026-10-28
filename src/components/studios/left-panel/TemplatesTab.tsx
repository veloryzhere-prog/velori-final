import { Check, Clapperboard, Image as ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import "@/styles/tokens.css";
import "./TemplatesTab.css";

export type StudioTemplateCategory = "post" | "reel" | "story";
export type TemplateFilter = "all" | StudioTemplateCategory;

export interface StudioTemplate {
  id: string;
  name: string;
  category: StudioTemplateCategory;
  thumbnailUrl?: string;
}

export interface TemplatesTabProps {
  templates?: StudioTemplate[];
  selectedTemplateId?: string | null;
  onTemplateSelect: (templateId: string) => void;
}

const categories: { id: TemplateFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "post", label: "Posts" },
  { id: "reel", label: "Reels" },
  { id: "story", label: "Stories" },
];

export default function TemplatesTab({
  templates = [],
  selectedTemplateId,
  onTemplateSelect,
}: TemplatesTabProps) {
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const visibleTemplates = useMemo(
    () => templates.filter((template) => filter === "all" || template.category === filter),
    [filter, templates],
  );

  return (
    <section className="studio-templates-tab" aria-label="Templates">
      <h2 className="studio-templates-heading">Templates</h2>
      <div className="studio-templates-filters" aria-label="Filter templates">
        {categories.map(({ id, label }) => (
          <button
            key={id}
            className="studio-templates-filter"
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="studio-templates-grid">
        {visibleTemplates.length ? (
          visibleTemplates.map((template) => (
            <button
              className="studio-template-card"
              key={template.id}
              type="button"
              aria-label={`Apply ${template.name}`}
              aria-pressed={selectedTemplateId === template.id}
              onClick={() => onTemplateSelect(template.id)}
            >
              <div className="studio-template-preview">
                {template.thumbnailUrl ? (
                  <img src={template.thumbnailUrl} alt="" />
                ) : (
                  <ImageIcon size={24} aria-hidden="true" />
                )}
              </div>
              <span className="studio-template-copy">
                <strong className="studio-template-name">{template.name}</strong>
                <small>{template.category}</small>
              </span>
              <span className="studio-template-selected">
                {selectedTemplateId === template.id ? (
                  <>
                    <Check size={14} aria-hidden="true" /> Applied
                  </>
                ) : (
                  "Apply"
                )}
              </span>
            </button>
          ))
        ) : (
          <p className="studio-templates-empty">
            <Clapperboard size={18} aria-hidden="true" /> No templates available
          </p>
        )}
      </div>
    </section>
  );
}
