/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useState } from "react";
import { friendlyError, postSelection, supabase, type Post } from "../../lib/supabase";
import { ProfilePostGrid } from "./ProfilePostGrid";

/** Existing text mentions are the supported tagging mechanism. RLS filters every result. */
export function TaggedPosts({ username }: { username: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (!/^[a-z0-9_]{3,24}$/i.test(username)) {
      setError("This profile cannot be loaded.");
      setLoading(false);
      return;
    }
    // Exact username boundary: @alex must not include @alexander or email addresses.
    const pattern = `(^|[^a-z0-9_@])@${username}([^a-z0-9_]|$)`;
    void supabase
      .from("posts")
      .select(postSelection)
      .filter("body", "imatch", pattern)
      .eq("is_published", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 24)
      .abortSignal(controller.signal)
      .then(({ data, error: queryError }) => {
        if (controller.signal.aborted) return;
        if (queryError) setError(friendlyError(queryError));
        else {
          const rows = (data ?? []) as unknown as Post[];
          setPosts((current) =>
            offset === 0
              ? rows.slice(0, 24)
              : [
                  ...current,
                  ...rows.slice(0, 24).filter((row) => !current.some((item) => item.id === row.id)),
                ],
          );
          setHasMore(rows.length > 24);
        }
        setLoading(false);
      });
    return () => controller.abort();
  }, [username, offset, retry]);
  return (
    <section aria-label={`Posts mentioning @${username}`} aria-busy={loading}>
      <p className="muted">
        Posts that mention @{username}. Each post keeps its original audience.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {posts.length > 0 && <ProfilePostGrid posts={posts} />}
      {loading && <p role="status">Loading tagged posts…</p>}
      {!loading && !error && !posts.length && <p>No visible posts mention this profile yet.</p>}
      {hasMore && !error && (
        <button
          type="button"
          className="button button-outline"
          disabled={loading}
          onClick={() => setOffset((n) => n + 24)}
        >
          Load more tagged posts
        </button>
      )}
    </section>
  );
}
