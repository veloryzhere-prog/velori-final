import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { loadPublishedCmsPage } from "../../lib/published-cms-pages";
import { supabase } from "../../lib/supabase";
import { informationFooterLinks, forgeFooterLinks } from "./catalog";
import "./information.css";
export function InformationFooter({ compact = false }: { compact?: boolean }) {
  const [links, setLinks] =
    useState<readonly (readonly [string, string])[]>(informationFooterLinks);
  useEffect(() => {
    let active = true;
    const load = () =>
      void loadPublishedCmsPage("/directory", { force: true }).then((result) => {
        if (!active || result.status !== "ready") return;
        const blocks = result.page.content_blocks ?? [];
        if (!blocks.length) return;
        const next = blocks.flatMap((block) => {
          const b = block as { type?: string; visible?: boolean; title?: string; url?: string };
          return b.type === "button" &&
            b.visible !== false &&
            b.title &&
            /^\/(?!\/)/.test(b.url ?? "")
            ? [[b.title, b.url!] as const]
            : [];
        });
        setLinks([
          ...next,
          ...forgeFooterLinks.filter(([, to]) => !next.some(([, href]) => href === to)),
        ]);
      });
    load();
    const channel = supabase
      .channel("footer-directory")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cms_page_publication_events",
          filter: "route=eq./directory",
        },
        load,
      )
      .subscribe();
    const visible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return (
    <footer className={`vi-footer${compact ? " vi-footer-compact" : ""}`}>
      {!compact && (
        <div className="vi-footer-heading">
          <Link to="/about">
            velori<span>✦</span>
          </Link>
          <p>A little more connected.</p>
        </div>
      )}
      <nav aria-label="VELORI information">
        {links.map(([label, to]) => (
          <Link to={to} key={to}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="vi-footer-bottom">
        <label>
          <span className="vi-sr-only">Interface language</span>
          <select aria-label="Interface language" value="en" onChange={() => {}}>
            <option value="en">English</option>
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </label>
        <span>© {new Date().getFullYear()} VELORI from VELORYZ</span>
        <Link to="/contact">Contact</Link>
      </div>
    </footer>
  );
}
