import { useEffect, useId, useRef, useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { useInterfaceMotion } from "./InterfaceMotion";
import type { MotionPreference } from "./preferences.mjs";
const choices: { value: MotionPreference; label: string; description: string }[] = [
  {
    value: "full",
    label: "Full motion",
    description: "Rich scenes, animated details and interactions",
  },
  {
    value: "gentle",
    label: "Gentle motion",
    description: "Soft fades with no continuous movement",
  },
  {
    value: "off",
    label: "Motion off",
    description: "A still interface. Your videos play normally",
  },
  { value: "auto", label: "Device setting", description: "Follow your device’s motion preference" },
];
/** Available to visitors and signed-in members, independently of route/auth providers. */
export function MotionControl() {
  const { mode, preference, setPreference } = useInterfaceMotion();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem("velori-motion-discovered") !== "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("velori-motion-settings-open", show);
    return () => window.removeEventListener("velori-motion-settings-open", show);
  }, []);
  const discover = () => {
    setOpen((value) => !value);
    setHint(false);
    try {
      localStorage.setItem("velori-motion-discovered", "1");
    } catch {
      /* Preference remains usable. */
    }
  };
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLInputElement>("input:checked")?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const route = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("popstate", route);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("popstate", route);
    };
  }, [open]);
  return (
    <div
      className="motion-dock"
      ref={root}
      data-mode={mode}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="motion-dock-trigger"
        aria-label={
          "Motion settings, " +
          (mode === "full" ? "full motion" : mode === "gentle" ? "gentle motion" : "motion off")
        }
        title="Motion settings"
        aria-expanded={open}
        aria-controls={id}
        onClick={discover}
      >
        <SlidersHorizontal size={19} aria-hidden="true" />
        <span className="motion-dock-indicator" aria-hidden="true" />
      </button>
      {hint && !open ? (
        <div className="motion-discovery">
          <button type="button" onClick={discover}>
            <span aria-hidden="true">✳</span> Motion, your way{" "}
            <small>{mode === "full" ? "Full experience on" : "Explore motion"}</small>
          </button>
          <button
            type="button"
            aria-label="Dismiss motion tip"
            onClick={() => {
              setHint(false);
              try {
                localStorage.setItem("velori-motion-discovered", "1");
              } catch {}
            }}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
      {open ? (
        <div
          id={id}
          ref={panel}
          className="motion-dock-panel"
          role="region"
          aria-label="Motion settings"
        >
          <header>
            <div>
              <span>YOUR EXPERIENCE</span>
              <h2>Make it feel right.</h2>
            </div>
            <button type="button" aria-label="Close motion settings" onClick={() => close(true)}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="motion-dock-preview" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>
              {mode === "off"
                ? "Still & focused"
                : mode === "gentle"
                  ? "Soft & simple"
                  : "A little more alive"}
            </span>
          </div>
          <fieldset>
            <legend>Motion level</legend>
            {choices.map((choice) => (
              <label key={choice.value}>
                <input
                  type="radio"
                  name={id + "-preference"}
                  value={choice.value}
                  checked={preference === choice.value}
                  onChange={() => setPreference(choice.value)}
                />
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>
                {preference === choice.value ? <Check size={16} aria-hidden="true" /> : null}
              </label>
            ))}
          </fieldset>
          <p className="motion-dock-note" role="status">
            {preference === "auto"
              ? "Device setting: " + (mode === "gentle" ? "reduced motion" : "full motion") + ". "
              : ""}
            Saved on this browser. Applies across VELORI.
          </p>
        </div>
      ) : null}
    </div>
  );
}
