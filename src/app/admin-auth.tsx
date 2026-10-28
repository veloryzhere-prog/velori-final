import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import officialLogo from "../imports/velori-official.svg";
import { adminLogin, adminMe, AdminApiError } from "../lib/admin-api";
import { supabaseConfigMessage, supabaseConfigured } from "../../utils/supabase/info";
import { Button, Heading1, Heading2, Input, Label } from "./admin-primitives";

function safeMessage(error: unknown) {
  if (error instanceof AdminApiError)
    return `${error.message}${error.errorId ? ` Reference: ${error.errorId}` : ""}`;
  if (error instanceof Error && error.message) return error.message;
  if (!supabaseConfigured && supabaseConfigMessage) return supabaseConfigMessage;
  return "The administrator service could not be reached. Check your connection and try again.";
}

function AdminLogo() {
  return <img className="admin-logo" src={officialLogo} alt="VELORI" width="1280" height="720" />;
}

function AdminError({ message }: { message: string }) {
  return (
    <div className="admin-alert" role="alert">
      <p>{message}</p>
    </div>
  );
}

/** Unknown /admin paths are checked with the separate administrator session. */
export function AdminRouteFallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void adminMe()
      .then(() => navigate("/admin/dashboard", { replace: true }))
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof AdminApiError && cause.status === 401) {
          navigate("/admin/login", {
            replace: true,
            state: { from: location.pathname },
          });
          return;
        }
        setError(safeMessage(cause));
      })
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  if (checking) return <AdminLoading />;
  return (
    <main className="admin-denied">
      <AdminLogo />
      <Heading1>Administrator access required</Heading1>
      <p>{error || "Sign in with an authorized administrator account to continue."}</p>
      <Link to="/admin/login" className="admin-primary">
        Go to administrator sign in
      </Link>
    </main>
  );
}

export function AdminLoading() {
  return (
    <main className="admin-loading" aria-live="polite">
      <div className="admin-loading-frame">
        <AdminLogo />
        <LoaderCircle className="admin-loader" aria-hidden="true" />
        <p>Securing your administrator workspace…</p>
      </div>
    </main>
  );
}

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void adminMe()
      .then(() => navigate("/admin/dashboard", { replace: true }))
      .catch((cause) => {
        if (!active) return;
        if (!(cause instanceof AdminApiError) || cause.status !== 401) {
          setError(safeMessage(cause));
        }
      })
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adminLogin(username, password);
      setPassword("");
      navigate((location.state as { from?: string } | null)?.from || "/admin/dashboard", {
        replace: true,
      });
    } catch (cause) {
      setError(safeMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-brand">
        <AdminLogo />
        <div>
          <span className="admin-kicker">VELORI CONTROL</span>
          <Heading1>Steward the platform with confidence.</Heading1>
          <p>
            Secure access for authorized administrators. Every sensitive action is verified by the
            server and recorded.
          </p>
        </div>
        <footer>VELORI · Restricted system</footer>
      </section>
      <section className="admin-login-panel">
        <div className="admin-login-card">
          <div className="admin-login-heading">
            <span className="admin-login-icon">
              <LockKeyhole size={21} />
            </span>
            <div>
              <span className="admin-kicker">ADMINISTRATOR PORTAL</span>
              <Heading2>Welcome back</Heading2>
            </div>
          </div>
          <p className="admin-muted">Sign in with your administrator username and password.</p>
          {error ? <AdminError message={error} /> : null}
          <form onSubmit={submit} className="admin-form">
            <Label>
              Username
              <Input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                maxLength={64}
                placeholder="VELORIMANAGEARYAN"
              />
            </Label>
            <Label>
              Password
              <span className="admin-password">
                <Input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  maxLength={200}
                />
                <Button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </span>
            </Label>
            <Button className="admin-primary" disabled={busy || checking || !navigator.onLine}>
              {busy || checking ? (
                <>
                  <LoaderCircle className="admin-loader" size={17} /> Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <div className="admin-security-note">
            <ShieldCheck size={18} />
            <span>Access is verified by the VELORI server on every request.</span>
          </div>
          <Link className="admin-back" to="/home">
            Return to public site
          </Link>
        </div>
      </section>
    </main>
  );
}
