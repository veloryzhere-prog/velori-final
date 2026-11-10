import { ArrowUpRight, Bookmark, Compass, Plus } from "lucide-react";
import { Link, NavLink } from "react-router";
export function FeedWelcome({ name }: { name?: string | null }) {
  return (
    <header className="clean-feed-header feed-new-intro">
      <div>
        <span className="clean-label">YOUR WORLD, IN GOOD COMPANY</span>
        <h1>
          {name && /^[a-zA-Z]{1,18}(?: |$)/.test(name)
            ? "Hey, " + name.split(" ")[0] + "."
            : "Your daily connection."}
        </h1>
        <p>A fresh moment. A familiar face. Something worth sharing.</p>
      </div>
      <Link className="clean-feed-create" to="/create">
        <Plus size={18} />
        Create something
        <ArrowUpRight size={17} />
      </Link>
      <nav aria-label="Discover your world">
        <NavLink to="/home" end>
          Latest moments
        </NavLink>
        <NavLink to="/explore">
          <Compass size={16} />
          Explore
        </NavLink>
        <NavLink to="/saved">
          <Bookmark size={16} />
          Your collection
        </NavLink>
      </nav>
    </header>
  );
}
