import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useFeatureFlag } from "../../lib/feature-flags";
import { customHtmlDocument } from "../../lib/custom-html-document";
import { safeCampaignUrl } from "./policy.mjs";
import "./campaigns.css";
export type AdCreative = {
  id?: string;
  title?: string;
  body?: string;
  image_url?: string;
  target_url?: string;
  advertiser_name?: string;
  cta_label?: string;
  creative_type?: string;
  custom_html?: string;
  custom_css?: string;
  placement?: string;
};
export function useAdvertisement(placement: string) {
  const enabled = useFeatureFlag("ads_enabled", false),
    [ad, setAd] = useState<AdCreative | null>(null);
  useEffect(() => {
    if (!enabled) {
      setAd(null);
      return;
    }
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("advertisements")
          .select(
            "id,title,body,image_url,target_url,placement,priority,advertiser_name,cta_label,creative_type,custom_html,custom_css",
          )
          .eq("status", "active")
          .eq("placement", placement)
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .or(`ends_at.is.null,ends_at.gt.${now}`)
          .order("priority", { ascending: false })
          .limit(1);
        if (active) setAd(!error ? data?.[0] || null : null);
      } catch {
        if (active) setAd(null);
      } finally {
        pending = false;
      }
    };
    void load();
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(load, 60000);
    const channel = supabase
      .channel("campaigns-" + placement)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "advertisements" },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(channel);
    };
  }, [enabled, placement]);
  return enabled ? ad : null;
}
export function SponsoredCard({
  ad,
  reel = false,
  preview = false,
  onSkip,
}: {
  ad: AdCreative;
  reel?: boolean;
  preview?: boolean;
  onSkip?: () => void;
}) {
  const [failed, setFailed] = useState(false),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const media = safeCampaignUrl(ad.image_url),
    target = safeCampaignUrl(ad.target_url),
    name = ad.advertiser_name || "VELORI";
  useEffect(() => {
    setFailed(false);
  }, [ad.image_url]);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    const visible = () => {
      if (document.hidden) node.pause();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      node.pause();
    };
  }, [ad.image_url]);
  const cta = target ? (
    preview ? (
      <span className="cp-ad-cta">
        {ad.cta_label || "Learn more"}
        <ArrowUpRight size={17} />
      </span>
    ) : target.startsWith("/") ? (
      <Link className="cp-ad-cta" to={target}>
        {ad.cta_label || "Learn more"}
        <ArrowUpRight size={17} />
      </Link>
    ) : (
      <a className="cp-ad-cta" href={target} target="_blank" rel="noopener noreferrer">
        {ad.cta_label || "Learn more"}
        <ArrowUpRight size={17} />
      </a>
    )
  ) : null;
  return (
    <article
      className={`cp-ad${reel ? " cp-ad-reel" : ""}${preview ? " cp-ad-preview" : ""}`}
      aria-label={`Advertisement from ${name}`}
    >
      <header className="cp-ad-header">
        <span className="cp-ad-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{name}</strong>
          <small>VELORI ad · Sponsored</small>
        </span>
        {onSkip && (
          <button onClick={onSkip} className="cp-ad-skip">
            Skip ad
          </button>
        )}
        <span className="cp-ad-disclosure">AD</span>
      </header>
      <div className="cp-ad-media">
        {ad.creative_type === "html" && ad.custom_html ? (
          <iframe
            sandbox=""
            title={(ad.title || "Sponsored") + " creative"}
            srcDoc={customHtmlDocument(ad.custom_html, ad.custom_css || "")}
          />
        ) : media && !failed ? (
          ad.creative_type === "video" ? (
            <video
              ref={video}
              src={media}
              controls={!reel}
              playsInline
              muted={muted}
              autoPlay={reel && !preview}
              loop={reel}
              preload="metadata"
              onPlaying={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setFailed(true)}
            />
          ) : (
            <img
              src={media}
              alt={ad.title || "Sponsored creative"}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )
        ) : (
          <div className="cp-ad-art" aria-hidden="true">
            <span>{name}</span>
            <i />
            <b>
              Something
              <br />
              worth discovering.
            </b>
          </div>
        )}
        {reel && ad.creative_type === "video" && !failed && (
          <div className="cp-ad-video-tools">
            <button
              aria-label={playing ? "Pause sponsored reel" : "Play sponsored reel"}
              onClick={() => {
                const v = video.current;
                if (v?.paused) void v.play().catch(() => setFailed(true));
                else v?.pause();
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              aria-label={muted ? "Unmute sponsored reel" : "Mute sponsored reel"}
              onClick={() => setMuted((x) => !x)}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        )}
      </div>
      <div className="cp-ad-copy">
        <span>IN YOUR WORLD</span>
        <h3>{ad.title || "Your headline"}</h3>
        {ad.body && <p>{ad.body}</p>}
        {failed && <small role="status">The creative couldn’t load.</small>}
        {cta}
      </div>
      {!reel && (
        <footer className="cp-ad-footer">
          <span>Thoughtfully placed in your feed.</span>
          <span>Sponsored</span>
        </footer>
      )}
    </article>
  );
}
