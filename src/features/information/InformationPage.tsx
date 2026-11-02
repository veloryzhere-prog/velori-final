import { useEffect, useState } from "react";
import { loadPublishedCmsPage } from "../../lib/published-cms-pages";
import { supabase } from "../../lib/supabase";
import { informationFooterLinks, forgeFooterLinks } from "./catalog";
import "./information.css";
export type InformationFooterLink = readonly [string, string];

export function useInformationFooterLinks() {
  const [links, setLinks] = useState<readonly InformationFooterLink[]>(informationFooterLinks);
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
  return links;
}
