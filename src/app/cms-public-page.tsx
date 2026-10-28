import { PageWorkspace } from "../components/PageWorkspace";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { CUSTOM_HTML_PUBLIC_PAGE_CSP } from "../lib/custom-html-document";
import { cmsNavigationTarget } from "../lib/cms-navigation.mjs";
import { useEffect, useRef } from "react";
import { useInterfaceMotion } from "../motion/InterfaceMotion";

export type PublishedCmsPage = {
  title: string;
  slug: string;
  route: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  hero_image: string | null;
  footer_enabled?: boolean;
  animation_enabled?: boolean;
  custom_html?: string | null;
  custom_css?: string | null;
  custom_js?: string | null;
  content_mode?: "visual" | "custom_html" | null;
  content_blocks?: CmsContentBlock[] | null;
};

export type CmsContentBlock = {
  id: string;
  type:
    | "heading"
    | "paragraph"
    | "quote"
    | "list"
    | "callout"
    | "divider"
    | "faq"
    | "image"
    | "button"
    | "html";
  title?: string;
  text?: string;
  url?: string;
  alt?: string;
  items?: string[];
  level?: number;
  tone?: "info" | "warning";
  visible?: boolean;
  ordered?: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function safePageUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^(mailto:|tel:)/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function renderBlock(block: CmsContentBlock) {
  const title = escapeHtml(block.title ?? "");
  const text = escapeHtml(block.text ?? "");
  const url = block.url && safePageUrl(block.url) ? escapeHtml(block.url) : "";
  const externalLink = /^https:\/\//i.test(url);
  const linkTarget = externalLink ? ' target="_blank" rel="noopener noreferrer"' : "";
  switch (block.type) {
    case "heading": {
      const level = [2, 3, 4].includes(block.level ?? 2) ? (block.level ?? 2) : 2;
      return `<h${level}>${title || text}</h${level}>`;
    }
    case "paragraph":
      return `<p>${text}</p>`;
    case "quote":
      return `<blockquote>${text}</blockquote>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${(block.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
    }
    case "callout":
      return `<aside class="cms-callout cms-callout-${block.tone === "warning" ? "warning" : "info"}">${title ? `<strong>${title}</strong>` : ""}<p>${text}</p></aside>`;
    case "divider":
      return "<hr>";
    case "faq":
      return `<details class="cms-faq"><summary>${title}</summary><p>${text}</p></details>`;
    case "image":
      return url
        ? `<figure><img src="${url}" alt="${escapeHtml(block.alt ?? "")}">${title ? `<figcaption>${title}</figcaption>` : ""}</figure>`
        : "";
    case "button":
      return url ? `<p><a class="cms-button" href="${url}"${linkTarget}>${title}</a></p>` : "";
    case "html":
      return block.text ?? "";
  }
}

/** Build the sandboxed document for admin-authored HTML, CSS, and JavaScript. */
function customFrameDocument(page: PublishedCmsPage, contentHtml: string) {
  const safeCss = (page.custom_css ?? "").replace(/<\s*\/\s*style/gi, "<\\/style");
  const safeJs = (page.custom_js ?? "").replace(/<\s*\/\s*script/gi, "<\\/script");
  const scriptTag = safeJs.trim() ? `<script>${safeJs}<\/script>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CUSTOM_HTML_PUBLIC_PAGE_CSP}"><style>html{color-scheme:light}body{margin:0;padding:24px;font:16px/1.7 system-ui,sans-serif;color:#252532;overflow-wrap:anywhere}img{max-width:100%;height:auto}figure{margin:1.5rem 0}figcaption{font-size:.875rem;color:#646477}blockquote{margin:1.5rem 0;padding-left:1rem;border-left:3px solid #df5c98}hr{border:0;border-top:1px solid #dedee5;margin:2rem 0}.cms-callout{padding:1rem 1.25rem;border-left:4px solid #568acb;background:#edf4fc}.cms-callout-warning{border-color:#d89036;background:#fff5e8}.cms-button{display:inline-block;padding:.7rem 1.1rem;background:#df5c98;color:#fff;text-decoration:none;border-radius:5px}.cms-faq{border-bottom:1px solid #dedee5;padding:1rem 0}*{box-sizing:border-box}${safeCss}</style></head><body><main class="cms-custom-content">${contentHtml}</main>${scriptTag}</body></html>`;
}

export function CmsPublicPage({
  page,
  interactiveLinks = true,
  embedded = false,
}: {
  page: PublishedCmsPage;
  interactiveLinks?: boolean;
  embedded?: boolean;
}) {
  const navigate = useNavigate();
  const { mode: globalMode } = useInterfaceMotion();
  const mode = page.animation_enabled === false ? "off" : globalMode;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cleanupFrame = useRef<(() => void) | null>(null);
  useEffect(() => {
    const root = frameRef.current?.contentDocument?.documentElement;
    if (root) root.dataset.uiMotion = mode;
  }, [mode]);
  useEffect(() => () => cleanupFrame.current?.(), []);
  useEffect(() => {
    const message = (event: MessageEvent) => {
      if (
        interactiveLinks &&
        event.source === frameRef.current?.contentWindow &&
        event.data?.type === "velori:open-motion"
      )
        window.dispatchEvent(new Event("velori-motion-settings-open"));
    };
    const activity = () => {
      const root = frameRef.current?.contentDocument?.documentElement;
      if (root) root.dataset.uiActivity = document.hidden ? "hidden" : "visible";
    };
    window.addEventListener("message", message);
    document.addEventListener("visibilitychange", activity);
    return () => {
      window.removeEventListener("message", message);
      document.removeEventListener("visibilitychange", activity);
    };
  }, [interactiveLinks]);
  const blocks = page.content_blocks ?? [];
  const paragraphs = page.content.split(/\n{2,}/).filter(Boolean);
  const fallbackHtml = paragraphs
    .map((paragraph) => `<section><p>${escapeHtml(paragraph)}</p></section>`)
    .join("");
  const visualHtml = blocks.length
    ? blocks
        .filter((block) => block.visible !== false)
        .map(renderBlock)
        .join("")
    : fallbackHtml;
  const useCustomHtml = page.content_mode === "custom_html" && Boolean(page.custom_html);
  const contentHtml = useCustomHtml ? (page.custom_html ?? "") : visualHtml;
  const customDocument = Boolean(contentHtml || page.custom_css || page.custom_js);
  const content = (
    <>
      {page.hero_image ? <img src={page.hero_image} alt="" className="public-hero" /> : null}
      {!embedded && (
        <>
          <div className="eyebrow">
            <span className="eyebrow-line" /> VELORI / {page.slug.toUpperCase().replace(/-/g, " ")}
          </div>
          <h1>{page.title}</h1>
          {page.seo_description ? <p className="public-lead">{page.seo_description}</p> : null}
        </>
      )}
      {customDocument ? (
        <iframe
          ref={frameRef}
          className="cms-public-custom-frame"
          title={`${page.title} custom content`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={customFrameDocument(page, contentHtml)}
          onLoad={(event) => {
            try {
              const frame = event.currentTarget;
              const document = frame.contentDocument;
              if (document) {
                cleanupFrame.current?.();
                document.documentElement.dataset.uiMotion = mode;
                // These documents expand to their full content height in the parent.
                // Keep a fractional layout pixel from creating a second scrollbar.
                if (document.querySelector(".vdocs")) {
                  document.documentElement.style.overflow = "hidden";
                }
                document.documentElement.dataset.uiActivity = window.document.hidden
                  ? "hidden"
                  : "visible";
                const visible = new IntersectionObserver((entries) => {
                  for (const entry of entries)
                    (entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting);
                });
                document
                  .querySelectorAll(".vd-art,.vd-card-art")
                  .forEach((node) => visible.observe(node));
                const preferenceStyle = document.createElement("style");
                preferenceStyle.textContent = `html[data-ui-motion="off"] *,html[data-ui-motion="off"] *::before,html[data-ui-motion="off"] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html[data-ui-motion="gentle"] *,html[data-ui-motion="gentle"] *::before,html[data-ui-motion="gentle"] *::after{animation-iteration-count:1!important;animation-duration:.15s!important;transition-duration:.15s!important;scroll-behavior:auto!important}`;
                document.head.appendChild(preferenceStyle);
                const measure = () => {
                  const height = Math.ceil(
                    Math.max(
                      320,
                      document.body.scrollHeight + 2,
                      document.body.getBoundingClientRect().height,
                    ),
                  );
                  if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
                };
                measure();
                const resize = new ResizeObserver(measure);
                resize.observe(document.body);
                cleanupFrame.current = () => {
                  resize.disconnect();
                  visible.disconnect();
                };
                void document.fonts?.ready.then(measure);
                document.addEventListener("submit", (event) => {
                  const form = event.target as HTMLFormElement;
                  if (form.classList.contains("vd-place-form")) {
                    event.preventDefault();
                    if (interactiveLinks)
                      navigate(
                        "/search?q=" +
                          encodeURIComponent(String(new FormData(form).get("q") || "")),
                      );
                  }
                });
                document.addEventListener("click", (clickEvent) => {
                  const targetElement = clickEvent.target as Element | null;
                  if (
                    !targetElement ||
                    typeof targetElement.closest !== "function" ||
                    clickEvent.button !== 0 ||
                    clickEvent.metaKey ||
                    clickEvent.ctrlKey ||
                    clickEvent.shiftKey ||
                    clickEvent.altKey
                  ) {
                    return;
                  }
                  const anchor = targetElement.closest("a[href]");
                  const target = anchor?.getAttribute("target");
                  if (!anchor || (target && target !== "_self")) return;
                  const rawHref = anchor.getAttribute("href") ?? "";
                  if (rawHref.startsWith("#")) {
                    clickEvent.preventDefault();
                    const section = document.getElementById(decodeURIComponent(rawHref.slice(1)));
                    if (section && interactiveLinks) {
                      const offset = section.getBoundingClientRect().top;
                      window.scrollBy({
                        top: frame.getBoundingClientRect().top + offset - 24,
                        behavior: mode === "full" ? "smooth" : "auto",
                      });
                      section.setAttribute("tabindex", "-1");
                      section.focus({ preventScroll: true });
                    }
                    return;
                  }
                  // srcdoc documents can retain about:srcdoc as their base.
                  // Resolve app routes against the owning page, not the sandbox URL.
                  const route = cmsNavigationTarget(rawHref, window.location.href);
                  if (route === null) return;
                  clickEvent.preventDefault();
                  if (interactiveLinks) navigate(route);
                });
              }
            } catch {
              event.currentTarget.style.height = "720px";
            }
          }}
        />
      ) : (
        <div className="public-sections">
          {paragraphs.map((paragraph, index) => (
            <section key={`${page.slug}-${index}`}>
              <Sparkles className="section-flower" size={21} aria-hidden="true" />
              <p>{paragraph}</p>
            </section>
          ))}
        </div>
      )}
    </>
  );
  return embedded ? (
    <div className="vi-published-content">{content}</div>
  ) : (
    <PageWorkspace area="information" className="public-page vi-cms">
      {content}
    </PageWorkspace>
  );
}
