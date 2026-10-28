/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Copy, Film, Image as ImageIcon, MessageCircle, RefreshCw } from "lucide-react";
import type { Post } from "../../lib/supabase";
import { signSocialMedia, SOCIAL_MEDIA_BUCKETS } from "../../lib/social-media";
import "./profile-post-grid.css";

/** Profile tiles use the same private storage signing boundary as the feed. */
export function ProfilePostGrid({ posts }: { posts: Post[] }) {
  const items = useMemo(
    () =>
      posts.map((post) => ({
        post,
        media: [...(post.post_media ?? [])].sort((a, b) => a.position - b.position)[0],
      })),
    [posts],
  );
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [signingFailed, setSigningFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const paths = items.flatMap(({ media }) => (media?.object_path ? [media.object_path] : []));
    setUrls(new Map());
    setFailed(new Set());
    setSigningFailed(false);
    setLoading(paths.length > 0);
    if (!paths.length) return;
    void signSocialMedia(SOCIAL_MEDIA_BUCKETS.posts, paths)
      .then((result) => {
        if (!active) return;
        setUrls(result);
        setSigningFailed(paths.some((path) => !result.get(path)));
      })
      .catch(() => {
        if (active) setSigningFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [items, retry]);
  const fail = (path: string) => setFailed((current) => new Set([...current, path]));
  return (
    <>
      <div className="v32-profile-grid" aria-label="Profile posts" aria-busy={loading}>
        {items.map(({ post, media }) => {
          const url = media && !failed.has(media.object_path) ? urls.get(media.object_path) : null;
          return (
            <Link
              key={post.id}
              className={`v32-profile-tile ${media ? "has-media" : "is-text"}`}
              to={`/post/${post.id}`}
              aria-label={`Open post${post.body ? `: ${post.body.slice(0, 100)}` : ""}`}
            >
              {media && url ? (
                media.media_type === "video" ? (
                  <video
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    tabIndex={-1}
                    onError={() => fail(media.object_path)}
                  />
                ) : (
                  <img
                    src={url}
                    alt={media.alt_text || ""}
                    loading="lazy"
                    decoding="async"
                    onError={() => fail(media.object_path)}
                  />
                )
              ) : (
                <span className={`v32-profile-tile-copy ${loading && media ? "is-loading" : ""}`}>
                  {media ? (
                    <ImageIcon size={22} aria-hidden="true" />
                  ) : (
                    <MessageCircle size={20} aria-hidden="true" />
                  )}
                  <span>{post.body || (loading ? "Loading preview…" : "Open post")}</span>
                </span>
              )}
              {(post.post_media?.length ?? 0) > 1 ? (
                <Copy className="v32-profile-tile-mark" size={18} aria-label="Multiple media" />
              ) : media?.media_type === "video" ? (
                <Film className="v32-profile-tile-mark" size={18} aria-label="Video" />
              ) : null}
            </Link>
          );
        })}
      </div>
      {(signingFailed || failed.size > 0) && (
        <div className="v32-profile-media-error" role="status">
          <span>Some previews could not load. You can still open each post.</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={16} />
            Retry previews
          </button>
        </div>
      )}
    </>
  );
}
