import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Inbox, X } from "lucide-react";
import { AdminApiError } from "../../lib/admin-api";
import { Button, Input, Label, Textarea } from "./primitives";

// ---------------------------------------------------------------------------
// Async data
// ---------------------------------------------------------------------------

export type Resource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (value: T | null) => void;
};

/** Loads once on mount and whenever `deps` change. A stale response is discarded
 * so a slow first request cannot overwrite a fast second one. */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const active = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const ticket = ++active.current;
    setLoading(true);
    setError(null);
    void Promise.resolve()
      .then(() => loadRef.current())
      .then((value) => {
        if (ticket !== active.current) return;
        setData(value);
      })
      .catch((caught: unknown) => {
        if (ticket !== active.current) return;
        setData(null);
        setError(describe(caught));
      })
      .finally(() => {
        if (ticket === active.current) setLoading(false);
      });
    return () => {
      if (active.current === ticket) active.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, loading, error, reload, setData };
}

export function describe(caught: unknown): string {
  if (caught instanceof AdminApiError) {
    return caught.errorId ? `${caught.message} (reference ${caught.errorId})` : caught.message;
  }
  if (caught instanceof Error) return caught.message;
  return "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function PanelHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-row-actions">{actions}</div> : null}
    </div>
  );
}

export function Card({
  id,
  title,
  subtitle,
  actions,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="admin-card">
      <div className="admin-card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-row-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const className =
    tone === "error" ? "admin-alert" : tone === "success" ? "admin-success" : "admin-security-note";
  return (
    <p className={className} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-empty-state">
      <span className="admin-empty-icon" aria-hidden="true">
        <Inbox />
      </span>
      <p>{children}</p>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="admin-loading-state" role="status" aria-live="polite" aria-label={label}>
      <span className="admin-visually-hidden">{label}</span>
      <span className="admin-skeleton-line is-heading" aria-hidden="true" />
      <span className="admin-skeleton-line" aria-hidden="true" />
      <span className="admin-skeleton-line is-short" aria-hidden="true" />
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: string; children: ReactNode }) {
  return <span className={`admin-status admin-status-${tone}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Label>
      {label}
      {children}
      {hint ? <span className="admin-muted">{hint}</span> : null}
    </Label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  type = "text",
  maxLength,
  disabled,
  onSubmitKey,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  type?: "text" | "password" | "datetime-local" | "number" | "url";
  maxLength?: number;
  disabled?: boolean;
  onSubmitKey?: () => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmitKey?.();
        }}
        onChange={(event) => onChange((event.target as HTMLInputElement).value)}
      />
    </Field>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange((event.target as HTMLTextAreaElement).value)}
      />
    </Field>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="admin-form-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange((event.target as HTMLInputElement).checked)}
      />
      <span>
        {label}
        {hint ? <span className="admin-muted"> {hint}</span> : null}
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const normalised = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <Field label={label} hint={hint}>
      <select
        className="admin-role-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange((event.target as HTMLSelectElement).value as T)}
      >
        {normalised.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Pager({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / perPage)) : null;
  return (
    <div className="admin-pagination">
      <Button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="admin-muted">
        Page {page}
        {pages ? ` of ${pages}` : ""}
        {total !== undefined ? ` · ${total} total` : ""}
      </span>
      <Button
        type="button"
        disabled={pages !== null ? page >= pages : false}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export { Table } from "./AdminTable";

export function Metric({
  label,
  value,
  note,
  onClick,
  pressed,
}: {
  label: string;
  value: string | number;
  note?: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const content = (
    <>
      <span className="admin-muted">{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </>
  );
  if (onClick)
    return (
      <button
        type="button"
        aria-pressed={pressed}
        className="admin-metric admin-metric-button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  return <div className="admin-metric">{content}</div>;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    parsed,
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const activeDialogStack: HTMLDivElement[] = [];
let bodyOverflowBeforeDialogs = "";

export function Dialog({
  title,
  description,
  children,
  onClose,
  actions,
  className = "",
  dismissOnBackdrop = true,
  closeLabel = "Cancel",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  className?: string;
  dismissOnBackdrop?: boolean;
  closeLabel?: string;
}) {
  const containsDismiss = (nodes: ReactNode): boolean =>
    Children.toArray(nodes).some(
      (node) =>
        isValidElement<{ onClick?: unknown; children?: ReactNode }>(node) &&
        (node.props.onClick === onClose || containsDismiss(node.props.children)),
    );
  const hasDismissAction = containsDismiss(actions);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!activeDialogStack.length) {
      bodyOverflowBeforeDialogs = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    activeDialogStack.push(dialog);
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    const firstFrame = window.requestAnimationFrame(() => {
      const first = focusable()[0];
      (first ?? dialog).focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (activeDialogStack.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.removeEventListener("keydown", onKey);
      const stackIndex = activeDialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) activeDialogStack.splice(stackIndex, 1);
      if (!activeDialogStack.length) document.body.style.overflow = bodyOverflowBeforeDialogs;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div
      className="admin-dialog-scrim"
      role="presentation"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        className={`admin-login-card admin-dialog-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-card-heading admin-dialog-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="admin-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {children}
        <div className="admin-form-actions">
          {actions}
          {!hasDismissAction ? (
            <Button type="button" onClick={onClose}>
              {closeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    ensureAdminOverlayRoot(),
  );
}

export function ensureAdminOverlayRoot() {
  let root = document.getElementById("admin-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-overlay-root";
    document.body.append(root);
  }
  root.classList.add("admin-overlay-root");
  root.dataset.overlayRoot = "admin";
  return root;
}

/**
 * Destructive-action gate. The server requires a reason for every destructive
 * operation, so this dialog is not optional polish: it collects the string that
 * ends up on the audit row.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  busy,
  minimumLength = 8,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  minimumLength?: number;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < minimumLength;
  const submit = usePreventDoubleSubmit();

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      actions={
        <Button
          type="button"
          className="admin-primary"
          disabled={busy || submit.busy || tooShort}
          onClick={() => {
            setError(null);
            void submit
              .run(() => onConfirm(reason.trim()))
              .catch((caught: unknown) => setError(describe(caught)));
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <AreaField
        label={`Reason (at least ${minimumLength} characters)`}
        hint="Recorded on the audit log against your name."
        value={reason}
        onChange={setReason}
      />
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const submit = usePreventDoubleSubmit();
  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      actions={
        <Button
          type="button"
          className="admin-primary"
          disabled={busy || submit.busy}
          onClick={() => {
            setError(null);
            void submit.run(onConfirm).catch((caught: unknown) => setError(describe(caught)));
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Dialog>
  );
}

/** Password confirmation for high-risk actions. Returns the reauth stamp. */
export function ReauthDialog({
  busy,
  error,
  onConfirm,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: (password: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <Dialog
      title="Confirm your password"
      description="This action is sensitive. Enter your administrator password to continue."
      onClose={onClose}
      actions={
        <Button
          type="button"
          className="admin-primary"
          disabled={busy || password.length === 0}
          onClick={() => onConfirm(password)}
        >
          {busy ? "Confirming…" : "Confirm"}
        </Button>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Administrator password"
        type="password"
        value={password}
        onChange={setPassword}
      />
    </Dialog>
  );
}

/**
 * Runs an action and, if the server answers 428 `reauth_required`, asks for the
 * administrator password and retries once. The retry is the same closure, so the
 * screen does not have to duplicate its own submit logic.
 */
export function useGuardedAction(reauth: { ensureReauth: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const guarded = useCallback(
    async (action: () => Promise<void>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      try {
        try {
          await action();
        } catch (caught) {
          if (!(caught instanceof AdminApiError) || caught.code !== "reauth_required") {
            throw caught;
          }
          if (!(await reauth.ensureReauth())) return;
          await action();
        }
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [reauth],
  );

  return { busy, guarded };
}

export function SubmitRow({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <div className="admin-form-actions">
      <Button type="submit" className="admin-primary" disabled={busy}>
        {busy ? "Working…" : "Save"}
      </Button>
    </div>
  );
}

export function usePreventDoubleSubmit() {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

export function onSubmit(handler: () => void | Promise<void>): (event: FormEvent) => void {
  return (event: FormEvent) => {
    event.preventDefault();
    void handler();
  };
}
