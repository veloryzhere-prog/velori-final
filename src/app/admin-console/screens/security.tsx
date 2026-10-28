import { useState, type FormEvent } from "react";
import {
  adminAccessCodeStatus,
  adminChangeAccessCode,
  changeAdminCredentials,
  revokeOtherAdminSessions,
  type AdminAccessCodeStatus,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { useAdminSession, usePermission } from "../session";
import {
  Card,
  ConfirmDialog,
  Empty,
  Loading,
  Notice,
  TextField,
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const MINIMUM_LENGTH = 12;

function AccessCodeCard({ canEdit }: { canEdit: boolean }) {
  const status = useResource<AdminAccessCodeStatus>(() => adminAccessCodeStatus(), []);
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [next, setNext] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmCode.length > 0 && next !== confirmCode;
  const tooShort = next.length > 0 && next.length < MINIMUM_LENGTH;

  const rotate = () =>
    void guarded(async () => {
      setError(null);
      setNotice(null);
      await adminChangeAccessCode(next, true);
      // Clear immediately: the plaintext must not linger in component state or in
      // the DOM after a successful rotation.
      setNext("");
      setConfirmCode("");
      setNotice("The access code was replaced. The previous value no longer works.");
      status.reload();
    }).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  const state = status.data;

  return (
    <Card
      title="First-time setup code"
      subtitle="The one-time code that authorizes one-time server-side account initialization."
    >
      {status.loading ? <Loading label="Reading the access code state" /> : null}
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {state ? (
        state.migrationsApplied === false ? (
          <Notice tone="error">
            The access-code migration has not been applied to this project, so rotation is
            unavailable. First-time setup is still gated by the Edge Function secret.
          </Notice>
        ) : (
          <dl className="admin-info-list">
            <dt>Currently accepted</dt>
            <dd>{state.enabled ? "Yes" : "No"}</dd>
            <dt>Rotated hash stored</dt>
            <dd>{state.stored ? "Yes" : "No"}</dd>
            <dt>Last rotated</dt>
            <dd>{state.rotatedAt ? formatDate(state.rotatedAt) : "Never"}</dd>
            <dt>Edge Function secret</dt>
            <dd>
              {state.setupSecretConfigured
                ? state.stored
                  ? "Configured, but a rotated hash takes precedence over it"
                  : "Configured and accepted"
                : "Not configured"}
            </dd>
          </dl>
        )
      ) : null}

      {canEdit && state?.migrationsApplied !== false ? (
        <>
          <TextField
            label={`New access code (at least ${MINIMUM_LENGTH} characters)`}
            type="password"
            value={next}
            onChange={setNext}
            placeholder="Typed once, sent once, never returned"
          />
          <TextField
            label="Confirm new access code"
            type="password"
            value={confirmCode}
            onChange={setConfirmCode}
          />
          {mismatch ? <Notice tone="error">The two codes do not match.</Notice> : null}
          {tooShort ? (
            <Notice tone="error">Use at least {MINIMUM_LENGTH} characters.</Notice>
          ) : null}
          <div className="admin-row-actions">
            <Button
              type="button"
              className="admin-primary"
              disabled={busy || mismatch || tooShort || next.length < MINIMUM_LENGTH}
              onClick={rotate}
            >
              {busy ? "Working…" : "Replace access code"}
            </Button>
            <Button
              type="button"
              disabled={busy || !state?.enabled}
              onClick={() => setDisabling(true)}
            >
              Disable code
            </Button>
          </div>
          <p className="admin-muted">
            Rotating replaces the stored salted PBKDF2 hash, which is what invalidates the previous
            code. The plaintext is never returned, logged, or written to the audit log. Disabling
            leaves first-time setup closed until a code is configured again.
          </p>
        </>
      ) : !canEdit ? (
        <Empty>Your role cannot rotate the setup code.</Empty>
      ) : null}

      {disabling ? (
        <ConfirmDialog
          title="Disable the access code?"
          description="First-time initialization will stop accepting this code."
          confirmLabel="Disable"
          busy={busy}
          onClose={() => setDisabling(false)}
          onConfirm={async () => {
            await guarded(async () => {
              setError(null);
              await adminChangeAccessCode("", false);
              setDisabling(false);
              setNotice("The access code is disabled.");
              status.reload();
            }).catch((caught: unknown) =>
              setError(caught instanceof Error ? caught.message : String(caught)),
            );
          }}
        />
      ) : null}
    </Card>
  );
}

function SessionCard() {
  const { me } = useAdminSession();
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [revoking, setRevoking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card
      title="This administrator"
      subtitle="Console sessions are revocable individually; the session list shows every device."
    >
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {me ? (
        <dl className="admin-info-list">
          <dt>Username</dt>
          <dd>{me.username}</dd>
          <dt>Role</dt>
          <dd>{me.roleKey.replace(/_/g, " ")}</dd>
          <dt>Permissions granted</dt>
          <dd>{me.permissions.length}</dd>
          <dt>This session expires</dt>
          <dd>{formatDate(me.sessionExpiresAt)}</dd>
          <dt>Password confirmed</dt>
          <dd>{me.reauthenticatedAt ? formatDate(me.reauthenticatedAt) : "Not in this session"}</dd>
          <dt>Two-factor</dt>
          <dd>{me.mfaRequired ? "Required by policy" : "Not required by policy"}</dd>
        </dl>
      ) : null}
      <div className="admin-row-actions">
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setNotice(null);
            setError(null);
            setRevoking(true);
          }}
        >
          Sign out other sessions
        </Button>
      </div>
      <p className="admin-muted">
        This signs out every other console session and leaves this one working. Review individual
        devices under My sessions.
      </p>

      {revoking ? (
        <ConfirmDialog
          title="Sign out other console sessions?"
          description="Every other browser signed in as you loses its administrator session immediately. Ordinary app sessions are unaffected."
          confirmLabel="Sign out others"
          busy={busy}
          onClose={() => setRevoking(false)}
          onConfirm={async () => {
            setError(null);
            try {
              let revoked = 0;
              await guarded(async () => {
                const result = await revokeOtherAdminSessions();
                revoked = result.revoked;
              });
              setRevoking(false);
              setNotice(
                revoked > 0
                  ? `Signed out ${revoked} other console session${revoked === 1 ? "" : "s"}.`
                  : "There were no other console sessions to sign out.",
              );
            } catch (caught: unknown) {
              setRevoking(false);
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        />
      ) : null}
    </Card>
  );
}

function PasswordCard() {
  const { signOut } = useAdminSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirmation.length > 0 && nextPassword !== confirmation;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || mismatch || nextPassword.length < 12) return;
    setBusy(true);
    setError(null);
    try {
      await changeAdminCredentials({ currentPassword, password: nextPassword, confirmation });
      setCurrentPassword("");
      setNextPassword("");
      setConfirmation("");
      await signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Administrator password"
      subtitle="Verify your current password. Changing it signs out all administrator sessions."
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <form className="admin-form" onSubmit={save}>
        <TextField
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          maxLength={200}
        />
        <TextField
          label="New password (at least 12 characters)"
          type="password"
          value={nextPassword}
          onChange={setNextPassword}
          maxLength={200}
        />
        <TextField
          label="Confirm new password"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
          maxLength={200}
        />
        {mismatch ? <Notice tone="error">The new passwords do not match.</Notice> : null}
        <Button
          type="submit"
          className="admin-primary"
          disabled={busy || !currentPassword || mismatch || nextPassword.length < 12}
        >
          {busy ? "Changing password…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}

function SecurityBody() {
  const canEdit = usePermission("security.edit");

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <Heading1>Security</Heading1>
          <p>
            Password, setup code and session controls. The server verifies every request and stores
            only a password hash.
          </p>
        </div>
      </div>

      {!canEdit ? (
        <Notice tone="error">
          Your role does not include the security.edit permission, so the setup code cannot be read
          or changed from this screen.
        </Notice>
      ) : null}

      <PasswordCard />
      <AccessCodeCard canEdit={canEdit} />
      <SessionCard />
    </>
  );
}

export function SecurityScreen() {
  return (
    <ConsoleScreen anyOf={[]}>
      <SecurityBody />
    </ConsoleScreen>
  );
}
