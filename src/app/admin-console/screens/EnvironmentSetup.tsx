/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useState } from "react";
import { environmentRequest } from "../../../lib/admin-api";
import { managementKey } from "../../../../supabase/functions/velori-environment/setup";
import { useScreenReauth } from "../frame";
import { Button } from "../primitives";
import { Card, Notice, TextField, describe, useGuardedAction } from "../widgets";

export function EnvironmentSetup({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { busy, guarded } = useGuardedAction(useScreenReauth());
  const setup = () =>
    void guarded(async () => {
      setError("");
      setMessage("");
      try {
        const result = await environmentRequest<{ saved: boolean; auditPending?: boolean }>({
          method: "POST",
          body: JSON.stringify({ operation: "setup", confirm: confirmation, value: token }),
        });
        if (!result.saved) throw Error("Setup was not confirmed.");
        setConfirmation("");
        setMessage(
          "Supabase accepted the management credential. Allow its Edge runtime to refresh, then refresh status." +
            (result.auditPending ? " Final audit recording is pending." : ""),
        );
        onSaved();
      } finally {
        setToken("");
      }
    }).catch((caught) => setError(describe(caught)));
  return (
    <Card
      title="Connect protected API management"
      subtitle="One-time setup for this Supabase project. Requires super-admin access and password confirmation."
    >
      <p>
        Create a personal access token with Edge Functions Secrets read and write permission for
        project <code>gmgobchwnfkwfuekhpkr</code>. Prefer a token scoped to this project when
        available.
      </p>
      <p>
        <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer">
          Open Supabase access tokens
        </a>
      </p>
      <p>
        The token is sent over HTTPS to VELORI’s protected backend and installed in Supabase Edge
        secrets. It is never saved in browser storage or returned to this page. Do not paste
        credentials into chat.
      </p>
      <label className="ve-field">
        Supabase management token
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={4096}
          disabled={busy}
        />
      </label>
      <TextField
        label={`Type ${managementKey} to confirm`}
        value={confirmation}
        onChange={setConfirmation}
      />
      <Button
        className="admin-primary"
        disabled={busy || confirmation !== managementKey || !token.trim()}
        onClick={setup}
      >
        {busy ? "Connecting…" : "Connect API management"}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
    </Card>
  );
}
