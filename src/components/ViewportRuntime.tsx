import { useEffect } from "react";
import { resolveViewportMetrics } from "../lib/viewport.mjs";
/** Keep phone chat composers within the visible area when the keyboard opens. */
export function ViewportRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let baseline = window.innerHeight,
      width = window.innerWidth,
      frame = 0,
      previous = "";
    const measure = () => {
      frame = 0;
      if (document.hidden) return;
      if (Math.abs(width - window.innerWidth) > 80) {
        baseline = window.innerHeight;
        width = window.innerWidth;
      }
      const focused = document.activeElement;
      const editable =
        focused instanceof HTMLElement &&
        (focused.isContentEditable ||
          focused.matches(
            'textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])',
          ));
      if (!editable) baseline = Math.max(baseline, window.innerHeight);
      const metrics = resolveViewportMetrics({
        layoutHeight: window.innerHeight,
        visualHeight: viewport?.height,
        scale: viewport?.scale,
        baselineHeight: baseline,
        editable,
      });
      if (!metrics) return;
      const top = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const next = metrics.height + ":" + metrics.keyboard + ":" + top;
      if (next === previous) return;
      previous = next;
      root.style.setProperty("--visual-viewport-height", metrics.height + "px");
      root.style.setProperty("--visual-viewport-top", top + "px");
      root.dataset.softKeyboard = String(metrics.keyboard);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule, { passive: true });
    viewport?.addEventListener("resize", schedule, { passive: true });
    viewport?.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("visibilitychange", schedule);
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-top");
      delete root.dataset.softKeyboard;
    };
  }, []);
  return null;
}
