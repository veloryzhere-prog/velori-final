import { useEffect } from "react";
import { useInterfaceMotion } from "./InterfaceMotion";

// Animate surfaces, never the authored media or transform handles inside a canvas.
const surfaces = [
  ".creator-launchpad",
  ".page-heading",
  ".profile-header-motion",
  ".explore-post-card",
  ".group-discovery-card",
  ".settings-section",
  ".notification-item",
  ".people-rail-card",
  ".vl-hero-copy",
  ".vl-features article",
  ".vl-community",
  ".vl-section-heading",
  ".vl-final",
  ".auth-form-panel",
  ".auth-story",
  ".feed-home-intro",
  ".stories-section",
  ".feed-create-prompt",
  ".post-card",
  ".people-card",
  ".settings-card",
  ".notification-card",
  ".messages-inbox",
  ".messages-thread",
  ".messages-conversation",
  ".messages-message-bubble",
  ".studio-heading",
  ".tools-panel",
  ".preview-panel",
  ".reel-studio-panel",
  ".reel-timeline",
  ".ss-panel",
  ".ss-tools",
  ".ui-dialog",
  ".empty-state",
  ".v-welcome-copy",
  ".v-social-board",
  ".v-section-heading",
  ".v-format-grid > a",
  ".v-community-section",
  ".v-auth-form",
  ".v-feed-title",
  ".v-feed-create",
  ".v-context-header",
  ".v-profile-identity",
  ".v-story-hub",
  ".story-list-card",
  ".v-safety-banner",
  ".v-final-invite",
  ".privacy-card",
  ".group-member-row",
  ".help-item",
  ".notification-preference-card",
  ".v-settings-content",
  ".v-public-article",
  ".vi-section",
  ".vi-next",
  ".chat-child-settings",
  ".chat-customization",
  ".chat-shared-item",
  ".chat-shared-reel",
].join(",");

export function MotionExperience() {
  const { mode } = useInterfaceMotion();
  useEffect(() => {
    if (mode === "off" || typeof IntersectionObserver === "undefined") return;
    const seen = new WeakSet<Element>();
    const moving = new Set<Element>();
    const waiting = new Set<Element>();
    const sceneObserver = new IntersectionObserver((entries) => {
      for (const entry of entries)
        if (entry.target instanceof HTMLElement)
          entry.target.dataset.motionVisible = String(entry.isIntersecting);
    });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.vlReveal = "visible";
            observer.unobserve(entry.target);
            waiting.delete(entry.target);
          }
      },
      { threshold: 0.06 },
    );
    const prepare = (element: Element) => {
      if (!(element instanceof HTMLElement) || seen.has(element)) return;
      seen.add(element);
      element.dataset.vlReveal = "ready";
      waiting.add(element);
      observer.observe(element);
    };
    const loops =
      ".vm-sculpture,.vm-atmosphere,.v-social-board,.v-creator-note,.v-welcome-copy,.v-auth-photos,.motion-accent,.connection-scene,.v-compose-button,.story-tray-avatar,.messages-empty-icon,.chat-child-feature,.chat-details-cover,[data-motion-loop]";
    const scan = (root: Element | Document) => {
      if (
        root instanceof Element &&
        root.closest(".admin-console,.admin-shell,.admin-overlay-root,#admin-overlay-root")
      )
        return;
      if (root instanceof Element && root.matches(surfaces)) prepare(root);
      root.querySelectorAll(surfaces).forEach((element) => {
        if (!element.closest(".admin-console,.admin-shell,#admin-overlay-root")) prepare(element);
      });
      if (mode !== "full") return;
      const scenes =
        root instanceof Element && root.matches(loops)
          ? [root, ...Array.from(root.querySelectorAll(loops))]
          : Array.from(root.querySelectorAll(loops));
      for (const scene of scenes)
        if (!moving.has(scene)) {
          moving.add(scene);
          sceneObserver.observe(scene);
        }
    };
    scan(document);
    let frame = 0;
    const roots = new Set<Element>();
    const flushRoots = () => {
      frame = 0;
      let count = 0;
      const queued = new Set(roots);
      for (const root of roots) {
        roots.delete(root);
        if (!root.isConnected) continue;
        // An added parent already scans its children; do not scan nested mutations again.
        let parent = root.parentElement,
          covered = false;
        while (parent) {
          if (queued.has(parent)) {
            covered = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!covered) {
          scan(root);
          count++;
        }
        if (count >= 12) break;
      }
      if (roots.size) frame = requestAnimationFrame(flushRoots);
    };
    const mutations = new MutationObserver((records) => {
      // IntersectionObserver retains targets: release removed feed/chat subtrees.
      if (records.some((record) => record.removedNodes.length > 0)) {
        for (const element of moving)
          if (!element.isConnected) {
            sceneObserver.unobserve(element);
            moving.delete(element);
          }
        for (const element of waiting)
          if (!element.isConnected) {
            observer.unobserve(element);
            waiting.delete(element);
          }
      }
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof Element) roots.add(node);
      if (!frame && roots.size) frame = requestAnimationFrame(flushRoots);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    const visibility = () => {
      document.documentElement.dataset.uiActivity = document.hidden ? "hidden" : "visible";
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    let tilted: HTMLElement | null = null,
      tiltFrame = 0;
    const pointer = (event: PointerEvent) => {
      if (mode !== "full" || document.hidden || event.pointerType !== "mouse") return;
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-depth-surface]");
      if (tilted && tilted !== target) {
        tilted.style.removeProperty("--depth-x");
        tilted.style.removeProperty("--depth-y");
      }
      tilted = target;
      if (!target || tiltFrame) return;
      tiltFrame = requestAnimationFrame(() => {
        tiltFrame = 0;
        if (!target.isConnected || tilted !== target) return;
        const bounds = target.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        target.style.setProperty(
          "--depth-x",
          ((0.5 - (event.clientY - bounds.top) / bounds.height) * 5).toFixed(2) + "deg",
        );
        target.style.setProperty(
          "--depth-y",
          (((event.clientX - bounds.left) / bounds.width - 0.5) * 7).toFixed(2) + "deg",
        );
      });
    };
    const reset = () => {
      cancelAnimationFrame(tiltFrame);
      tiltFrame = 0;
      tilted?.style.removeProperty("--depth-x");
      tilted?.style.removeProperty("--depth-y");
      tilted = null;
    };
    document.addEventListener("pointermove", pointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    return () => {
      observer.disconnect();
      sceneObserver.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(tiltFrame);
      reset();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointermove", pointer);
      document.documentElement.removeEventListener("pointerleave", reset);
    };
  }, [mode]);
  return null;
}
