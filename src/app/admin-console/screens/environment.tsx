import { useState } from "react";
import { Link } from "react-router";
import { EnvironmentSetup } from "./EnvironmentSetup";
import { adminRequest, environmentRequest } from "../../../lib/admin-api";
import { environmentKeys } from "../../../../supabase/functions/velori-environment/policy";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { useAdminSession } from "../session";
import { Button, Heading1 } from "../primitives";
import {
  Card,
  Dialog,
  Notice,
  TextField,
  describe,
  useGuardedAction,
  useResource,
} from "../widgets";
import "./environment.css";
type Entry = { name: string; configured: boolean | null };
function EnvironmentBody() {
  const data = useResource(
    () => environmentRequest<{ ready: boolean; setupRequired?: boolean; entries: Entry[] }>(),
    [],
  );
  const [query, setQuery] = useState(""),
    [custom, setCustom] = useState(""),
    [selected, setSelected] = useState<Entry | null>(null),
    [value, setValue] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState("");
  const { busy, guarded } = useGuardedAction(useScreenReauth());
  const ready = data.data?.ready === true;
  const rotation =
    selected &&
    ["GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].includes(selected.name);
  const [webhookAcknowledged, setWebhookAcknowledged] = useState(false);
  const rotate = (operation: "test" | "activate" | "rollback") =>
    void guarded(async () => {
      if (!selected) return;
      try {
        const result = await adminRequest<{ saved?: boolean; verified?: boolean; message: string }>(
          "/forge/rotation",
          {
            method: "POST",
            body: JSON.stringify({
              name: selected.name,
              confirm: confirmation,
              operation,
              value,
              webhookAcknowledged,
            }),
          },
          "velori-environment",
        );
        if (operation === "test" && !result.verified)
          throw Error("Credential test was not confirmed.");
        if (operation !== "test" && !result.saved)
          throw Error("Credential change was not confirmed.");
        setMessage(result.message);
        if (operation !== "test") {
          setSelected(null);
          setConfirmation("");
          data.reload();
        }
      } finally {
        setValue("");
      }
    }).catch((caught) => setMessage(describe(caught)));
  const rows = ready
    ? data.data!.entries
    : environmentKeys.map((name) => ({ name, configured: null }));
  const close = () => {
    if (!busy) {
      setSelected(null);
      setValue("");
      setConfirmation("");
    }
  };
  const open = (entry: Entry) => {
    setValue("");
    setWebhookAcknowledged(false);
    setConfirmation("");
    setSelected(entry);
    setMessage("");
  };
  const save = (operation: "set" | "delete") =>
    void guarded(async () => {
      if (!selected) return;
      try {
        const result = await environmentRequest<{ saved: boolean; auditPending?: boolean }>({
          method: "POST",
          body: JSON.stringify({
            name: selected.name,
            confirm: confirmation,
            operation,
            value: operation === "set" ? value : undefined,
          }),
        });
        if (!result.saved) throw Error("Change was not confirmed.");
        setSelected(null);
        setConfirmation("");
        setMessage(
          "Change confirmed. Check the consuming service before using it." +
            (result.auditPending ? " Final audit recording is pending." : ""),
        );
        data.reload();
      } finally {
        setValue("");
      }
    }).catch((caught) => setMessage(describe(caught)));
  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">VELORI V33 / SYSTEM</p>
          <Heading1>Manage Importants</Heading1>
          <p>Private runtime settings, with no saved-secret readback.</p>
        </div>
        <Button disabled={busy || data.loading} onClick={data.reload}>
          Refresh status
        </Button>
      </div>
      <nav className="ve-links" aria-label="Environment help">
        <Link to="/forge-security">Setup & security</Link>
        <Link to="/forge">FORGE workspace & readiness</Link>
        <Link to="/forge/commercial">Plans & pricing preview</Link>
        <Link to="/admin/feature-flags">Feature flags</Link>
        <Link to="/admin/audit">Audit log</Link>
        <Link to="/forge-docs">Forge guide</Link>
        <Link to="/forge-pricing">Pricing</Link>
        <Link to="/admin/cms">CMS pages</Link>
      </nav>
      {!ready && (
        <Notice>
          API management is awaiting protected setup. Connect it below to unlock supported runtime
          settings. Provider keys must still be issued by their respective providers.
        </Notice>
      )}
      {data.data?.setupRequired && <EnvironmentSetup onSaved={data.reload} />}
      {data.loading && <Notice>Checking protected configuration…</Notice>}
      {data.error && (
        <Notice tone="error">
          {data.error} If the management credential expired, replace it in the Supabase Edge secrets
          dashboard.
        </Notice>
      )}
      {message && <Notice>{message}</Notice>}
      <Card
        title="Application secrets & settings"
        subtitle="Only super administrators can change values. Password confirmation and the exact variable name are required."
      >
        <TextField label="Find a variable" value={query} onChange={setQuery} />
        <div className="ve-list">
          {rows
            .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
            .map((e) => (
              <article className="ve-item" key={e.name}>
                <div>
                  <h2>{e.name}</h2>
                  <p>
                    {e.configured === null
                      ? "Status unavailable"
                      : e.configured
                        ? "Configured · value hidden"
                        : "Not configured"}
                  </p>
                </div>
                <Button disabled={!ready || busy} onClick={() => open(e)}>
                  {["GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].includes(e.name)
                    ? "Test / rotate"
                    : e.configured
                      ? "Replace / remove"
                      : "Set value"}
                </Button>
              </article>
            ))}
        </div>
      </Card>
      <Card
        title="Custom application secret"
        subtitle="Adding a variable does not create an integration. Backend code must explicitly read it."
      >
        <TextField
          label="VELORI_CUSTOM_ variable name"
          value={custom}
          onChange={(v) => setCustom(v.toUpperCase())}
        />
        <Button
          disabled={!ready || busy || !/^VELORI_CUSTOM_[A-Z][A-Z0-9_]{0,63}$/.test(custom)}
          onClick={() => open({ name: custom, configured: null })}
        >
          Add custom value
        </Button>
      </Card>
      <Notice>
        Provider API keys must be issued by their providers. Supabase root access and encryption
        keys require the hosting dashboard and controlled rotation. The initial management
        connection is installed through the protected setup form above. Frontend VITE_ changes
        require rebuilding the site. Runtime secrets are shared across the project’s Edge functions.
      </Notice>
      {selected && (
        <Dialog
          title={selected.name}
          description="Replacing or removing a value may disable its consuming service. Saved values are never returned."
          onClose={close}
          actions={
            <>
              {rotation && (
                <Button
                  disabled={busy || confirmation !== selected.name || !value.trim()}
                  onClick={() => rotate("test")}
                >
                  Test candidate
                </Button>
              )}
              <Button
                className="admin-primary"
                disabled={
                  busy ||
                  confirmation !== selected.name ||
                  !value.trim() ||
                  (selected.name === "STRIPE_WEBHOOK_SECRET" && !webhookAcknowledged)
                }
                onClick={() => (rotation ? rotate("activate") : save("set"))}
              >
                {busy ? "Saving…" : rotation ? "Verify & activate" : "Save value"}
              </Button>
              {selected.configured && !rotation && (
                <Button
                  disabled={busy || confirmation !== selected.name}
                  onClick={() => save("delete")}
                >
                  Remove value
                </Button>
              )}
              {selected.configured && rotation && (
                <Button
                  disabled={
                    busy ||
                    confirmation !== selected.name ||
                    (selected.name === "STRIPE_WEBHOOK_SECRET" && !webhookAcknowledged)
                  }
                  onClick={() => rotate("rollback")}
                >
                  Restore previous credential
                </Button>
              )}
            </>
          }
        >
          {rotation && (
            <Notice>
              Candidate tests do not save a value. Activation verifies access before replacing the
              current credential and retains the previous credential when one exists. Set
              VELORI_GEMINI_MODEL before testing Gemini. Webhook secrets receive a format check;
              verify actual signed delivery after activation.
            </Notice>
          )}
          {selected.name === "STRIPE_WEBHOOK_SECRET" && (
            <label className="ve-field">
              <span>
                <input
                  type="checkbox"
                  checked={webhookAcknowledged}
                  onChange={(event) => setWebhookAcknowledged(event.target.checked)}
                />{" "}
                I will verify a real signed Stripe webhook after this change.
              </span>
            </label>
          )}
          <label className="ve-field">
            New value
            {selected.name === "GITHUB_APP_PRIVATE_KEY" ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={8192}
                autoComplete="off"
                spellCheck={false}
                rows={7}
              />
            ) : (
              <input
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={8192}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </label>
          {message && <Notice>{message}</Notice>}
          <TextField
            label="Type the variable name to confirm"
            value={confirmation}
            onChange={setConfirmation}
          />
        </Dialog>
      )}
    </>
  );
}
export function EnvironmentScreen() {
  const { me } = useAdminSession();
  return (
    <ConsoleScreen anyOf={["security.edit"]}>
      {me?.roleKey === "super_admin" ? (
        <EnvironmentBody />
      ) : (
        <Notice tone="error">Super administrator access is required.</Notice>
      )}
    </ConsoleScreen>
  );
}
