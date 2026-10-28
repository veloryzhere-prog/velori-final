import { useState } from "react";
import {
  Activity,
  AudioLines,
  BookImage,
  Code2,
  Image,
  LayoutDashboard,
  Palette,
  PanelsTopLeft,
  Settings2,
  Sparkles,
  Sticker,
  Video,
} from "lucide-react";
import type { CreatorSection, StudioTarget } from "./CreatorManager.types";
import { CreatorOverview } from "./CreatorOverview";
import { StudioDesignManager } from "./StudioDesignManager";
import { StudioSourceWorkbench } from "./StudioSourceWorkbench";
import { ConnectedManagerScreen, VersionHistoryPanel } from "./CreatorManagerScreens";
import { StudioCatalogBody } from "../../app/admin-console/screens/studio-catalog";
import "./CreatorManager.css";

type NavigationItem = { id: CreatorSection; label: string; icon: typeof Sparkles };
const navigation: Array<{ title: string; items: NavigationItem[] }> = [
  { title: "OVERVIEW", items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "CREATIVE ASSETS",
    items: [
      { id: "music", label: "Music Library", icon: AudioLines },
      { id: "stickers", label: "Sticker Manager", icon: Sticker },
      { id: "templates", label: "Templates", icon: PanelsTopLeft },
      { id: "brand-kit", label: "Brand Kit", icon: Palette },
    ],
  },
  {
    title: "STUDIO CONTROL",
    items: [
      { id: "story", label: "Story Studio", icon: Image },
      { id: "reel", label: "Reel Studio", icon: Video },
      { id: "post", label: "Post Studio", icon: BookImage },
      { id: "source", label: "Source Workbench", icon: Code2 },
    ],
  },
  {
    title: "CONFIGURATION",
    items: [
      { id: "design", label: "Studio Design", icon: Sparkles },
      { id: "tools", label: "Custom Tools", icon: Settings2 },
      { id: "versions", label: "Version History", icon: Activity },
    ],
  },
];

const titles: Record<CreatorSection, string> = {
  overview: "Creator Control Center",
  music: "Music Library",
  stickers: "Sticker Manager",
  templates: "Templates",
  "brand-kit": "Brand Kit",
  story: "Story Studio",
  reel: "Reel Studio",
  post: "Post Studio",
  design: "Studio Design Manager",
  source: "Full Source Workbench",
  tools: "Custom Tool Builder",
  versions: "Version History",
};

const studioTargets: Array<{ id: StudioTarget; label: string }> = [
  { id: "story", label: "Story" },
  { id: "reel", label: "Reel" },
  { id: "post", label: "Post" },
];

export function CreatorManager({
  initialSection = "overview",
}: {
  initialSection?: CreatorSection;
}) {
  const [section, setSection] = useState<CreatorSection>(initialSection);
  const [studio, setStudio] = useState<StudioTarget>(
    initialSection === "reel" || initialSection === "post" ? initialSection : "story",
  );
  const [editorMode, setEditorMode] = useState<"visual" | "source">(
    initialSection === "source" ? "source" : "visual",
  );

  function openStudio(target: StudioTarget) {
    setStudio(target);
    setSection(target);
    setEditorMode("visual");
  }

  function openSource(target: StudioTarget) {
    setStudio(target);
    setSection("source");
    setEditorMode("source");
  }

  function changeStudioTarget(target: StudioTarget) {
    setStudio(target);
    if (section === "story" || section === "reel" || section === "post") setSection(target);
  }

  function navigate(next: CreatorSection) {
    setSection(next);
    if (next === "source") setEditorMode("source");
    if (next === "story" || next === "reel" || next === "post") {
      setStudio(next);
      setEditorMode("visual");
    }
  }

  return (
    <section className="cm-root" aria-label="Creator Control Center workspace">
      <header className="cm-page-heading">
        <div>
          <span className="cm-workspace-label">CREATOR CONTROL CENTER</span>
          <h1>{titles[section]}</h1>
          <p>Manage the shared creative assets and supported controls used by VELORI studios.</p>
        </div>
      </header>

      <nav className="cm-section-navigation" aria-label="Creator Control Center sections">
        {navigation.map((group) => (
          <section className="cm-nav-group" key={group.title} aria-label={group.title}>
            <h2 className="cm-nav-heading">{group.title}</h2>
            <div className="cm-nav-items">
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`cm-nav-item${section === id ? " active" : ""}`}
                  onClick={() => navigate(id)}
                  aria-current={section === id ? "page" : undefined}
                >
                  <Icon className="cm-nav-symbol" size={15} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {section === "story" ||
      section === "reel" ||
      section === "post" ||
      section === "source" ||
      section === "design" ? (
        <nav className="cm-studio-switcher" aria-label="Studio target">
          <span className="cm-target-label">Studio target</span>
          {studioTargets.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={`cm-studio-tab${studio === id ? " active" : ""}`}
              onClick={() => changeStudioTarget(id)}
            >
              {label} Studio
            </button>
          ))}
          <span className="cm-switcher-divider" />
          <button
            type="button"
            className={`cm-studio-tab${section === "source" ? " active" : ""}`}
            onClick={() => openSource(studio)}
          >
            <Code2 size={15} /> Full Source Code
          </button>
        </nav>
      ) : null}

      <section className="cm-page-content">
        {section === "overview" ? (
          <CreatorOverview onNavigate={navigate} onOpenStudio={openStudio} />
        ) : null}
        {section === "music" ? <StudioCatalogBody initialTab="music" /> : null}
        {section === "stickers" ? <StudioCatalogBody initialTab="stickers" /> : null}
        {section === "design" ? (
          <StudioDesignManager studio={studio} onOpenSource={openSource} />
        ) : null}
        {section === "story" || section === "reel" || section === "post" || section === "source" ? (
          <StudioSourceWorkbench
            studio={studio}
            mode={editorMode}
            onModeChange={setEditorMode}
            onStudioChange={changeStudioTarget}
          />
        ) : null}
        {section === "templates" || section === "brand-kit" || section === "tools" ? (
          <ConnectedManagerScreen
            section={section}
            onOpenStudio={openStudio}
            onOpenSource={openSource}
          />
        ) : null}
        {section === "versions" ? <VersionHistoryPanel /> : null}
      </section>
    </section>
  );
}
