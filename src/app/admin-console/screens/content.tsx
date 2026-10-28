import { withCmsDisplaySettings, editableCmsBlocks } from "../../../lib/cms-display-settings.mjs";
import { buildDocumentationDocument } from "../../../features/information/document-source.mjs";
import { informationPages } from "../../../features/information/catalog";
import { useSiteSettings } from "../../../lib/site-settings";
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Monitor, Tablet, Smartphone } from "lucide-react";
import {
  adminCmsPage,
  adminCmsPages,
  adminCmsVersions,
  adminCreateCmsPage,
  adminDeleteCmsPage,
  adminDuplicateCmsPage,
  adminPublishCmsPage,
  adminPatchCmsPage,
  adminPatchRoute,
  adminRestoreCmsVersion,
  adminRoutes,
  type CmsPage,
  type NavItem,
  adminNavigation,
  adminCreateNavigationItem,
  adminPatchNavigationItem,
  adminDeleteNavigationItem,
  adminReorderNavigation,
} from "../../../lib/admin-api";
import { invalidatePublishedCmsPage } from "../../../lib/published-cms-pages";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import { PUBLIC_PAGE_GROUPS, PUBLIC_PAGE_REGISTRY } from "../page-registry";
import { CmsPublicPage, type PublishedCmsPage } from "../../cms-public-page";
import type { CmsContentBlock } from "../../cms-public-page";
import { CmsBlockEditor } from "./cms-block-editor";
import {
  AreaField,
  Card,
  Dialog,
  Empty,
  Loading,
  Notice,
  Pager,
  Pill,
  ReasonDialog,
  SelectField,
  Table,
  TextField,
  ToggleField,
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const PER_PAGE = 20;
const PAGE_STATUSES = ["draft", "published", "scheduled", "disabled"] as const;
const CmsCodeEditor = lazy(() =>
  import("./cms-code-editor").then((module) => ({ default: module.CmsCodeEditor })),
);
const STANDARD_PUBLIC_PAGE_DEFINITIONS = PUBLIC_PAGE_REGISTRY.map((page) => ({
  ...page,
  content: "",
  seo_title: page.title,
  seo_description: "",
}));

function blocksFromLegacyContent(content: string): CmsContentBlock[] {
  return content
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `legacy_${index + 1}`, type: "paragraph", text }));
}

// ---------------------------------------------------------------------------
// CMS pages
// ---------------------------------------------------------------------------

