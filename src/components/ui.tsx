import { VeloriLoop } from "./VeloriLoop";
import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type Ref,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router";
import { X } from "lucide-react";
import "./ui.css";

type ButtonVariant = "primary" | "secondary" | "outline" | "soft" | "quiet" | "danger";
type ButtonSize = "small" | "medium" | "large";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "medium",
  loading = false,
  className,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={joinClasses("button", `button-${variant}`, `ui-button-${size}`, className)}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "medium",
  className,
  children,
  ...props
}: Omit<LinkProps, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link
      {...props}
      className={joinClasses("button", `button-${variant}`, `ui-button-${size}`, className)}
    >
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  type = "button",
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      aria-label={label}
      className={joinClasses("icon-button", "ui-icon-button", className)}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={joinClasses("ui-input", className)} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea {...props} className={joinClasses("ui-input", "ui-textarea", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={joinClasses("ui-input", "ui-select", className)} />;
}

export function Card({
  as = "div",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "article" | "section" | "div" }) {
  return createElement(as, { ...props, className: joinClasses("ui-card", className) });
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "pink" | "blue" | "success" | "warning" | "error";
}) {
  return <span {...props} className={joinClasses("ui-badge", `ui-badge-${tone}`, className)} />;
}

export function Avatar({
  name,
  src,
  size = "medium",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);
  return (
    <span
      className={joinClasses("ui-avatar", `ui-avatar-${size}`, className)}
      role="img"
      aria-label={name}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          loading="lazy"
          decoding="async"
          alt=""
          onError={() => {
            setFailedSrc(src ?? null);
          }}
        />
      ) : (
        name.trim().charAt(0).toLocaleUpperCase()
      )}
    </span>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <VeloriLoop />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ui-empty-state">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </section>
  );
}

export function Notification({
  tone = "info",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "error";
}) {
  const isError = tone === "error";
  return (
    <div
      {...props}
      className={joinClasses("ui-notification", `ui-notification-${tone}`, className)}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

export function Menu({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={joinClasses("ui-menu", className)}>
      <summary>{label}</summary>
      <div className="ui-menu-panel">{children}</div>
    </details>
  );
}

export function Tabs({
  label,
  items,
  value,
  onValueChange,
  children,
  className,
}: {
  label: string;
  items: Array<{ value: string; label: string; disabled?: boolean }>;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (selectedIndex + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    for (let checked = 0; checked < items.length && items[nextIndex]?.disabled; checked += 1) {
      nextIndex =
        (nextIndex + (event.key === "ArrowRight" || event.key === "Home" ? 1 : -1) + items.length) %
        items.length;
    }
    const nextItem = items[nextIndex];
    if (nextItem && !nextItem.disabled) {
      onValueChange(nextItem.value);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className={joinClasses("ui-tabs", className)}>
      <div className="ui-tab-list" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className="ui-tab"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${id}-panel`}
        className="ui-tab-panel"
        role="tabpanel"
        aria-labelledby={`${id}-tab-${selectedIndex}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  actions,
  className,
  dismissOnBackdrop = true,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  dismissOnBackdrop?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog).focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) closeRef.current();
      }}
    >
      <section
        ref={dialogRef}
        className={joinClasses("ui-dialog", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="ui-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton label="Close dialog" onClick={() => closeRef.current()}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </header>
        {children ? <div className="ui-dialog-content">{children}</div> : null}
        {actions ? <footer className="ui-dialog-actions">{actions}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
