import { MotionAccent } from "../motion/MotionAccent";
import { MotionAtmosphere, MotionSculpture } from "../motion/MotionSculpture";
import { Link } from "react-router";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Check, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { passwordPolicy, MIN_ACCOUNT_PASSWORD_LENGTH } from "../lib/auth-input.mjs";
type Props = {
  mode: string;
  title: string;
  email: string;
  setEmail: (x: string) => void;
  displayName: string;
  setDisplayName: (x: string) => void;
  password: string;
  setPassword: (x: string) => void;
  confirmation: string;
  setConfirmation: (x: string) => void;
  showPassword: boolean;
  setShowPassword: (x: boolean) => void;
  busy: boolean;
  error: string;
  notice: string;
  submit: (e: FormEvent) => void;
  recoveryBlocked: boolean;
};
export function AuthScreen(p: Props) {
  const newPassword = p.mode === "signup" || p.mode === "reset-password";
  const policy = passwordPolicy(p.password);
  return (
    <main className="v-auth">
      <MotionAtmosphere />
      <aside className="v-auth-story">
        <Link className="v-wordmark" to="/">
          <span className="v-brand-mark">
            <img src="/velori-wing-mark.png" alt="" />
          </span>
          VELORI
        </Link>
        <div>
          <span className="v-eyebrow">GOOD PEOPLE. GOOD COMPANY.</span>
          <h2>
            There’s a place
            <br />
            for you here.
          </h2>
          <p>
            A little more shared.
            <br />A little more connected.
          </p>
        </div>
        <div className="v-auth-photos">
          <MotionSculpture compact />
          <img src="/images/friends.jpg" alt="Friends spending time together" />
          <img src="/images/coast.jpg" alt="A quiet afternoon by the sea" />
          <span>✳</span>
        </div>
        <span className="v-auth-caption">YOUR EVERYDAY, TOGETHER.</span>
      </aside>
      <section className="v-auth-main">
        <Link className="v-auth-back" to="/">
          <ArrowLeft size={17} />
          Back to VELORI
        </Link>
        <div className="v-auth-form">
          <span className="v-eyebrow">
            {p.mode === "signup" ? "YOUR CIRCLE STARTS HERE" : "WELCOME TO YOUR SPACE"}
          </span>
          <h1>{p.title}</h1>
          <MotionAccent />
          <p>
            {p.mode === "signup"
              ? "Create an account and make yourself at home."
              : p.mode === "forgot-password"
                ? "We’ll send you a link to get back into your account."
                : p.mode === "reset-password"
                  ? "Choose a strong password for your account."
                  : "Sign in to catch up with your people."}
          </p>
          {p.recoveryBlocked && (
            <p className="v-form-error" role="alert">
              This recovery link is missing or expired. Request a new email below.
            </p>
          )}
          <form onSubmit={p.submit}>
            {p.mode === "signup" && (
              <label>
                Display name
                <input
                  required
                  autoComplete="name"
                  maxLength={80}
                  placeholder="What should we call you?"
                  value={p.displayName}
                  onChange={(e) => p.setDisplayName(e.target.value)}
                />
              </label>
            )}
            {p.mode !== "reset-password" && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={p.email}
                  onChange={(e) => p.setEmail(e.target.value)}
                />
              </label>
            )}
            {p.mode !== "forgot-password" && (
              <label>
                Password
                <div className="v-password-field">
                  <input
                    required
                    type={p.showPassword ? "text" : "password"}
                    autoComplete={p.mode === "login" ? "current-password" : "new-password"}
                    minLength={newPassword ? MIN_ACCOUNT_PASSWORD_LENGTH : 1}
                    placeholder="Enter your password"
                    value={p.password}
                    onChange={(e) => p.setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={p.showPassword ? "Hide password" : "Show password"}
                    aria-pressed={p.showPassword}
                    onClick={() => p.setShowPassword(!p.showPassword)}
                  >
                    {p.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {newPassword && (
              <>
                <label>
                  Confirm password
                  <input
                    required
                    type={p.showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
                    value={p.confirmation}
                    onChange={(e) => p.setConfirmation(e.target.value)}
                    placeholder="Enter your password again"
                  />
                </label>
                <ul className="v-password-rules">
                  {[
                    {
                      ok: policy.longEnough,
                      text: "At least " + MIN_ACCOUNT_PASSWORD_LENGTH + " characters",
                    },
                    { ok: policy.hasLetter, text: "Includes a letter" },
                    { ok: policy.hasNumberOrSymbol, text: "Includes a number or symbol" },
                    ...(p.confirmation
                      ? [{ ok: p.password === p.confirmation, text: "Passwords match" }]
                      : []),
                  ].map((x) => (
                    <li key={x.text} data-valid={x.ok}>
                      <Check size={13} />
                      {x.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.mode === "login" && (
              <Link className="v-auth-recovery" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            {p.error && (
              <p className="v-form-error" role="alert">
                {p.error}
              </p>
            )}
            {p.notice && (
              <p className="v-form-success" role="status">
                {p.notice}
              </p>
            )}
            <button
              className="v-button v-button-dark"
              disabled={p.busy || p.recoveryBlocked || !navigator.onLine}
            >
              {p.busy
                ? "Please wait…"
                : p.mode === "signup"
                  ? "Create account"
                  : p.mode === "forgot-password"
                    ? "Send recovery email"
                    : p.mode === "reset-password"
                      ? "Update password"
                      : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="v-auth-switch">
            {p.mode === "login" ? (
              <>
                New around here? <Link to="/signup">Join VELORI</Link>
              </>
            ) : (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            )}
            {p.mode === "reset-password" && (
              <Link to="/forgot-password">Request a new recovery link</Link>
            )}
          </div>
          <p className="v-auth-legal">
            <ShieldCheck size={15} />
            Before joining, read our <Link to="/terms">Terms</Link> and{" "}
            <Link to="/privacy">Privacy information</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
