import { createUuid } from "../../lib/uuid.mjs";
import { useMemo, useState } from "react";
import "./BrandTemplates.css";
import { BookmarkPlus, LockKeyhole, Palette, Search, Sparkles } from "lucide-react";
import {
  applyBrandTokens,
  BRAND_STORAGE_KEY,
  createTemplateCatalog,
  filterTemplates,
  TEMPLATE_INDUSTRIES,
  TEMPLATE_PLATFORMS,
  TEMPLATE_STORAGE_KEY,
  TEMPLATE_TYPES,
} from "../../lib/post-editor/brand-templates.mjs";
import type { PostEditorBrandKit, PostEditorTemplate } from "../../../types/post-editor";

const starterKit: PostEditorBrandKit & {
  tone: string;
  lockedColors: boolean;
  lockedLogoPosition: boolean;
} = {
  id: "default",
  name: "My brand",
  colors: ["#6d5dfc", "#f472b6", "#111827"],
  fonts: ["Inter", "Georgia"],
  logoUrl: "",
  tone: "Warm, clear, and optimistic.",
  lockedColors: false,
  lockedLogoPosition: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function BrandTemplates({
  body,
  onApply,
}: {
  body: string;
  onApply: (text: string) => void;
}) {
  const [brand, setBrand] = useState(() => readJson(BRAND_STORAGE_KEY, starterKit));
  const [savedTemplates, setSavedTemplates] = useState<PostEditorTemplate[]>(() =>
    readJson(TEMPLATE_STORAGE_KEY, []),
  );
  const [platform, setPlatform] = useState("All");
  const [industry, setIndustry] = useState("All");
  const [kind, setKind] = useState("All");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const catalog = useMemo(() => createTemplateCatalog(), []);
  const results = useMemo(
    () =>
      filterTemplates(
        [
          ...savedTemplates.map((item) => ({
            ...item,
            platform: item.kind?.split("|")[0] ?? "Instagram",
            industry: item.kind?.split("|")[1] ?? "General",
            type: item.kind?.split("|")[2] ?? "Story",
            palette: brand.colors ?? [],
            starter: false,
          })),
          ...catalog,
        ],
        { platform, industry, type: kind, query },
      ),
    [savedTemplates, catalog, platform, industry, kind, query, brand.colors],
  );
  const updateBrand = (next: typeof brand) => {
    setBrand(next);
    localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(next));
  };
  const applyBrand = () => {
    document.documentElement.style.setProperty("--post-brand-font", brand.fonts?.[0] || "Inter");
    document.documentElement.style.setProperty(
      "--post-brand-primary",
      brand.colors?.[0] || "#6d5dfc",
    );
    document.documentElement.style.setProperty(
      "--post-brand-accent",
      brand.colors?.[1] || "#f472b6",
    );
    onApply(applyBrandTokens(body, brand));
    setNotice(`Applied ${brand.name} colors and ${brand.fonts?.[0] ?? "brand"} type style.`);
  };
  const saveTemplate = () => {
    const item: PostEditorTemplate = {
      id: createUuid(),
      name: `My template ${savedTemplates.length + 1}`,
      kind: `${platform === "All" ? "Instagram" : platform}|${industry === "All" ? "General" : industry}|${kind === "All" ? "Story" : kind}`,
      content: body,
      brandKitId: brand.id,
    };
    const next = [item, ...savedTemplates];
    setSavedTemplates(next);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
    setNotice("Post saved to your team’s shared template library on this device.");
  };
  return (
    <section className="brand-template-panel" aria-label="Brand kit and templates">
      <div className="brand-template-heading">
        <div>
          <span className="editor-eyebrow">BRAND KIT + TEMPLATES</span>
          <h2>
            <Palette size={18} /> Brand workspace
          </h2>
        </div>
        <button className="button button-outline" type="button" onClick={saveTemplate}>
          <BookmarkPlus size={15} /> Save as template
        </button>
      </div>
      <div className="brand-kit-form">
        <label>
          Brand name
          <input
            value={brand.name}
            onChange={(e) => updateBrand({ ...brand, name: e.target.value })}
          />
        </label>
        <label>
          Logo
          <input
            type="url"
            value={brand.logoUrl ?? ""}
            placeholder="Logo URL or upload below"
            onChange={(e) => updateBrand({ ...brand, logoUrl: e.target.value })}
          />
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp"
            aria-label="Upload brand logo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1024 * 1024) {
                setNotice("Logo must be under 1 MB to store safely in this browser.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => updateBrand({ ...brand, logoUrl: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
          {brand.logoUrl && (
            <img className="brand-logo-preview" src={brand.logoUrl} alt="Brand logo preview" />
          )}
        </label>
        <label>
          Fonts
          <input
            value={(brand.fonts ?? []).join(", ")}
            onChange={(e) =>
              updateBrand({
                ...brand,
                fonts: e.target.value
                  .split(",")
                  .map((font) => font.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          Tone guide
          <textarea
            value={brand.tone}
            onChange={(e) => updateBrand({ ...brand, tone: e.target.value })}
          />
        </label>
        <div className="brand-colors">
          {(brand.colors ?? []).map((color, index) => (
            <label key={index}>
              Color {index + 1}
              <input
                type="color"
                value={color}
                onChange={(e) =>
                  updateBrand({
                    ...brand,
                    colors: (brand.colors ?? []).map((value, i) =>
                      i === index ? e.target.value : value,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button type="button" className="button button-primary" onClick={applyBrand}>
            <Sparkles size={15} /> Apply brand
          </button>
        </div>
        <div className="brand-locks">
          <label>
            <input
              type="checkbox"
              checked={brand.lockedColors}
              onChange={(e) => updateBrand({ ...brand, lockedColors: e.target.checked })}
            />
            <LockKeyhole size={14} /> Lock template colors
          </label>
          <label>
            <input
              type="checkbox"
              checked={brand.lockedLogoPosition}
              onChange={(e) => updateBrand({ ...brand, lockedLogoPosition: e.target.checked })}
            />
            <LockKeyhole size={14} /> Lock logo position
          </label>
        </div>
      </div>
      <div className="template-library-head">
        <div>
          <h3>
            Template library <span>1,200 starter layouts + {savedTemplates.length} saved</span>
          </h3>
          <p>Editable layout recipes. Pick one to use its copy and brand palette.</p>
        </div>
        <label className="template-search">
          <Search size={15} />
          <input
            placeholder="Search templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="template-filters">
        {[
          ["Platform", platform, setPlatform, ["All", ...TEMPLATE_PLATFORMS]],
          ["Industry", industry, setIndustry, ["All", ...TEMPLATE_INDUSTRIES]],
          ["Type", kind, setKind, ["All", ...TEMPLATE_TYPES]],
        ].map(([label, selected, setter, options]) => (
          <label key={label as string}>
            {label as string}
            <select
              value={selected as string}
              onChange={(e) => (setter as (value: string) => void)(e.target.value)}
            >
              {(options as string[]).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="template-grid">
        {results.slice(0, 36).map((template) => (
          <button
            className="template-tile"
            type="button"
            key={template.id}
            onClick={() => {
              onApply(template.content ?? "");
              if (!brand.lockedColors && template.palette?.length)
                updateBrand({ ...brand, colors: template.palette });
              setNotice(`${template.name} loaded. Replace the starter copy with your own.`);
            }}
          >
            <span
              className="template-art"
              style={{
                background: `linear-gradient(135deg, ${template.palette?.[0] ?? "#6d5dfc"}, ${template.palette?.[1] ?? "#f472b6"})`,
              }}
            >
              <b>{template.type}</b>
              <small>{template.industry}</small>
            </span>
            <strong>{template.name}</strong>
            <small>
              {template.platform} · {template.starter ? "Starter layout" : "Saved template"}
            </small>
          </button>
        ))}
      </div>
      {results.length === 0 && (
        <p className="template-empty">
          No matching templates. Change a filter or save this post as a template.
        </p>
      )}
      {notice && (
        <p className="brand-template-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
