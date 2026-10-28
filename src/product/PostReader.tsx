import { type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
export function PostReader({ children }: { children: ReactNode }) {
  return (
    <article className="v-post-reader">
      <header>
        <Link to="/home">
          <ArrowLeft size={18} />
          Back to your circle
        </Link>
        <span className="v-eyebrow">A MOMENT WORTH SHARING</span>
      </header>
      {children}
    </article>
  );
}
