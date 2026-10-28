import { Music2, Paintbrush, Sticker, Video } from "lucide-react";
import { adminMotionCms, adminStudioCatalog } from "../../lib/admin-api";
import { useResource } from "../../app/admin-console/widgets";
import type { CreatorSection, StudioTarget } from "./CreatorManager.types";

export function CreatorOverview({
  onNavigate,
  onOpenStudio,
}: {
  onNavigate: (section: CreatorSection) => void;
  onOpenStudio: (target: StudioTarget) => void;
}) {
  const catalog = useResource(() => adminStudioCatalog(), []);
  const motion = useResource(() => adminMotionCms(), []);
  const tracks = catalog.data?.music ?? [];
  const stickers = catalog.data?.stickers ?? [];
  const metrics = [
    {
      label: "Music tracks",
      value: tracks.length,
      note: `${tracks.filter((item) => item.status === "published").length} published`,
      icon: Music2,
      action: () => onNavigate("music"),
    },
    {
      label: "Sticker assets",
      value: stickers.length,
      note: `${stickers.filter((item) => item.status === "published").length} published`,
      icon: Sticker,
      action: () => onNavigate("stickers"),
    },
    {
      label: "Sticker categories",
      value: catalog.data?.categories.length ?? 0,
      note: "Catalog groups",
      icon: Paintbrush,
      action: () => onNavigate("stickers"),
    },
    {
      label: "Published design version",
      value: motion.data?.publishedVersion ?? "—",
      note: "Motion CMS",
      icon: Video,
      action: () => onNavigate("versions"),
    },
  ];
  return (
    <div className="cm-overview">
      <div className="cm-panel cm-overview-intro">
        <div className="cm-panel-header">
          <div>
            <h2>Creation studios</h2>
            <p>Open each production editor or manage the shared assets and visual system here.</p>
          </div>
        </div>
        <div className="cm-panel-body cm-overview-actions">
          <button className="cm-button cm-button-primary" onClick={() => onOpenStudio("story")}>
            Open Story Studio
          </button>
          <button className="cm-button cm-button-blue" onClick={() => onOpenStudio("reel")}>
            Open Reel Studio
          </button>
          <button className="cm-button" onClick={() => onOpenStudio("post")}>
            Open Post Studio
          </button>
          <button className="cm-button" onClick={() => onNavigate("source")}>
            Open source workbench
          </button>
        </div>
      </div>
      <div className="cm-overview-grid" aria-label="Live Creator Manager statistics">
        {metrics.map(({ label, value, note, icon: Icon, action }) => (
          <button className="cm-overview-card" key={label} onClick={action}>
            <span>
              <Icon size={15} /> {label}
            </span>
            <strong>{value}</strong>
            <span>{note}</span>
          </button>
        ))}
      </div>
      {catalog.error || motion.error ? (
        <p className="cm-unsupported" role="alert">
          {catalog.error || motion.error} Apply the authorized catalog migration and configure the
          administrator service to load live records.
        </p>
      ) : null}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <div>
            <h2>Shared publishing rules</h2>
            <p>
              Music and stickers are available only when their record is published and targets the
              active studio.
            </p>
          </div>
        </div>
        <div className="cm-panel-body cm-overview-grid">
          {(
            [
              ["story", "Story Studio"],
              ["reel", "Reel Studio"],
              ["post", "Post Studio"],
            ] as const
          ).map(([target, label]) => (
            <button key={target} className="cm-overview-card" onClick={() => onOpenStudio(target)}>
              <span>{label}</span>
              <strong>
                {target === "story" ? "9:16" : target === "reel" ? "Timeline" : "Canvas"}
              </strong>
              <span>Open this studio target</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