function PageEditor({
  page,
  onClose,
  onSaved,
}: {
  page: CmsPage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const savedDraft = page?.draft_content ?? {};
  const draftText = (key: string, fallback: string) =>
    typeof savedDraft[key] === "string" ? (savedDraft[key] as string) : fallback;
  const [title, setTitle] = useState(draftText("title", page?.title ?? ""));
  const [slug, setSlug] = useState(draftText("slug", page?.slug ?? ""));
  const [route, setRoute] = useState(draftText("route", page?.route ?? ""));
  const [content, setContent] = useState(draftText("content", page?.content ?? ""));
  const [heroImage, setHeroImage] = useState(draftText("hero_image", page?.hero_image ?? ""));
  const [seoTitle, setSeoTitle] = useState(draftText("seo_title", page?.seo_title ?? ""));
  const [seoDescription, setSeoDescription] = useState(
    draftText("seo_description", page?.seo_description ?? ""),
  );
  const [preview, setPreview] = useState(false);
  const [footerEnabled, setFooterEnabled] = useState(
    typeof savedDraft.footer_enabled === "boolean"
      ? savedDraft.footer_enabled
      : (page?.footer_enabled ?? true),
  );
  const [animationEnabled, setAnimationEnabled] = useState(
    typeof savedDraft.animation_enabled === "boolean"
      ? savedDraft.animation_enabled
      : (page?.animation_enabled ?? true),
  );
  const [error, setError] = useState<string | null>(null);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const valid = title.trim().length > 0 && slug.trim().length > 0 && route.trim().startsWith("/");

  const save = () =>
    void guarded(async () => {
      setError(null);
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        route: route.trim(),
        content,
        hero_image: heroImage.trim(),
        seo_title: seoTitle,
        seo_description: seoDescription,
        footer_enabled: footerEnabled,
        animation_enabled: animationEnabled,
      };
      if (page) await adminPatchCmsPage(page.id, payload);
      else await adminCreateCmsPage(payload);
      onSaved();
      onClose();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  return (
    <Dialog
      title={page ? "Edit page" : "New page"}
      description={
        page
          ? "Save changes as a private draft. The published page remains live until you publish this draft."
          : "This page will be saved as a draft. Preview it, then publish when it is ready."
      }
      onClose={onClose}
      actions={
        <>
          <Button type="button" onClick={() => setPreview((value) => !value)}>
            {preview ? "Edit draft" : "Preview draft"}
          </Button>
          <Button type="button" className="admin-primary" disabled={busy || !valid} onClick={save}>
            {busy ? "Saving…" : "Save draft"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {preview ? (
        <div className="cms-preview-frame">
          <div className="eyebrow">VELORI / {slug.toUpperCase().replace(/-/g, " ")}</div>
          {heroImage.trim() ? <img src={heroImage} alt="" className="public-hero" /> : null}
          <h1>{title || "Untitled page"}</h1>
          {seoDescription ? <p className="public-lead">{seoDescription}</p> : null}
          <div className="public-sections">
            {content
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <section key={index}>
                  <p>{paragraph}</p>
                </section>
              ))}
          </div>
          <small>Draft preview. This content is not public until published.</small>
        </div>
      ) : null}
      <TextField label="Title" value={title} onChange={setTitle} />
      <TextField label="Slug" value={slug} onChange={setSlug} />
      <TextField
        label="Route"
        value={route}
        onChange={setRoute}
        hint={`Where this appears: ${route || "set a public path"}`}
      />
      <TextField label="Hero image URL" value={heroImage} onChange={setHeroImage} />
      <AreaField label="Content" value={content} onChange={setContent} rows={10} />
      <TextField label="SEO title" value={seoTitle} onChange={setSeoTitle} />
      <TextField label="SEO description" value={seoDescription} onChange={setSeoDescription} />
      <ToggleField label="Show the footer" checked={footerEnabled} onChange={setFooterEnabled} />
      <ToggleField
        label="Play the page animation"
        checked={animationEnabled}
        onChange={setAnimationEnabled}
      />
    </Dialog>
  );
}

function VersionHistory({
  pageId,
  onClose,
  onRestored,
}: {
  pageId: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const versions = useResource(() => adminCmsVersions(pageId), [pageId]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  return (
    <Dialog
      title="Version history"
      description="Restoring creates a snapshot of the current page first, so the restore is itself reversible."
      onClose={onClose}
      actions={
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      }
    >
      {versions.loading ? <Loading label="Loading versions" /> : null}
      {versions.error ? <Notice tone="error">{versions.error}</Notice> : null}
      {versions.data?.versions?.length ? (
        <Table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Title</th>
              <th>Saved</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.data.versions.map((row) => {
              const version = row as Record<string, unknown>;
              const label = String(version.version_label ?? "");
              return (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{String(version.title ?? "")}</td>
                  <td>{formatDate(version.created_at as string)}</td>
                  <td>
                    <Button type="button" onClick={() => setRestoring(label)}>
                      Restore
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Empty>No versions have been recorded for this page.</Empty>
      )}

      {restoring ? (
        <ReasonDialog
          title={`Restore ${restoring}?`}
          description="The page returns to this version as a draft. Nothing is published automatically."
          confirmLabel="Restore version"
          busy={busy}
          minimumLength={4}
          onClose={() => setRestoring(null)}
          onConfirm={async () => {
            await guarded(async () => {
              await adminRestoreCmsVersion(pageId, restoring);
              setRestoring(null);
              versions.reload();
              onRestored();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function CmsBody() {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<CmsPage | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CmsPage | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const canEdit = usePermission("cms.edit");
  const canPublish = usePermission("cms.publish");
  const canDelete = usePermission("cms.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const pages = useResource(
    () => adminCmsPages({ page, perPage: PER_PAGE, status: status === "all" ? undefined : status }),
    [page, status],
  );
  const registryPages = useResource(() => adminCmsPages({ page: 1, perPage: 100 }), []);

  const rows = pages.data?.pages ?? [];
  const registeredPages = registryPages.data?.pages ?? [];

  useEffect(() => {
    if (new URLSearchParams(location.search).get("create") !== "1") return;
    navigate(location.pathname, { replace: true });
    if (canEdit) setEditing(null);
  }, [canEdit, location.pathname, location.search, navigate]);

  const openStandardPage = async (
    definition: (typeof STANDARD_PUBLIC_PAGE_DEFINITIONS)[number],
  ) => {
    const existing = registeredPages.find(
      (row) => row.route === definition.route || row.slug === definition.slug,
    );
    if (existing) {
      navigate(`/admin/pages/${existing.id}`);
      return;
    }
    await guarded(async () => {
      const created = await adminCreateCmsPage({
        ...(informationPages[definition.slug] ? buildDocumentationDocument(definition.slug) : {}),
        title: definition.title,
        slug: definition.slug,
        route: definition.route,
        content: informationPages[definition.slug]
          ? buildDocumentationDocument(definition.slug).content
          : definition.content,
        seo_title: definition.seo_title,
        seo_description: definition.seo_description,
        hero_image: "",
        footer_enabled: true,
        animation_enabled: true,
      });
      const pageRow = created?.page ?? null;
      if (pageRow) navigate(`/admin/pages/${pageRow.id}`);
      pages.reload();
    }).catch(() => undefined);
  };

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>CMS pages</Heading1>
          <p>
            Footer links are managed on the Site directory page: use its Content blocks to rename,
            reorder or hide links, then publish. HTML, CSS and JavaScript remain editable in Page
            Studio.
          </p>
          <p>
            Every page is versioned. Deleting a page disables it rather than erasing it, so the
            route registry and the audit trail keep referring to something real.
          </p>
        </div>
        <div className="admin-row-actions">
          <a className="admin-button" href="#cms-forge">
            Forge guides & billing pages
          </a>
          {canEdit ? (
            <Button type="button" className="admin-primary" onClick={() => setEditing(null)}>
              New page
            </Button>
          ) : null}
          <Button type="button" onClick={pages.reload}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="admin-toolbar">
        <SelectField
          label="Status"
          value={status}
          options={[
            { value: "all", label: "All" },
            ...PAGE_STATUSES.map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      <Card
        title="Standard public pages"
        subtitle="Create and manage each public route independently. Existing entries open in Page Studio."
      >
        {registryPages.error ? <Notice tone="error">{registryPages.error}</Notice> : null}
        <div className="cms-page-groups">
          {PUBLIC_PAGE_GROUPS.map((group) => (
            <section className="cms-page-group" id={`cms-${group.id}`} key={group.id}>
              <h3>{group.label}</h3>
              <div className="admin-grid admin-standard-pages">
                {STANDARD_PUBLIC_PAGE_DEFINITIONS.filter(
                  (definition) => definition.group === group.id,
                ).map((definition) => {
                  const existing = registeredPages.find(
                    (row) => row.route === definition.route || row.slug === definition.slug,
                  );
                  const hasPage = Boolean(existing);
                  const statusLabel = existing
                    ? existing.status === "published"
                      ? existing.draft_content
                        ? "Published · draft changes"
                        : "Published"
                      : existing.status.charAt(0).toUpperCase() + existing.status.slice(1)
                    : "Not created";
                  const statusTone =
                    existing?.status === "published"
                      ? "ok"
                      : existing?.status === "disabled"
                        ? "fail"
                        : "warn";

                  return (
                    <div key={definition.route} className="admin-standard-page-item">
                      <div className="cms-page-item-copy">
                        <strong>{definition.title}</strong>
                        <span>{definition.route}</span>
                        <div className="cms-page-item-status">
                          <Pill tone={statusTone}>{statusLabel}</Pill>
                          {existing ? (
                            <span>
                              Updated {formatDate(existing.draft_updated_at ?? existing.updated_at)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        className={hasPage ? "admin-secondary" : "admin-primary"}
                        disabled={busy || registryPages.loading || Boolean(registryPages.error)}
                        onClick={() => void openStandardPage(definition)}
                      >
                        {hasPage ? "Open Studio" : "Create page"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>

      {pages.loading ? <Loading label="Loading pages" /> : null}
      {pages.error ? <Notice tone="error">{pages.error}</Notice> : null}

      {!pages.loading && !pages.error ? (
        <Card title="Pages" subtitle={`${pages.data?.total ?? 0} pages.`}>
          {rows.length === 0 ? (
            <Empty>No pages match that filter.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.route}</td>
                    <td>
                      <Pill
                        tone={
                          row.status === "published"
                            ? "ok"
                            : row.status === "disabled"
                              ? "fail"
                              : "warn"
                        }
                      >
                        {row.draft_content
                          ? row.status === "published"
                            ? "Live · draft changes"
                            : "Draft"
                          : row.status}
                      </Pill>
                    </td>
                    <td>{formatDate(row.updated_at)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Button type="button" onClick={() => setHistory(row.id)}>
                          History
                        </Button>
                        {canEdit ? (
                          <Button type="button" onClick={() => navigate(`/admin/pages/${row.id}`)}>
                            Open Studio
                          </Button>
                        ) : null}
                        {canPublish && (row.status !== "published" || row.draft_content) ? (
                          <Button
                            type="button"
                            onClick={() =>
                              void guarded(async () => {
                                await adminPublishCmsPage(
                                  row.id,
                                  row.draft_content ? "Published page draft" : "Published page",
                                );
                                pages.reload();
                              }).catch(() => undefined)
                            }
                          >
                            Publish draft
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void guarded(async () => {
                              await adminDuplicateCmsPage(row.id);
                              pages.reload();
                            }).catch(() => undefined)
                          }
                        >
                          Duplicate
                        </Button>
                        {canDelete ? (
                          <Button type="button" onClick={() => setDeleting(row)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={pages.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {editing !== undefined ? (
        <PageEditor page={editing} onClose={() => setEditing(undefined)} onSaved={pages.reload} />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title={`Delete "${deleting.title}"?`}
          description="The page is disabled rather than erased, and can be restored by setting it back to draft."
          confirmLabel="Disable page"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminDeleteCmsPage(deleting.id, reason);
              setDeleting(null);
              pages.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}

      {history ? (
        <VersionHistory
          pageId={history}
          onClose={() => setHistory(null)}
          onRestored={pages.reload}
        />
      ) : null}
    </>
  );
}

function CmsPageStudioBody() {
  const siteSettings = useSiteSettings();
  const { pageId = "" } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<"draft" | "published" | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [panel, setPanel] = useState<
    "content" | "html" | "seo" | "appearance" | "javascript" | "settings"
  >("content");
  const [showHistory, setShowHistory] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const canEdit = usePermission("cms.edit");
  const canPublish = usePermission("cms.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminCmsPage(pageId);
      const loaded = result.page;
      const source = loaded.draft_content ?? loaded;
      setPage(loaded);
      setFields({
        title: source.title ?? loaded.title,
        slug: source.slug ?? loaded.slug,
        route: source.route ?? loaded.route,
        content: source.content ?? loaded.content,
        content_blocks:
          Array.isArray(source.content_blocks) && source.content_blocks.length > 0
            ? source.content_blocks
            : blocksFromLegacyContent(String(source.content ?? loaded.content ?? "")),
        content_mode: source.content_mode ?? loaded.content_mode ?? "visual",
        hero_image: source.hero_image ?? loaded.hero_image ?? "",
        custom_html: source.custom_html ?? loaded.custom_html ?? "",
        custom_css: source.custom_css ?? loaded.custom_css ?? "",
        custom_js: source.custom_js ?? loaded.custom_js ?? "",
        seo_title: source.seo_title ?? loaded.seo_title ?? "",
        seo_description: source.seo_description ?? loaded.seo_description ?? "",
        og_title: source.og_title ?? loaded.og_title ?? "",
        og_description: source.og_description ?? loaded.og_description ?? "",
        footer_enabled: source.footer_enabled ?? loaded.footer_enabled,
        animation_enabled: source.animation_enabled ?? loaded.animation_enabled,
      });
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [pageId]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  const update = (key: string, value: unknown) => {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice("");
  };
  const value = (key: string) => String(fields[key] ?? "");
  // Mirrors the server-side CMS HTML rule; keep in sync with cms-html.ts.
  const htmlEditorHasEmbeds =
    /<!doctype|<\s*(?:html|head|body|meta|link|base|title|style|script)\b/i.test(
      value("custom_html").replace(/<!--[\s\S]*?-->/g, ""),
    );
  const persistDraft = async () => {
    setError("");
    setNotice("Saving...");
    setSaving(true);
    let next: Awaited<ReturnType<typeof adminPatchCmsPage>> | undefined;
    try {
      await guarded(async () => {
        next = await adminPatchCmsPage(pageId, withCmsDisplaySettings(fields));
        setPage(next.page);
        const draft = next.page.draft_content ?? {};
        setFields((current) => ({ ...current, ...draft }));
        setDirty(false);
        setNotice("Saved just now.");
      });
      setSaving(false);
      return next ?? null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setNotice("Save failed — retry");
      setSaving(false);
      throw cause;
    }
  };
  const saveDraft = async () => {
    await persistDraft();
  };

  useEffect(() => {
    if (!canEdit || !dirty || !pageId) return;
    const timeout = window.setTimeout(() => {
      void persistDraft().catch(() => undefined);
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [canEdit, dirty, pageId, fields]);
  const publish = async () => {
    const needsSave = dirty;
    if (
      needsSave &&
      !window.confirm("Unsaved changes detected. Save these changes and publish them?")
    )
      return;
    if (!window.confirm(`Publish "${value("title")}" to ${value("route")}?`)) return;
    setError("");
    setNotice("");
    setPublishing(true);
    try {
      const saved = await persistDraft();
      if (!saved)
        throw new Error(
          "The draft was not saved. Complete the administrator verification and try again.",
        );
      const draftVersion = saved.page ?? page;
      const result = await adminPublishCmsPage(
        pageId,
        "Published from Page Studio",
        draftVersion?.draft_updated_at ?? null,
      );
      if (!result.page || result.page.status !== "published") {
        throw new Error("The server did not confirm that this page was published.");
      }
      const verified = await adminCmsPage(pageId);
      if (
        verified.page.status !== "published" ||
        verified.page.published_version !== result.version
      ) {
        throw new Error(
          "The published page could not be verified. Refresh the page before retrying.",
        );
      }
      setPage(verified.page);
      setFields((current) => ({ ...current, ...(verified.page.draft_content ?? {}) }));
      setNotice(`Published successfully · Version ${result.version}`);
      // Drop the public snapshot cache so the new HTML/CSS/JS shows immediately.
      invalidatePublishedCmsPage(verified.page.route);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPublishing(false);
    }
  };

  const definition = page
    ? PUBLIC_PAGE_REGISTRY.find((item) => item.route === page.route || item.slug === page.slug)
    : undefined;
  const publishedPreview = page
    ? {
        title: page.title,
        slug: page.slug,
        route: page.route,
        content: page.content,
        seo_title: page.seo_title,
        seo_description: page.seo_description,
        hero_image: page.hero_image,
        custom_html: page.custom_html,
        custom_css: page.custom_css,
        custom_js: page.custom_js,
        content_mode: page.content_mode,
        content_blocks: page.content_blocks as CmsContentBlock[],
      }
    : null;
  const draftPreview = {
    title: value("title"),
    slug: value("slug"),
    route: value("route"),
    content: value("content"),
    seo_title: value("seo_title") || null,
    seo_description: value("seo_description") || null,
    hero_image: value("hero_image") || null,
    custom_html: value("custom_html"),
    custom_css: value("custom_css"),
    custom_js: value("custom_js"),
    content_mode: (fields.content_mode as "visual" | "custom_html") ?? "visual",
    content_blocks: (fields.content_blocks as CmsContentBlock[]) ?? [],
    animation_enabled: fields.animation_enabled !== false,
    footer_enabled: fields.footer_enabled !== false,
  };
  const previewWidth = viewport === "mobile" ? 390 : viewport === "tablet" ? 820 : 1440;

  return (
    <>
      <div className="cms-studio-header">
        <div className="cms-studio-title">
          <Button
            type="button"
            onClick={() => {
              if (!dirty || window.confirm("You have unsaved changes. Leave this page?")) {
                navigate("/admin/website/pages");
              }
            }}
          >
            <ArrowLeft size={16} /> Pages
          </Button>
          <div>
            <Heading1>{page?.title ?? "Page Studio"}</Heading1>
            <p>
              {page?.route ?? "Loading page route"} · {definition?.type ?? "Custom page"}
            </p>
          </div>
        </div>
        <div className="cms-studio-actions">
          {page && informationPages[page.slug] && canEdit ? (
            <Button
              type="button"
              disabled={busy || saving || publishing}
              onClick={() => {
                if (
                  !window.confirm(
                    "Replace this draft with the current VELORI design? Published content stays unchanged until you publish.",
                  )
                )
                  return;
                setFields((previous) => ({
                  ...previous,
                  ...buildDocumentationDocument(page.slug, {
                    contactEmail: siteSettings.contact_email,
                    contactPhone: siteSettings.contact_phone,
                  }),
                }));
                setDirty(true);
                setNotice(
                  "Current design loaded into draft. Review HTML, CSS and JavaScript, then publish.",
                );
              }}
            >
              Load VELORI design
            </Button>
          ) : null}
          {page ? (
            <Button
              type="button"
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      { release: "velori-editorial-2026-10-24-r2", ...fields },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = page.slug + "-cms-source.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export page source
            </Button>
          ) : null}
          {page ? (
            <Pill tone={page.status === "published" ? "ok" : "warn"}>
              {page.status === "published" ? "Published" : "Draft"}
            </Pill>
          ) : null}
          <Button type="button" onClick={() => setPreview(preview ? null : "draft")}>
            {preview ? "Close preview" : "Preview draft"}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              disabled={busy || saving || !dirty}
              onClick={() => void saveDraft()}
            >
              {saving ? "Saving..." : "Save draft"}
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              type="button"
              className="admin-primary"
              disabled={
                busy ||
                saving ||
                publishing ||
                !value("title").trim() ||
                !value("slug").trim() ||
                !value("route").trim().startsWith("/") ||
                (fields.content_mode === "custom_html"
                  ? !value("custom_html").trim()
                  : !(
                      (Array.isArray(fields.content_blocks) && fields.content_blocks.length > 0) ||
                      value("content").trim() ||
                      value("custom_html").trim()
                    ))
              }
              onClick={() => void publish()}
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          ) : null}
          <Button type="button" onClick={() => setShowHistory(true)} disabled={!page}>
            History
          </Button>
        </div>
      </div>

      {page ? (
        <p className="cms-studio-meta">
          {saving ? "Saving..." : dirty ? "Unsaved changes" : notice || "Saved"} ·{" "}
          {page.published_version ? `Version ${page.published_version} · ` : ""}Last published{" "}
          {formatDate(page.published_at)} · Updated{" "}
          {formatDate(page.draft_updated_at ?? page.updated_at)}
        </p>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <Loading label="Loading page" /> : null}
      {!loading && !page && !error ? <Empty>This page could not be loaded.</Empty> : null}

      {page ? (
        <div className={`cms-studio-layout${preview ? " is-previewing" : ""}`}>
          <nav className="cms-studio-nav" aria-label="Page settings">
            <span>PAGE</span>
            <button
              type="button"
              aria-current={panel === "content"}
              onClick={() => setPanel("content")}
            >
              Content
            </button>
            <button
              type="button"
              aria-current={panel === "html"}
              onClick={() => {
                update("content_mode", "custom_html");
                setPanel("html");
              }}
            >
              Custom HTML
            </button>
            <button type="button" aria-current={panel === "seo"} onClick={() => setPanel("seo")}>
              SEO & metadata
            </button>
            <button
              type="button"
              aria-current={panel === "appearance"}
              onClick={() => setPanel("appearance")}
            >
              CSS & appearance
            </button>
            <button
              type="button"
              aria-current={panel === "javascript"}
              onClick={() => setPanel("javascript")}
            >
              JavaScript
            </button>
            <button
              type="button"
              aria-current={panel === "settings"}
              onClick={() => setPanel("settings")}
            >
              Settings
            </button>
            <button type="button" onClick={() => setShowHistory(true)}>
              Version history
            </button>
          </nav>

          <section className="cms-studio-editor" aria-label="Page editor">
            {panel === "content" ? (
              <>
                <TextField
                  label="Page title"
                  value={value("title")}
                  onChange={(next) => update("title", next)}
                />
                <TextField
                  label="Slug"
                  value={value("slug")}
                  onChange={(next) => update("slug", next)}
                />
                <TextField
                  label="Canonical route"
                  value={value("route")}
                  onChange={(next) => update("route", next)}
                />
                <TextField
                  label="Hero image URL"
                  value={value("hero_image")}
                  onChange={(next) => update("hero_image", next)}
                />
                <AreaField
                  label="Page summary"
                  value={value("content")}
                  onChange={(next) => update("content", next)}
                  rows={4}
                  hint="Used as fallback content for older pages without visual blocks."
                />
                <div className="cms-content-mode" role="group" aria-label="Page content mode">
                  <Button
                    type="button"
                    className={fields.content_mode !== "custom_html" ? "admin-primary" : ""}
                    aria-pressed={fields.content_mode !== "custom_html"}
                    onClick={() => update("content_mode", "visual")}
                  >
                    Visual blocks
                  </Button>
                  <Button
                    type="button"
                    className={fields.content_mode === "custom_html" ? "admin-primary" : ""}
                    aria-pressed={fields.content_mode === "custom_html"}
                    onClick={() => {
                      update("content_mode", "custom_html");
                      setPanel("html");
                    }}
                  >
                    Custom HTML
                  </Button>
                </div>
                {fields.content_mode === "custom_html" && page?.slug !== "directory" ? (
                  <Notice>
                    Custom HTML is the selected content source. Visual blocks are preserved but not
                    rendered until Visual blocks mode is selected.
                  </Notice>
                ) : (
                  <CmsBlockEditor
                    blocks={editableCmsBlocks(
                      (Array.isArray(fields.content_blocks)
                        ? fields.content_blocks
                        : []) as CmsContentBlock[],
                    )}
                    onChange={(contentBlocks) => update("content_blocks", contentBlocks)}
                  />
                )}
              </>
            ) : null}
            {panel === "html" ? (
              <>
                <div className="cms-content-mode" role="group" aria-label="Page content mode">
                  <Button
                    type="button"
                    aria-pressed={fields.content_mode !== "custom_html"}
                    onClick={() => {
                      update("content_mode", "visual");
                      setPanel("content");
                    }}
                  >
                    Visual blocks
                  </Button>
                  <Button
                    type="button"
                    className="admin-primary"
                    aria-pressed={fields.content_mode === "custom_html"}
                    onClick={() => update("content_mode", "custom_html")}
                  >
                    Custom HTML
                  </Button>
                  <Button type="button" onClick={() => setPreview("draft")}>
                    Preview draft
                  </Button>
                </div>
                <label className="cms-code-label">Custom HTML source</label>
                <Suspense fallback={<Loading label="Loading HTML editor" />}>
                  <CmsCodeEditor
                    language="html"
                    value={value("custom_html")}
                    height="min(62vh, 680px)"
                    onChange={(next) => {
                      update("custom_html", next);
                      // Editing the HTML source means the source should render.
                      if (fields.content_mode !== "custom_html") {
                        update("content_mode", "custom_html");
                      }
                    }}
                  />
                </Suspense>
                {htmlEditorHasEmbeds ? (
                  <Notice>
                    This input contains a full-document wrapper or a &lt;style&gt;/&lt;script&gt;
                    block, which the server rejects instead of silently dropping. Paste only this
                    page&apos;s body HTML here, move styles to the CSS &amp; appearance tab, and
                    move scripts to the JavaScript tab.
                  </Notice>
                ) : null}
                <Notice>
                  Before persistence, the server strips event handlers and unsafe URLs, and only
                  allow-listed tags, attributes, and classes survive. Preview uses the actual public
                  renderer in a restricted sandbox.
                </Notice>
              </>
            ) : null}
            {panel === "seo" ? (
              <>
                <TextField
                  label="Browser title"
                  value={value("seo_title")}
                  onChange={(next) => update("seo_title", next)}
                />
                <AreaField
                  label="Meta description"
                  value={value("seo_description")}
                  onChange={(next) => update("seo_description", next)}
                  rows={4}
                />
                <TextField
                  label="Open Graph title"
                  value={value("og_title")}
                  onChange={(next) => update("og_title", next)}
                />
                <AreaField
                  label="Open Graph description"
                  value={value("og_description")}
                  onChange={(next) => update("og_description", next)}
                  rows={4}
                />
              </>
            ) : null}
            {panel === "appearance" ? (
              <>
                <ToggleField
                  label="Show the site footer"
                  checked={Boolean(fields.footer_enabled)}
                  onChange={(next) => update("footer_enabled", next)}
                />
                <ToggleField
                  label="Enable page animation"
                  checked={Boolean(fields.animation_enabled)}
                  onChange={(next) => update("animation_enabled", next)}
                />
                <Notice>
                  Custom markup and styles render inside an isolated page frame, never across the
                  VELORI application.
                </Notice>
                <label className="cms-code-label">Custom CSS</label>
                <Suspense fallback={<Loading label="Loading CSS editor" />}>
                  <CmsCodeEditor
                    language="css"
                    value={value("custom_css")}
                    height="min(48vh, 520px)"
                    onChange={(next) => update("custom_css", next)}
                  />
                </Suspense>
                <Notice>
                  Enter plain CSS source only, without a &lt;style&gt; wrapper. HTTPS imports and
                  resources plus local/same-origin assets are supported. HTTP and protocol-relative
                  URLs, unsafe schemes, expression(), behavior, and -moz-binding are blocked. Modern
                  CSS is parsed and invalid syntax is reported before the draft is saved.
                </Notice>
              </>
            ) : null}
            {panel === "javascript" ? (
              <>
                <div className="cms-content-mode" role="group" aria-label="Page content mode">
                  <Button
                    type="button"
                    aria-pressed={fields.content_mode !== "custom_html"}
                    onClick={() => {
                      update("content_mode", "visual");
                      setPanel("content");
                    }}
                  >
                    Visual blocks
                  </Button>
                  <Button
                    type="button"
                    className="admin-primary"
                    aria-pressed={fields.content_mode === "custom_html"}
                    onClick={() => update("content_mode", "custom_html")}
                  >
                    Custom HTML
                  </Button>
                  <Button type="button" onClick={() => setPreview("draft")}>
                    Preview draft
                  </Button>
                </div>
                <label className="cms-code-label">Custom JavaScript</label>
                <Suspense fallback={<Loading label="Loading JavaScript editor" />}>
                  <CmsCodeEditor
                    language="javascript"
                    value={value("custom_js")}
                    height="min(48vh, 520px)"
                    onChange={(next) => update("custom_js", next)}
                  />
                </Suspense>
                <Notice>
                  JavaScript runs inside the isolated public page sandbox. Only same-origin
                  fetch/XHR and standard DOM APIs are available. Network requests to external hosts
                  and unsafe eval patterns are blocked by the page CSP.
                </Notice>
              </>
            ) : null}
            {panel === "settings" ? (
              <>
                <TextField
                  label="Slug"
                  value={value("slug")}
                  onChange={(next) => update("slug", next)}
                />
                <TextField
                  label="Canonical route"
                  value={value("route")}
                  onChange={(next) => update("route", next)}
                />
                <TextField
                  label="Hero image URL"
                  value={value("hero_image")}
                  onChange={(next) => update("hero_image", next)}
                />
                <ToggleField
                  label="Show the site footer"
                  checked={Boolean(fields.footer_enabled)}
                  onChange={(next) => update("footer_enabled", next)}
                />
                <ToggleField
                  label="Enable page animation"
                  checked={Boolean(fields.animation_enabled)}
                  onChange={(next) => update("animation_enabled", next)}
                />
              </>
            ) : null}
            {preview ? (
              <div className="cms-studio-preview-controls">
                <strong>{preview === "draft" ? "Draft preview" : "Published preview"}</strong>
                <div className="admin-row-actions">
                  <Button
                    type="button"
                    aria-label="Desktop preview"
                    onClick={() => setViewport("desktop")}
                  >
                    <Monitor size={16} />
                  </Button>
                  <Button
                    type="button"
                    aria-label="Tablet preview"
                    onClick={() => setViewport("tablet")}
                  >
                    <Tablet size={16} />
                  </Button>
                  <Button
                    type="button"
                    aria-label="Mobile preview"
                    onClick={() => setViewport("mobile")}
                  >
                    <Smartphone size={16} />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setPreview(preview === "draft" ? "published" : "draft")}
                  >
                    {preview === "draft" ? "View published" : "View draft"}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {preview ? (
            <div className="cms-studio-preview" aria-label={`${preview} page preview`}>
              <div
                className="cms-studio-preview-frame"
                style={{ width: `min(100%, ${previewWidth}px)` }}
              >
                <CmsPublicPage
                  page={(preview === "draft" ? draftPreview : publishedPreview) as PublishedCmsPage}
                  interactiveLinks={false}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showHistory && page ? (
        <VersionHistory
          pageId={page.id}
          onClose={() => setShowHistory(false)}
          onRestored={() => void reload()}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAV_ROLES = [
  "all",
  "admin",
  "super_admin",
  "moderator",
  "content_manager",
  "support",
] as const;

function NavigationEditor({
  item,
  onClose,
  onSaved,
}: {
  item: NavItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [route, setRoute] = useState(item?.route ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "");
  const [requiredRole, setRequiredRole] = useState(item?.required_role ?? "all");
  const [featureFlag, setFeatureFlag] = useState(item?.feature_flag ?? "");
  const [scope, setScope] = useState<string>(item?.navigation_scope ?? "");
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [desktopVisible, setDesktopVisible] = useState(item?.desktop_visible ?? true);
  const [mobileVisible, setMobileVisible] = useState(item?.mobile_visible ?? true);
  const [error, setError] = useState<string | null>(null);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const valid = label.trim().length > 0 && route.trim().startsWith("/");

  const save = () =>
    void guarded(async () => {
      setError(null);
      const payload: Record<string, unknown> = {
        label: label.trim(),
        route: route.trim(),
        icon: icon.trim(),
        required_role: requiredRole,
        feature_flag: featureFlag.trim(),
        visible,
        desktop_visible: desktopVisible,
        mobile_visible: mobileVisible,
      };
      if (scope) payload.navigation_scope = scope;
      if (item) await adminPatchNavigationItem(item.id, payload);
      else await adminCreateNavigationItem(payload);
      onSaved();
      onClose();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  return (
    <Dialog
      title={item ? "Edit navigation entry" : "New navigation entry"}
      description="Entries in the administrator scope are not exposed to the public app's navigation query."
      onClose={onClose}
      actions={
        <>
          <Button type="button" className="admin-primary" disabled={busy || !valid} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField label="Label" value={label} onChange={setLabel} />
      <TextField label="Route" value={route} onChange={setRoute} hint="Must start with /" />
      <TextField label="Icon" value={icon} onChange={setIcon} />
      <SelectField
        label="Required role"
        value={requiredRole}
        options={NAV_ROLES.map((value) => ({ value, label: value }))}
        onChange={setRequiredRole}
      />
      <SelectField
        label="Scope"
        value={scope || "default"}
        options={[
          { value: "default", label: "Not set" },
          { value: "public", label: "Public" },
          { value: "admin", label: "Administrator" },
        ]}
        onChange={(value) => setScope(value === "default" ? "" : value)}
        hint="Requires the navigation scope migration."
      />
      <TextField
        label="Feature flag"
        value={featureFlag}
        onChange={setFeatureFlag}
        hint="Optional. Hides the entry while the flag is off."
      />
      <ToggleField label="Visible" checked={visible} onChange={setVisible} />
      <ToggleField label="Show on desktop" checked={desktopVisible} onChange={setDesktopVisible} />
      <ToggleField label="Show on mobile" checked={mobileVisible} onChange={setMobileVisible} />
    </Dialog>
  );
}

function NavigationBody() {
  const [scope, setScope] = useState<string>("");
  const [editing, setEditing] = useState<NavItem | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<NavItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = usePermission("navigation.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const navigation = useResource(
    () => adminNavigation(scope ? (scope as "public" | "admin") : undefined),
    [scope],
  );

  const rows = navigation.data?.navigation ?? [];
  const scoped = (navigation.data?.scopes ?? []).length > 0;

  const move = (index: number, direction: -1 | 1) => {
    const next = rows.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    void guarded(async () => {
      setError(null);
      await adminReorderNavigation(next.map((item) => item.id));
      navigation.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );
  };

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Navigation</Heading1>
          <p>
            Order matters: the list is rendered top to bottom. The console refuses to remove the
            last administrator-scope link into itself.
          </p>
        </div>
        <div className="admin-row-actions">
          {canEdit ? (
            <Button type="button" className="admin-primary" onClick={() => setEditing(null)}>
              New entry
            </Button>
          ) : null}
          <Button type="button" onClick={navigation.reload}>
            Refresh
          </Button>
        </div>
      </div>

      {scoped ? (
        <div className="admin-toolbar">
          <SelectField
            label="Scope"
            value={scope || "all"}
            options={[
              { value: "all", label: "All" },
              { value: "public", label: "Public" },
              { value: "admin", label: "Administrator" },
            ]}
            onChange={(value) => setScope(value === "all" ? "" : value)}
          />
        </div>
      ) : (
        <Notice>
          This deployment has a single navigation table. Apply migration 20261016000000 to split
          public and administrator navigation.
        </Notice>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {navigation.loading ? <Loading label="Loading navigation" /> : null}
      {navigation.error ? <Notice tone="error">{navigation.error}</Notice> : null}

      {!navigation.loading && !navigation.error ? (
        <Card title="Entries" subtitle={`${rows.length} entries.`}>
          {rows.length === 0 ? (
            <Empty>No navigation entries.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Route</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Shown</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>{row.route}</td>
                    <td>{row.required_role}</td>
                    <td>{row.navigation_scope ?? "—"}</td>
                    <td>
                      <Pill tone={row.visible ? "ok" : "warn"}>
                        {row.visible ? "visible" : "hidden"}
                      </Pill>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {canEdit ? (
                          <>
                            <Button
                              type="button"
                              disabled={index === 0 || busy}
                              onClick={() => move(index, -1)}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              disabled={index === rows.length - 1 || busy}
                              onClick={() => move(index, 1)}
                            >
                              Down
                            </Button>
                            <Button type="button" onClick={() => setEditing(row)}>
                              Edit
                            </Button>
                          </>
                        ) : null}
                        {canEdit ? (
                          <Button type="button" onClick={() => setDeleting(row)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {editing !== undefined ? (
        <NavigationEditor
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={navigation.reload}
        />
      ) : null}

      {deleting ? (
        <ReasonDialog
          title={`Delete "${deleting.label}"?`}
          description="The entry is removed from navigation. The route itself is unaffected."
          confirmLabel="Delete entry"
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async (reason) => {
            await guarded(async () => {
              await adminDeleteNavigationItem(deleting.id, reason);
              setDeleting(null);
              navigation.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Route registry
// ---------------------------------------------------------------------------

function RoutesBody() {
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const canEdit = usePermission("navigation.edit");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);

  const routes = useResource(() => adminRoutes({ page, perPage: PER_PAGE }), [page]);
  const rows = (routes.data?.routes ?? []) as Record<string, unknown>[];

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Route registry</Heading1>
          <p>
            The routes the application registers. Disabling one here is recorded and can be
            reverted; it is not the same as deleting a CMS page.
          </p>
        </div>
      </div>

      {routes.loading ? <Loading label="Loading routes" /> : null}
      {routes.error ? <Notice tone="error">{routes.error}</Notice> : null}

      {!routes.loading && !routes.error ? (
        <Card title="Routes" subtitle={`${routes.data?.total ?? 0} routes.`}>
          {rows.length === 0 ? (
            <Empty>No routes are registered.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Label</th>
                  <th>State</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id ?? row.path)}>
                    <td>{String(row.path ?? "—")}</td>
                    <td>{String(row.label ?? "—")}</td>
                    <td>
                      <Pill tone={row.enabled === false ? "warn" : "ok"}>
                        {row.enabled === false ? "disabled" : "enabled"}
                      </Pill>
                    </td>
                    <td>{formatDate(row.updated_at as string)}</td>
                    <td>
                      {canEdit ? (
                        <Button type="button" onClick={() => setTarget(row)}>
                          Edit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager page={page} perPage={PER_PAGE} total={routes.data?.total} onPage={setPage} />
        </Card>
      ) : null}

      {target ? (
        <RouteEditor
          route={target}
          busy={busy}
          onClose={() => setTarget(null)}
          onSave={async (payload) => {
            await guarded(async () => {
              await adminPatchRoute(String(target.path ?? ""), payload);
              setTarget(null);
              routes.reload();
            }).catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}

function RouteEditor({
  route,
  busy,
  onClose,
  onSave,
}: {
  route: Record<string, unknown>;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [label, setLabel] = useState(String(route.label ?? ""));
  const [description, setDescription] = useState(String(route.description ?? ""));
  const [metaTitle, setMetaTitle] = useState(String(route.meta_title ?? ""));
  const [metaDescription, setMetaDescription] = useState(String(route.meta_description ?? ""));
  const [enabled, setEnabled] = useState(route.enabled !== false);
  const [maintenanceOverride, setMaintenanceOverride] = useState(
    route.maintenance_override === true,
  );

  useEffect(() => setEnabled(route.enabled !== false), [route]);

  return (
    <Dialog
      title={`Edit ${String(route.path ?? "route")}`}
      description="Route metadata is used by the public shell for titles and descriptions."
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            className="admin-primary"
            disabled={busy || label.trim().length === 0}
            onClick={() =>
              void onSave({
                label: label.trim(),
                description: description.trim(),
                meta_title: metaTitle.trim(),
                meta_description: metaDescription.trim(),
                enabled,
                maintenance_override: maintenanceOverride,
              })
            }
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <TextField label="Label" value={label} onChange={setLabel} />
      <AreaField label="Description" value={description} onChange={setDescription} rows={3} />
      <TextField label="Meta title" value={metaTitle} onChange={setMetaTitle} />
      <TextField label="Meta description" value={metaDescription} onChange={setMetaDescription} />
      <ToggleField label="Enabled" checked={enabled} onChange={setEnabled} />
      <ToggleField
        label="Stays available during maintenance"
        checked={maintenanceOverride}
        onChange={setMaintenanceOverride}
      />
    </Dialog>
  );
}

export function WebsiteScreen() {
  const canCms = usePermission("cms.view");
  const canNav = usePermission("navigation.view");
  const canBrand = usePermission("branding.view");

  return (
    <ConsoleScreen anyOf={["cms.view", "navigation.view", "branding.view"]}>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Website control center</Heading1>
          <p>
            Manage the public VELORI experience, published pages, navigation, brand assets and site
            metadata from one place.
          </p>
        </div>
      </div>

      <div className="admin-command-grid" aria-label="Website admin areas">
        {canCms ? (
          <a className="admin-command-tile tone-blue" href="/admin/cms">
            <span className="admin-command-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3.5" y="5" width="17" height="14" rx="2" />
                <path d="M3.5 9.5h17M8 18.5v-13M13 18.5v-13" />
              </svg>
            </span>
            <div className="admin-command-tile-body">
              <div className="admin-command-tile-head">
                <span>Pages</span>
                <span className="admin-command-chevron">→</span>
              </div>
              <p>
                Edit published pages, blog-style content, About, Contact, Help, Privacy and Terms.
              </p>
              <strong>Page editor</strong>
            </div>
          </a>
        ) : null}

        {canNav ? (
          <a className="admin-command-tile tone-pink" href="/admin/navigation">
            <span className="admin-command-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" />
              </svg>
            </span>
            <div className="admin-command-tile-body">
              <div className="admin-command-tile-head">
                <span>Navigation</span>
                <span className="admin-command-chevron">→</span>
              </div>
              <p>
                Order public links, hide sections and keep the shell consistent across the site.
              </p>
              <strong>Route management</strong>
            </div>
          </a>
        ) : null}

        {canBrand ? (
          <a className="admin-command-tile tone-sky" href="/admin/branding">
            <span className="admin-command-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M7 15V9l5-4 5 4v6" />
                <path d="M9.5 14.5h5M10 9.5h4" />
              </svg>
            </span>
            <div className="admin-command-tile-body">
              <div className="admin-command-tile-head">
                <span>Brand</span>
                <span className="admin-command-chevron">→</span>
              </div>
              <p>Update wordmarks, icons, generated assets and the live public presentation.</p>
              <strong>Brand assets</strong>
            </div>
          </a>
        ) : null}

        {canNav ? (
          <a className="admin-command-tile tone-navy" href="/admin/routes">
            <span className="admin-command-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M7 7h10v10H7z" />
                <path d="M10 3.5v3M14 17.5v3M3.5 10h3M17.5 14h3" />
              </svg>
            </span>
            <div className="admin-command-tile-body">
              <div className="admin-command-tile-head">
                <span>SEO & routes</span>
                <span className="admin-command-chevron">→</span>
              </div>
              <p>Review page metadata, route labels and the registry used by the public shell.</p>
              <strong>Route registry</strong>
            </div>
          </a>
        ) : null}
      </div>
    </ConsoleScreen>
  );
}

export function CmsScreen() {
  return (
    <ConsoleScreen anyOf={["cms.view"]}>
      <CmsBody />
    </ConsoleScreen>
  );
}

export function WebsitePagesScreen() {
  return <CmsScreen />;
}

export function CmsPageStudioScreen() {
  return (
    <ConsoleScreen anyOf={["cms.view"]}>
      <CmsPageStudioBody />
    </ConsoleScreen>
  );
}

export function NavigationScreen() {
  return (
    <ConsoleScreen anyOf={["navigation.view"]}>
      <NavigationBody />
    </ConsoleScreen>
  );
}

export function RoutesScreen() {
  return (
    <ConsoleScreen anyOf={["navigation.view"]}>
      <RoutesBody />
    </ConsoleScreen>
  );
}
