import { type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUpRight, HelpCircle } from "lucide-react";
export function SystemStateFrame({ children }: { children: ReactNode }) {
  return (
    <main className="system-state-frame">
      <header>
        <Link to="/home" className="system-state-brand">
          VELORI<span>.</span>
        </Link>
        <Link to="/help">
          <HelpCircle size={15} /> Help center <ArrowUpRight size={13} />
        </Link>
      </header>
      <div className="system-state-content">{children}</div>
      <footer>A little pause. Your world is still here.</footer>
    </main>
  );
}
