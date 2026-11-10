import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ArrowLeft, Check, Mail, ShieldCheck, ArrowUpRight } from "lucide-react";
export function AuthJourney({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pathname } = useLocation();
  const done = pathname.includes("confirmed");
  return (
    <main className="v-auth-status">
      <header>
        <Link className="v-wordmark" to="/">
          <span className="v-brand-mark">v</span>velori
        </Link>
        <Link to="/help">
          Need a hand?
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="v-auth-status-layout">
        <aside>
          <span className="v-eyebrow">ONE STEP CLOSER</span>
          <h2>{done ? "Your circle starts here." : "Let’s make it official."}</h2>
          <p>A quick check to keep your account yours.</p>
          <ol>
            {[
              { icon: Mail, title: "Check your email", text: "Find the message from VELORI." },
              {
                icon: ShieldCheck,
                title: "Confirm your account",
                text: "Follow the secure link in your email.",
              },
              {
                icon: Check,
                title: "Make yourself at home",
                text: "Your next good connection is waiting.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                data-current={done ? i === 2 : pathname.includes("confirm") ? i === 1 : i === 0}
              >
                <span>
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/login">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </aside>
        <section className={"v-auth-status-card " + className}>{children}</section>
      </div>
    </main>
  );
}
