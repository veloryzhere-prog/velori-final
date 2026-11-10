import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, type LinkProps } from "react-router";
import { Eye, Heart, Send, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { friendlyError, supabase } from "../lib/supabase";

type SocialTable =
  | "likes"
  | "stories"
  | "reel_likes"
  | "story_likes"
  | "story_views"
  | "comment_likes"
  | "comments"
  | "reel_comments";
type SocialChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};
const tableListeners = new Map<SocialTable, Set<(change: SocialChange) => void>>();
const tableChannels = new Map<SocialTable, ReturnType<typeof supabase.channel>>();

export function subscribeSocialTable(table: SocialTable, listener: (change: SocialChange) => void) {
  let listeners = tableListeners.get(table);
  if (!listeners) {
    listeners = new Set();
    tableListeners.set(table, listeners);
  }
  listeners.add(listener);
  if (!tableChannels.has(table)) {
    const channel = supabase
      .channel(`social-content:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const change = payload as unknown as SocialChange;
        for (const callback of tableListeners.get(table) ?? []) callback(change);
      })
      .subscribe();
    tableChannels.set(table, channel);
  }
  return () => {
    const current = tableListeners.get(table);
    current?.delete(listener);
    if (current?.size === 0) {
      tableListeners.delete(table);
      const channel = tableChannels.get(table);
      if (channel) void supabase.removeChannel(channel);
      tableChannels.delete(table);
    }
  };
}

type LikeTarget = "post" | "reel" | "story" | "story_viewers" | "post_comment" | "reel_comment";

const targets: Record<
  LikeTarget,
  { table: string; column: string; actorColumn: string; noun: string }
> = {
  post: { table: "likes", column: "post_id", actorColumn: "user_id", noun: "post" },
  reel: { table: "reel_likes", column: "reel_id", actorColumn: "user_id", noun: "reel" },
  story: { table: "story_likes", column: "story_id", actorColumn: "user_id", noun: "story" },
  story_viewers: {
    table: "story_views",
    column: "story_id",
    actorColumn: "viewer_id",
    noun: "story viewers",
  },
  post_comment: {
    table: "comment_likes",
    column: "post_comment_id",
    actorColumn: "user_id",
    noun: "comment",
  },
  reel_comment: {
    table: "comment_likes",
    column: "reel_comment_id",
    actorColumn: "user_id",
    noun: "comment",
  },
};

type Liker = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type SocialCommentCount = {
  target_type: "post" | "reel";
  comment_id: string;
  like_count: number | string;
  reply_count: number | string;
};

export function parseSocialCommentCounts(data: unknown): SocialCommentCount[] | null {
  if (!Array.isArray(data)) return null;
  const rows: SocialCommentCount[] = [];
  for (const value of data) {
    if (!value || typeof value !== "object") return null;
    const targetType: unknown = Reflect.get(value, "target_type");
    const commentId: unknown = Reflect.get(value, "comment_id");
    const likeCount: unknown = Reflect.get(value, "like_count");
    const replyCount: unknown = Reflect.get(value, "reply_count");
    if (
      (targetType !== "post" && targetType !== "reel") ||
      typeof commentId !== "string" ||
      (typeof likeCount !== "number" && typeof likeCount !== "string") ||
      !Number.isFinite(Number(likeCount)) ||
      (typeof replyCount !== "number" && typeof replyCount !== "string") ||
      !Number.isFinite(Number(replyCount))
    ) {
      return null;
    }
    rows.push({
      target_type: targetType,
      comment_id: commentId,
      like_count: likeCount,
      reply_count: replyCount,
    });
  }
  return rows;
}

export function profilePath(username?: string | null) {
  return username && /^[a-z0-9_]{3,24}$/i.test(username)
    ? `/profile/${encodeURIComponent(username.toLowerCase())}`
    : null;
}

export function ProfileLink({
  username,
  ...props
}: Omit<LinkProps, "to"> & { username?: string | null }) {
  const to = profilePath(username);
  if (!to) return <span className={props.className}>{props.children}</span>;
  return <Link {...props} to={to} />;
}

export { ShareToMessageDialog } from "../features/sharing/ShareSheet";

export function LikeListButton({
  target,
  contentId,
  count,
  className,
  label,
  showIcon = true,
}: {
  target: LikeTarget;
  contentId: string;
  count: number;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const config = targets[target];
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`See ${count} ${config.noun}${target === "story_viewers" ? "" : " likes"}`}
        aria-haspopup="dialog"
      >
        {showIcon ? (
          target === "story_viewers" ? (
            <Eye size={16} aria-hidden="true" />
          ) : (
            <Heart size={16} aria-hidden="true" />
          )
        ) : null}
        {label ?? count.toLocaleString()}
      </button>
      {open ? (
        <LikeListDialog target={target} contentId={contentId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function LikeListDialog({
  target,
  contentId,
  onClose,
}: {
  target: LikeTarget;
  contentId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const config = targets[target];
  const pageSize = 20;

  const load = useCallback(
    async (start: number, append: boolean) => {
      setLoading(true);
      setError("");
      const query = supabase
        .from(config.table)
        .select(`${config.actorColumn},created_at`)
        .eq(config.column, contentId)
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1);
      const { data: likes, error: likesError } = await query;
      if (likesError) {
        setError(friendlyError(likesError));
        setLoading(false);
        return;
      }
      const actorIds: string[] = [];
      for (const like of likes ?? []) {
        const actorId: unknown = Reflect.get(like, config.actorColumn);
        if (typeof actorId !== "string") {
          setError("The social activity returned an invalid profile reference.");
          setLoading(false);
          return;
        }
        actorIds.push(actorId);
      }
      const ids = [...new Set(actorIds)];
      const { data: profiles, error: profilesError } = ids.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .in("id", ids)
        : { data: [], error: null };
      if (profilesError) {
        setError(friendlyError(profilesError));
        setLoading(false);
        return;
      }
      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile as Liker]));
      const next = ids
        .map((id) => byId.get(id))
        .filter((profile): profile is Liker => Boolean(profile));
      setRows((current) => (append ? [...current, ...next] : next));
      setHasMore((likes ?? []).length === pageSize);
      setOffset(start + (likes ?? []).length);
      setLoading(false);
    },
    [config, contentId],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="social-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="social-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-like-list-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="social-like-list-title">
            {target === "story_viewers" ? "Story viewers" : "Liked by"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close liked by list">
            <X size={20} />
          </button>
        </header>
        {error ? (
          <div className="inline-feedback is-error" role="alert">
            <p>{error}</p>
            <button className="button button-outline" onClick={() => void load(0, false)}>
              Retry
            </button>
          </div>
        ) : null}
        <div className="social-dialog-list" aria-live="polite">
          {rows.map((profile) => (
            <ProfileLink
              className="social-dialog-person"
              username={profile.username}
              key={profile.id}
              onClick={onClose}
            >
              <span className="social-dialog-avatar">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  (profile.display_name || profile.username).slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <strong>{profile.display_name || profile.username}</strong>
                <small>@{profile.username}</small>
              </span>
            </ProfileLink>
          ))}
          {!loading && !error && rows.length === 0 ? (
            <p className="admin-empty">No likes yet.</p>
          ) : null}
          {loading ? <p role="status">Loading people who liked this…</p> : null}
        </div>
        {hasMore ? (
          <button
            className="button button-outline social-dialog-more"
            disabled={loading}
            onClick={() => void load(offset, true)}
          >
            {loading ? "Loading…" : "Show more"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
