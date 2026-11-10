import { createUuid } from "../lib/uuid.mjs";
import { StoryExperience } from "../features/stories/StoryExperience";
import { setSocialReaction } from "../lib/social-reactions.mjs";
import { MotionSculpture } from "../motion/MotionSculpture";
import { PageWorkspace } from "../components/PageWorkspace";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  AnimatePresence,
  m,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Camera,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Send,
  Share2,
  Sparkles,
  Type,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useFeatureFlag } from "../lib/feature-flags";
import "../components/story-editor/story-studio.css";
import { PROFILE_CHANGED_EVENT, type ProfileSnapshot } from "../lib/profile-events";
import {
  removeSocialMedia,
  inspectReelVideo,
  signSocialMedia,
  SOCIAL_MEDIA_BUCKETS,
  socialMediaPath,
  uploadSocialMedia,
  validateSocialMedia,
} from "../lib/social-media";
import { friendlyError, supabase } from "../lib/supabase";
import { deleteStoryAndMedia, publishStory } from "../lib/story-publishing";
import { EmptyState, Problem, RuntimeLoading } from "./shell";
import { Button, CardHeading, Input, Label, Textarea } from "./admin-primitives";
import {
  componentEntranceTiming,
  defaultSpring,
  heavySpring,
  lightSpring,
} from "../motion/springs";
import { reelCommentEntrance, reelCommentListStagger } from "../motion/variants";
import {
  LikeListButton,
  parseSocialCommentCounts,
  ProfileLink,
  ShareToMessageDialog,
  subscribeSocialTable,
} from "./social-engagement";
import {
  ReelsExperience,
  type Comment as FeatureReelComment,
  type Reel as FeatureReel,
} from "../features/reels";
import ReelStudio from "../components/reel-editor/ReelStudio";

function messageFor(cause: unknown) {
  const error =
    cause && typeof cause === "object" && "message" in cause
      ? (cause as { code?: string; message?: string })
      : null;
  return friendlyError(error);
}

function formatMediaTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safeSeconds / 60)}:${Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

const REEL_DRAG_CONSTRAINTS = { top: 0, bottom: 0 };
const REEL_DRAG_ELASTIC = { top: 0.1, bottom: 0.1 };
const COMMENT_SHEET_DRAG_CONSTRAINTS = { top: 0, bottom: 0 };
const REEL_DRAG_SKIP_SELECTOR =
  ".reel-comments-sheet, .reel-playback-progress, button, input, textarea, a";

type StoryAsset = {
  id: string;
  object_path: string;
  media_type: "image" | "video" | "text";
  allow_reactions: boolean;
  allow_replies: boolean;
  mime_type: string;
  byte_size: number;
};

type Story = {
  id: string;
  author_id: string;
  status?: "active" | "archived";
  audience?: "public" | "followers" | "close_friends" | "private";
  visual_duration_seconds?: number;
  caption: string;
  media_url: string;
  media_type: "image" | "video" | "text";
  allow_reactions: boolean;
  allow_replies: boolean;
  expires_at: string;
  created_at: string;
  published_at?: string | null;
  archived_at?: string | null;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_private?: boolean;
  } | null;
  story_media: StoryAsset[];
  mediaSrc: string;
  seen: boolean;
};

type StoryGroup = {
  authorId: string;
  profile: Story["profiles"];
  stories: Story[];
};

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

async function renderStoryTextOverlay(
  file: File,
  text: string,
  color: string,
  position: { x: number; y: number },
) {
  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected image could not be opened."));
      image.src = sourceUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this story image.");
    context.drawImage(image, 0, 0);
    const fontSize = Math.max(28, canvas.width * 0.075);
    const maxWidth = canvas.width * 0.84;
    context.font = `700 ${fontSize}px Manrope, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.shadowColor = "rgba(0, 0, 0, 0.55)";
    context.shadowBlur = fontSize * 0.22;
    const lines: string[] = [];
    let line = "";
    for (const word of text.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.22;
    const x = (position.x / 100) * canvas.width;
    const y = (position.y / 100) * canvas.height;
    lines.forEach((item, index) => {
      context.fillText(item, x, y + (index - (lines.length - 1) / 2) * lineHeight, maxWidth);
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("The edited story image could not be rendered."));
      }, "image/png");
    });
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-story.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function useVisibleStories(viewerId?: string) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("stories")
        .select(
          "id,author_id,status,audience,visual_duration_seconds,caption,media_url,media_type,allow_reactions,allow_replies,expires_at,created_at,profiles!author_id(username,display_name,avatar_url),story_media(id,object_path,media_type,mime_type,byte_size)",
        )
        .eq("status", "active")
        .eq("moderation_state", "clean")
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;

      const rows = (data ?? []) as unknown as Omit<Story, "mediaSrc" | "seen">[];
      const paths = rows.flatMap((story) =>
        (story.story_media ?? []).map((media) => media.object_path).filter(Boolean),
      );
      const mediaUrls = await signSocialMedia(SOCIAL_MEDIA_BUCKETS.stories, paths);
      let seenIds = new Set<string>();
      if (viewerId && rows.length) {
        const { data: views, error: viewError } = await supabase
          .from("story_views")
          .select("story_id")
          .eq("viewer_id", viewerId)
          .in(
            "story_id",
            rows.map((story) => story.id),
          );
        if (viewError) throw viewError;
        seenIds = new Set((views ?? []).map((view) => view.story_id));
      }
      setStories(
        rows.map((story) => {
          const asset = story.story_media?.find((media) => media.object_path);
          return {
            ...story,
            mediaSrc: (asset && mediaUrls.get(asset.object_path)) || story.media_url || "",
            seen: seenIds.has(story.id),
          };
        }),
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeSocialTable("stories", () => void load()), [load]);

  useEffect(() => {
    const nearestExpiry = stories
      .map((story) => Date.parse(story.expires_at))
      .filter((time) => Number.isFinite(time) && time > Date.now())
      .sort((left, right) => left - right)[0];
    if (!nearestExpiry) return;
    const timer = window.setTimeout(
      () => void load(),
      Math.min(nearestExpiry - Date.now() + 250, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [load, stories]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [load]);

  useEffect(() => {
    const updateProfile = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (!changed) return;
      setStories((current) =>
        current.map((story) =>
          story.author_id === changed.id
            ? {
                ...story,
                profiles: {
                  username: changed.username,
                  display_name: changed.display_name || "",
                  avatar_url: changed.avatar_url,
                },
              }
            : story,
        ),
      );
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateProfile);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateProfile);
  }, []);

  const markViewed = useCallback(
    async (story: Story) => {
      if (!viewerId || story.seen || story.status === "archived") return;
      const { error: writeError } = await supabase
        .from("story_views")
        .upsert(
          { story_id: story.id, viewer_id: viewerId },
          { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
        );
      if (writeError) throw writeError;
      setStories((current) =>
        current.map((item) => (item.id === story.id ? { ...item, seen: true } : item)),
      );
    },
    [viewerId],
  );

  return { stories, loading, error, load, markViewed };
}

function groupStories(stories: Story[]): StoryGroup[] {
  const grouped = new Map<string, StoryGroup>();
  for (const story of stories) {
    const group = grouped.get(story.author_id) ?? {
      authorId: story.author_id,
      profile: story.profiles,
      stories: [],
    };
    group.stories.push(story);
    grouped.set(story.author_id, group);
  }
  return [...grouped.values()]
    .map((group) => ({
      ...group,
      stories: group.stories.sort((left, right) => left.created_at.localeCompare(right.created_at)),
    }))
    .sort((left, right) =>
      right.stories.at(-1)!.created_at.localeCompare(left.stories.at(-1)!.created_at),
    );
}

async function removeStory(story: Story, userId: string) {
  if (story.author_id !== userId) throw new Error("You can only delete your own story.");
  await deleteStoryAndMedia(
    story.id,
    userId,
    (story.story_media ?? []).map((media) => media.object_path),
  );
}

function StoryViewer({
  stories,
  initialId,
  viewerId,
  onViewed,
  onDelete,
  onClose,
  onRetryMedia,
}: {
  stories: Story[];
  initialId: string;
  viewerId?: string;
  onViewed: (story: Story) => Promise<void>;
  onDelete: (story: Story) => Promise<boolean>;
  onClose: () => void;
  onRetryMedia?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      stories.findIndex((story) => story.id === initialId),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [replyStatus, setReplyStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const story = stories[index];
  const closeViewer = onClose;
  useEffect(() => {
    const next = stories.findIndex((item) => item.id === initialId);
    if (next >= 0) setIndex(next);
  }, [initialId]);
  useEffect(() => {
    setLiked(false);
    setLikeCount(0);
    setViewerCount(0);
    setError("");
    setReplyStatus("");
    setReportStatus("");
  }, [story?.id]);
  useEffect(() => {
    if (!story || searchParams.get("story") === story.id) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("story", story.id);
        return next;
      },
      { replace: true },
    );
  }, [story?.id, searchParams, setSearchParams]);
  useEffect(() => {
    if (!story) return;
    let active = true;
    const readState = async () => {
      const [likes, views, ownLike] = await Promise.all([
        viewerId
          ? supabase
              .from("story_likes")
              .select("user_id", { count: "exact", head: true })
              .eq("story_id", story.id)
          : Promise.resolve({ count: null, error: null }),
        viewerId === story.author_id
          ? supabase
              .from("story_views")
              .select("viewer_id", { count: "exact", head: true })
              .eq("story_id", story.id)
          : Promise.resolve({ count: null, error: null }),
        viewerId
          ? supabase
              .from("story_likes")
              .select("user_id")
              .eq("story_id", story.id)
              .eq("user_id", viewerId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (!active) return;
      const failure = likes.error || views.error || ownLike.error;
      if (failure) setError(messageFor(failure));
      else {
        setLikeCount(likes.count ?? 0);
        setViewerCount(views.count ?? 0);
        setLiked(Boolean(ownLike.data));
        setError("");
      }
    };
    void readState();
    const stopLikes = viewerId
      ? subscribeSocialTable("story_likes", (change) => {
          const row = change.eventType === "DELETE" ? change.old : change.new;
          if (row.story_id !== story.id) return;
          void supabase
            .from("story_likes")
            .select("user_id", { count: "exact", head: true })
            .eq("story_id", story.id)
            .then(({ count, error: countError }) => {
              if (!active) return;
              if (countError) setError(messageFor(countError));
              else setLikeCount(count ?? 0);
            });
          if (viewerId && row.user_id === viewerId) setLiked(change.eventType !== "DELETE");
        })
      : () => {};
    const stopViews =
      viewerId === story.author_id
        ? subscribeSocialTable("story_views", (change) => {
            const row = change.eventType === "DELETE" ? change.old : change.new;
            if (row.story_id !== story.id) return;
            void supabase
              .from("story_views")
              .select("viewer_id", { count: "exact", head: true })
              .eq("story_id", story.id)
              .then(({ count, error: countError }) => {
                if (!active) return;
                if (countError) setError(messageFor(countError));
                else setViewerCount(count ?? 0);
              });
          })
        : () => {};
    return () => {
      active = false;
      stopLikes();
      stopViews();
    };
  }, [story?.id, story?.author_id, viewerId]);

  useEffect(() => {
    if (story && story.status !== "archived")
      void onViewed(story).catch((cause) => setError(messageFor(cause)));
  }, [onViewed, story]);

  if (!story) return null;
  async function deleteCurrent() {
    if (!viewerId || story.author_id !== viewerId || busy) return;
    if (!window.confirm("Delete this story and its media? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      if (await onDelete(story)) closeViewer();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike() {
    if (!viewerId || !story || !story.allow_reactions || story.status === "archived" || busy)
      return;
    const previous = liked;
    setLiked(!previous);
    setLikeCount((count) => Math.max(0, count + (previous ? -1 : 1)));
    setBusy(true);
    setError("");
    try {
      const result = previous
        ? await supabase
            .from("story_likes")
            .delete()
            .eq("story_id", story.id)
            .eq("user_id", viewerId)
        : await supabase
            .from("story_likes")
            .upsert(
              { story_id: story.id, user_id: viewerId },
              { onConflict: "story_id,user_id", ignoreDuplicates: true },
            );
      if (result.error) throw result.error;
      const [state, count] = await Promise.all([
        supabase
          .from("story_likes")
          .select("user_id")
          .eq("story_id", story.id)
          .eq("user_id", viewerId)
          .maybeSingle(),
        supabase
          .from("story_likes")
          .select("user_id", { count: "exact", head: true })
          .eq("story_id", story.id),
      ]);
      if (state.error || count.error) throw state.error || count.error;
      setLiked(Boolean(state.data));
      setLikeCount(count.count ?? 0);
    } catch (cause) {
      setLiked(previous);
      setLikeCount((count) => Math.max(0, count + (previous ? 1 : -1)));
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function sendStoryReply(text: string): Promise<boolean> {
    if (
      !viewerId ||
      story.status === "archived" ||
      !story.allow_replies ||
      !text.trim() ||
      replyBusy
    )
      return false;
    setReplyBusy(true);
    setReplyStatus("");
    setError("");
    try {
      const { data, error: failure } = await supabase.rpc("send_story_reply", {
        p_story_id: story.id,
        p_body: text.trim(),
      });
      if (failure) throw failure;
      const sent = Array.isArray(data) ? data[0] : data;
      if (!sent?.conversation_id || !sent?.message_id) {
        setReplyStatus("Reply sent. Open Messages to find your conversation.");
        return true;
      }
      navigate(
        `/messages?conversation=${encodeURIComponent(sent.conversation_id)}&message=${encodeURIComponent(sent.message_id)}`,
      );
      return true;
    } catch (cause) {
      setError(messageFor(cause));
      return false;
    } finally {
      setReplyBusy(false);
    }
  }

  async function reportStory() {
    if (!viewerId || story.status === "archived" || viewerId === story.author_id) return;
    const { data, error: reportError } = await supabase.rpc("report_social_content", {
      p_target_type: "story",
      p_target_id: story.id,
      p_category: "other",
      p_reason: "",
    });
    if (reportError) {
      setError(messageFor(reportError));
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    setReportStatus(
      result?.already_reported
        ? "You have already reported this story."
        : "Story reported. Thank you for helping keep VELORI safe.",
    );
    setError("");
  }

  return (
    <StoryExperience
      stories={stories}
      index={index}
      onIndex={setIndex}
      viewerId={viewerId}
      liked={liked}
      busy={busy}
      replyBusy={replyBusy}
      error={error}
      status={replyStatus || reportStatus}
      onClose={onClose}
      onRetryMedia={onRetryMedia}
      onLike={() => void toggleLike()}
      onReply={sendStoryReply}
      onReport={() => void reportStory()}
      onDelete={() => void deleteCurrent()}
      engagement={
        <>
          {likeCount > 0 && (
            <LikeListButton target="story" contentId={story.id} count={likeCount} />
          )}{" "}
          {viewerId === story.author_id && (
            <LikeListButton
              target="story_viewers"
              contentId={story.id}
              count={viewerCount}
              label={"Viewers · " + viewerCount.toLocaleString()}
            />
          )}
        </>
      }
    />
  );
}

export function StoryTray() {
  const { user } = useAuth();
  const enabled = useFeatureFlag("stories_enabled", true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { stories, loading, error, load, markViewed } = useVisibleStories(user?.id);
  const [viewerStart, setViewerStart] = useState<string | null>(null);
  const [ownProfile, setOwnProfile] = useState<{
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [profileError, setProfileError] = useState("");
  const groups = groupStories(stories);
  const requestedStory = searchParams.get("story");

  useEffect(() => {
    if (!requestedStory || loading) return;
    if (stories.some((story) => story.id === requestedStory)) setViewerStart(requestedStory);
  }, [loading, requestedStory, stories]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setOwnProfile(null);
      setProfileError("");
      return () => {
        active = false;
      };
    }
    void supabase
      .from("profiles")
      .select("username,display_name,avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(
        ({ data, error: queryError }) => {
          if (!active) return;
          if (queryError) {
            setProfileError(messageFor(queryError));
            return;
          }
          setOwnProfile(data);
          setProfileError("");
        },
        (cause: unknown) => {
          if (active) setProfileError(messageFor(cause));
        },
      );
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const updateOwnProfile = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (changed?.id !== user?.id) return;
      setOwnProfile({
        username: changed.username,
        display_name: changed.display_name || "",
        avatar_url: changed.avatar_url,
      });
      setProfileError("");
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateOwnProfile);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateOwnProfile);
  }, [user]);

  if (!user || !enabled) return null;
  const closeViewer = () => {
    setViewerStart(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("story");
        return next;
      },
      { replace: true },
    );
  };
  const openGroup = (group: StoryGroup) => {
    const storyId = group.stories[0]?.id;
    if (!storyId) return;
    setViewerStart(storyId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("story", storyId);
      return next;
    });
  };
  const ownStories = groups.find((group) => group.authorId === user.id);
  const deleteOwnStory = async (story: Story) => {
    await removeStory(story, user.id);
    await load();
    return true;
  };

  return (
    <section className="feed-section story-tray-section" aria-label="Stories">
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> STORIES
          </div>
          <h2>Moments from your circle</h2>
        </div>
        <Link to="/stories" className="inline-link">
          See all
        </Link>
      </div>
      {error ? (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <Button className="button button-outline" onClick={() => void load()} disabled={loading}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="story-tray" aria-label="Active stories">
          <Link to="/stories?create=1" className="story-tray-create">
            <span className="story-tray-avatar">
              {ownProfile?.avatar_url ? (
                <img src={ownProfile.avatar_url} alt="" />
              ) : (
                <span>
                  {(ownProfile?.display_name || ownProfile?.username || user.email || "V")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
              <span className="story-tray-add-indicator">
                <Plus size={13} aria-hidden="true" />
              </span>
            </span>
            <strong>Add story</strong>
            <small>Your moment</small>
          </Link>
          {ownStories && (
            <button
              type="button"
              className="story-tray-person"
              data-seen={ownStories.stories.some((story) => !story.seen) ? "false" : "true"}
              onClick={() => openGroup(ownStories)}
              aria-label="View your story"
            >
              <span className="story-tray-avatar">
                {ownProfile?.avatar_url ? (
                  <img src={ownProfile.avatar_url} alt="" />
                ) : (
                  <span>
                    {(ownProfile?.display_name || ownProfile?.username || user.email || "V")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
              </span>
              <strong>Your story</strong>
              <small>
                {ownStories.stories.length} {ownStories.stories.length === 1 ? "moment" : "moments"}
              </small>
            </button>
          )}
          {groups
            .filter((group) => group.authorId !== user.id)
            .map((group) => {
              const unseen = group.stories.some((story) => !story.seen);
              const name = group.profile?.display_name || `@${group.profile?.username || "member"}`;
              return (
                <button
                  key={group.authorId}
                  type="button"
                  className="story-tray-person"
                  data-seen={unseen ? "false" : "true"}
                  onClick={() => openGroup(group)}
                  aria-label={`View ${name}'s stories${unseen ? ", unseen" : ", seen"}`}
                >
                  <span className="story-tray-avatar">
                    {group.profile?.avatar_url ? (
                      <img src={group.profile.avatar_url} alt="" />
                    ) : (
                      <span>{name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <strong>{name}</strong>
                  <small>
                    {group.stories.length} {group.stories.length === 1 ? "story" : "stories"}
                  </small>
                </button>
              );
            })}
          {loading && <RuntimeLoading label="Loading stories…" />}
          {!loading && groups.length === 0 && (
            <p className="admin-empty">No active stories yet. Share yours to start the row.</p>
          )}
        </div>
      )}
      {profileError ? (
        <p className="inline-feedback is-error" role="status">
          Your story avatar could not be refreshed: {profileError}
        </p>
      ) : null}
      {viewerStart && (
        <StoryViewer
          onRetryMedia={load}
          stories={stories}
          initialId={viewerStart}
          viewerId={user.id}
          onViewed={markViewed}
          onDelete={deleteOwnStory}
          onClose={closeViewer}
        />
      )}
    </section>
  );
}

type ReelAsset = {
  id: string;
  object_path: string;
  media_type: "video" | "image";
  mime_type: string;
  byte_size: number;
  duration_seconds: number | null;
  processing_state: "uploading" | "uploaded" | "ready" | "failed";
};
type Reel = {
  id: string;
  author_id: string;
  title: string;
  caption: string;
  video_url: string;
  thumbnail_url: string;
  allow_comments: boolean;
  allow_likes: boolean;
  allow_sharing: boolean;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_private?: boolean;
  } | null;
  reel_media: ReelAsset[];
  mediaSrc: string;
  posterSrc: string;
  likedByMe: boolean;
  savedByMe: boolean;
};
type ReelComment = {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  liked_by_me: boolean;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

function ReelCommentIdentity({ comment }: { comment: ReelComment }) {
  const username = comment.profiles?.username;
  const label = username ? `@${username}` : "@member";

  return (
    <div className="reel-comment-identity">
      <span className="reel-comment-avatar" aria-hidden="true">
        {comment.profiles?.avatar_url ? (
          <img src={comment.profiles.avatar_url} alt="" />
        ) : (
          (comment.profiles?.display_name || username || "M").slice(0, 1).toUpperCase()
        )}
      </span>
      {username ? <ProfileLink username={username}>{label}</ProfileLink> : <strong>{label}</strong>}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <span className="page-heading-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function FeatureDisabled({ name }: { name: string }) {
  return (
    <EmptyState
      icon={Sparkles}
      title="Feature unavailable"
      text={`${name} has been turned off by the platform administrator.`}
      action="Back to the feed"
      to="/home"
    />
  );
}

export function ReelsPage({ studioOnly = false }: { studioOnly?: boolean } = {}) {
  const enabled = useFeatureFlag("reels_enabled", true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("reel");
  const requestedCommentId = searchParams.get("comment");
  const [legacyStudioRequested, setLegacyStudioRequested] = useState(
    () => new URLSearchParams(window.location.search).get("create") === "1",
  );
  const inStudio = studioOnly || legacyStudioRequested || searchParams.get("create") === "1";
  const [studioStep, setStudioStep] = useState<"device" | "editor" | "publish">("device");
  const [items, setItems] = useState<Reel[]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [muted, setMuted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const reelProgress = useMotionValue(0);
  const progressScaleX = useTransform(reelProgress, (progress) =>
    Math.min(1, Math.max(0, progress)),
  );
  const [showComments, setShowComments] = useState(() => Boolean(searchParams.get("comment")));
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReelComment | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted">("none");
  const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
  const [uiVisible, setUiVisible] = useState(true);
  const [heartBurst, setHeartBurst] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const singleTapTimeout = useRef<number | null>(null);
  const lastVideoTap = useRef(0);
  const heartBurstTimeout = useRef<number | null>(null);
  const uiIdleTimeout = useRef<number | null>(null);
  const previousReelIndex = useRef(-1);
  const reelDragControls = useDragControls();
  const commentsDragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const skipLoadForSelection = useRef(false);
  const previewUrl = useObjectUrl(file);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("reels")
        .select(
          "id,author_id,title,caption,video_url,thumbnail_url,allow_comments,allow_likes,allow_sharing,created_at,profiles!author_id(username,display_name,avatar_url,is_private),reel_media(id,object_path,media_type,mime_type,byte_size,duration_seconds,processing_state)",
        )
        .eq("status", "published")
        .eq("is_deleted", false)
        .eq("moderation_state", "clean")
        .order("created_at", { ascending: false })
        .limit(24);
      if (queryError) throw queryError;
      setPageOffset(data?.length ?? 0);
      setHasMore((data?.length ?? 0) === 24);
      let rows = (data ?? []) as unknown as Omit<Reel, "mediaSrc" | "likedByMe" | "savedByMe">[];
      if (requestedId && !rows.some((reel) => reel.id === requestedId)) {
        const { data: requested, error: requestedError } = await supabase
          .from("reels")
          .select(
            "id,author_id,title,caption,video_url,thumbnail_url,allow_comments,allow_likes,allow_sharing,created_at,profiles!author_id(username,display_name,avatar_url,is_private),reel_media(id,object_path,media_type,mime_type,byte_size,duration_seconds,processing_state)",
          )
          .eq("id", requestedId)
          .eq("status", "published")
          .eq("is_deleted", false)
          .eq("moderation_state", "clean")
          .maybeSingle();
        if (requestedError) throw requestedError;
        if (requested) rows = [requested as unknown as (typeof rows)[number], ...rows];
      }
      const paths = rows.flatMap((reel) =>
        (reel.reel_media ?? []).map((asset) => asset.object_path).filter(Boolean),
      );
      const mediaUrls = await signSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, paths);
      let likes = new Set<string>();
      let saves = new Set<string>();
      const ids = rows.map((reel) => reel.id);
      if (user && ids.length) {
        const [likeResult, saveResult] = await Promise.all([
          supabase.from("reel_likes").select("reel_id").eq("user_id", user.id).in("reel_id", ids),
          supabase.from("reel_saves").select("reel_id").eq("user_id", user.id).in("reel_id", ids),
        ]);
        if (likeResult.error) throw likeResult.error;
        if (saveResult.error) throw saveResult.error;
        likes = new Set((likeResult.data ?? []).map((row) => row.reel_id));
        saves = new Set((saveResult.data ?? []).map((row) => row.reel_id));
      }
      const ready = rows
        .map((reel) => {
          const asset = (reel.reel_media ?? []).find((media) => media.media_type === "video");
          const cover = (reel.reel_media ?? []).find((media) => media.media_type === "image");
          return {
            ...reel,
            mediaSrc: (asset && mediaUrls.get(asset.object_path)) || reel.video_url || "",
            posterSrc: (cover && mediaUrls.get(cover.object_path)) || reel.thumbnail_url || "",
            likedByMe: likes.has(reel.id),
            savedByMe: saves.has(reel.id),
          };
        })
        .filter((reel) => Boolean(reel.mediaSrc));
      setItems(ready);
      const requested = ready.find((reel) => reel.id === requestedId);
      const initialReel =
        requested ?? (requestedId ? null : ready[Math.floor(Math.random() * ready.length)]);
      setActiveId(initialReel?.id ?? null);
      if (rows.length > 0 && ready.length === 0)
        setError("Published reels were found, but their video media could not be loaded.");
      if (requestedId && !requested)
        setError("This reel is unavailable or you do not have permission to view it.");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [requestedId, user]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("reels")
        .select(
          "id,author_id,title,caption,video_url,thumbnail_url,allow_comments,allow_likes,allow_sharing,created_at,profiles!author_id(username,display_name,avatar_url,is_private),reel_media(id,object_path,media_type,mime_type,byte_size,duration_seconds,processing_state)",
        )
        .eq("status", "published")
        .eq("is_deleted", false)
        .eq("moderation_state", "clean")
        .order("created_at", { ascending: false })
        .range(pageOffset, pageOffset + 23);
      if (queryError) throw queryError;
      const rows = (data ?? []) as unknown as Omit<
        Reel,
        "mediaSrc" | "posterSrc" | "likedByMe" | "savedByMe"
      >[];
      setPageOffset((offset) => offset + rows.length);
      setHasMore(rows.length === 24);
      const mediaUrls = await signSocialMedia(
        SOCIAL_MEDIA_BUCKETS.reels,
        rows.flatMap((reel) => reel.reel_media.map((asset) => asset.object_path).filter(Boolean)),
      );
      const ids = rows.map((reel) => reel.id);
      const [likes, saves] =
        user && ids.length
          ? await Promise.all([
              supabase
                .from("reel_likes")
                .select("reel_id")
                .eq("user_id", user.id)
                .in("reel_id", ids),
              supabase
                .from("reel_saves")
                .select("reel_id")
                .eq("user_id", user.id)
                .in("reel_id", ids),
            ])
          : [
              { data: [], error: null },
              { data: [], error: null },
            ];
      if (likes.error || saves.error) throw likes.error || saves.error;
      const liked = new Set((likes.data ?? []).map((row) => row.reel_id));
      const saved = new Set((saves.data ?? []).map((row) => row.reel_id));
      const more = rows
        .map((reel) => {
          const video = reel.reel_media.find((asset) => asset.media_type === "video");
          const cover = reel.reel_media.find((asset) => asset.media_type === "image");
          return {
            ...reel,
            mediaSrc: (video && mediaUrls.get(video.object_path)) || reel.video_url || "",
            posterSrc: (cover && mediaUrls.get(cover.object_path)) || reel.thumbnail_url || "",
            likedByMe: liked.has(reel.id),
            savedByMe: saved.has(reel.id),
          };
        })
        .filter((reel) => Boolean(reel.mediaSrc));
      setItems((current) => {
        const known = new Set(current.map((reel) => reel.id));
        return [...current, ...more.filter((reel) => !known.has(reel.id))];
      });
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, pageOffset, user]);

  useEffect(() => {
    if (inStudio) {
      setLoading(false);
      return;
    }
    if (skipLoadForSelection.current) {
      skipLoadForSelection.current = false;
      return;
    }
    void load();
  }, [inStudio, load]);

  useEffect(() => {
    if (!activeId || requestedId === activeId) return;
    skipLoadForSelection.current = true;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("reel", activeId);
        if (requestedId) next.delete("comment");
        return next;
      },
      { replace: true },
    );
  }, [activeId, requestedId, setSearchParams]);

  useEffect(() => {
    if (requestedCommentId) setShowComments(true);
  }, [requestedCommentId]);

  useEffect(() => {
    if (!requestedCommentId || !comments.length) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`reel-comment-${requestedCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [comments, requestedCommentId]);

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video || !activeId) return;
    setVideoLoading(true);
    setVideoEnded(false);
    setVideoFailed(false);
    setPlaybackTime(0);
    setPlaybackDuration(0);
    reelProgress.set(0);
    let progressFrame = 0;
    let inView = false;
    const syncProgress = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        reelProgress.set(video.currentTime / video.duration);
      }
      progressFrame = window.requestAnimationFrame(syncProgress);
    };
    progressFrame = window.requestAnimationFrame(syncProgress);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        if (inView && !document.hidden) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    const pauseWhenHidden = () => {
      if (document.hidden) video.pause();
      else if (inView) void video.play().catch(() => {});
    };
    observer.observe(video);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(progressFrame);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      video.pause();
    };
  }, [activeId, reelProgress]);

  useEffect(() => {
    const updateAuthor = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (!changed) return;
      setItems((current) =>
        current.map((reel) =>
          reel.author_id === changed.id
            ? {
                ...reel,
                profiles: {
                  username: changed.username,
                  display_name: changed.display_name || "",
                  avatar_url: changed.avatar_url,
                },
              }
            : reel,
        ),
      );
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateAuthor);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateAuthor);
  }, []);

  async function createReel() {
    if (!user || !file || saving) return;
    setSaving(true);
    setError("");
    setPublishStatus("Preparing your reel…");
    let id = "";
    let path = "";
    let reelCreated = false;
    let mediaCreated = false;
    let uploadStarted = false;
    try {
      const checked = await inspectReelVideo(file);
      if (title.trim().length > 140) throw new Error("Reel titles can be up to 140 characters.");
      if (caption.length > 2500) throw new Error("Reel captions can be up to 2,500 characters.");
      id = createUuid();
      path = socialMediaPath(user.id, id, checked.extension);
      const { error: reelError } = await supabase.from("reels").insert({
        id,
        author_id: user.id,
        title: title.trim(),
        caption: caption.trim(),
        video_url: "",
        thumbnail_url: "",
        status: "draft",
        visibility,
        allow_comments: allowComments,
        allow_likes: true,
        allow_sharing: allowSharing,
      });
      if (reelError) throw reelError;
      reelCreated = true;
      const { error: mediaError } = await supabase.from("reel_media").insert({
        reel_id: id,
        media_type: "video",
        object_path: path,
        original_name: file.name.slice(0, 255),
        mime_type: file.type,
        byte_size: file.size,
        width: checked.width,
        height: checked.height,
        duration_seconds: checked.duration,
        processing_state: "uploading",
      });
      if (mediaError) throw mediaError;
      mediaCreated = true;
      setPublishStatus("Uploading your video…");
      uploadStarted = true;
      await uploadSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, path, file);
      setPublishStatus("Checking the uploaded video…");
      const { error: readyError } = await supabase
        .from("reel_media")
        .update({ processing_state: "uploaded" })
        .eq("reel_id", id)
        .eq("object_path", path);
      if (readyError) throw readyError;
      setPublishStatus("Publishing your playable MP4…");
      const { data: published, error: publishError } = await supabase
        .from("reels")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", id)
        .eq("author_id", user.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      if (publishError) throw publishError;
      if (!published) throw new Error("The reel could not be published. No draft was updated.");
      setPublishStatus("Your reel is live.");
      setTitle("");
      setCaption("");
      setFile(null);
      if (inStudio) {
        setLegacyStudioRequested(false);
        navigate(`/reels?reel=${encodeURIComponent(id)}`);
      } else await load();
    } catch (cause) {
      const cleanupErrors: string[] = [];
      if (uploadStarted) {
        try {
          await removeSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, [path]);
        } catch (cleanupFailure) {
          cleanupErrors.push(messageFor(cleanupFailure));
        }
      }
      if (mediaCreated) {
        const { error: cleanupFailure } = await supabase
          .from("reel_media")
          .delete()
          .eq("reel_id", id);
        if (cleanupFailure) cleanupErrors.push(messageFor(cleanupFailure));
      }
      if (reelCreated) {
        const { error: cleanupFailure } = await supabase
          .from("reels")
          .delete()
          .eq("id", id)
          .eq("author_id", user.id);
        if (cleanupFailure) cleanupErrors.push(messageFor(cleanupFailure));
      }
      setPublishStatus("Your reel was not published. Check the error and retry when ready.");
      setError(
        cleanupErrors.length
          ? `${messageFor(cause)} Cleanup also failed: ${cleanupErrors.join("; ")}`
          : messageFor(cause),
      );
    } finally {
      setSaving(false);
    }
  }

  const active = items.find((reel) => reel.id === activeId) ?? null;
  const activeIndex = Math.max(
    0,
    items.findIndex((reel) => reel.id === activeId),
  );
  const revealUi = useCallback(() => {
    setUiVisible(true);
    if (uiIdleTimeout.current !== null) window.clearTimeout(uiIdleTimeout.current);
    uiIdleTimeout.current = window.setTimeout(() => setUiVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (!active || showComments || videoEnded) {
      setUiVisible(true);
      if (uiIdleTimeout.current !== null) window.clearTimeout(uiIdleTimeout.current);
      return;
    }
    revealUi();
    return () => {
      if (uiIdleTimeout.current !== null) window.clearTimeout(uiIdleTimeout.current);
    };
  }, [active?.id, revealUi, showComments, videoEnded]);

  useEffect(
    () => () => {
      if (singleTapTimeout.current !== null) window.clearTimeout(singleTapTimeout.current);
      if (heartBurstTimeout.current !== null) window.clearTimeout(heartBurstTimeout.current);
      if (uiIdleTimeout.current !== null) window.clearTimeout(uiIdleTimeout.current);
    },
    [],
  );

  const triggerHeartBurst = () => {
    setHeartBurst(true);
    if (heartBurstTimeout.current !== null) window.clearTimeout(heartBurstTimeout.current);
    heartBurstTimeout.current = window.setTimeout(() => setHeartBurst(false), 600);
    if (user && active?.allow_likes && !active.likedByMe) void toggle("like");
  };

  const handleVideoTap = () => {
    const now = Date.now();
    if (now - lastVideoTap.current < 280) {
      if (singleTapTimeout.current !== null) window.clearTimeout(singleTapTimeout.current);
      singleTapTimeout.current = null;
      lastVideoTap.current = 0;
      triggerHeartBurst();
      return;
    }
    lastVideoTap.current = now;
    singleTapTimeout.current = window.setTimeout(() => {
      const video = activeVideoRef.current;
      if (video) {
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
      }
      singleTapTimeout.current = null;
    }, 280);
  };

  useEffect(() => {
    if (previousReelIndex.current >= 0 && activeIndex !== previousReelIndex.current) {
      setSlideDirection(activeIndex > previousReelIndex.current ? "next" : "previous");
    }
    previousReelIndex.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    if (inStudio) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        if (activeIndex < items.length - 1) setActiveId(items[activeIndex + 1].id);
        else if (hasMore) void loadMore();
      } else if ((event.key === "ArrowUp" || event.key === "PageUp") && activeIndex > 0) {
        event.preventDefault();
        setActiveId(items[activeIndex - 1].id);
      } else if (event.key === "Escape") setShowComments(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, hasMore, inStudio, items, loadMore]);

  useEffect(() => {
    if (!active) {
      setLikeCount(0);
      setCommentCount(0);
      setViewCount(0);
      return;
    }
    setComments([]);
    setCommentDraft("");
    setCommentStatus("");
    setReportStatus("");
    setReplyingTo(null);
    let current = true;
    void Promise.all([
      user
        ? supabase
            .from("reel_likes")
            .select("user_id", { count: "exact", head: true })
            .eq("reel_id", active.id)
        : Promise.resolve({ count: null, error: null }),
      supabase
        .from("reel_comments")
        .select("id", { count: "exact", head: true })
        .eq("reel_id", active.id)
        .eq("is_hidden", false),
    ]).then(async ([likes, commentResult]) => {
      if (!current) return;
      const failure = likes.error || commentResult.error;
      if (failure) setError(messageFor(failure));
      else {
        setLikeCount(likes.count ?? 0);
        setCommentCount(commentResult.count ?? 0);
        if (user?.id === active.author_id) {
          const views = await supabase
            .from("reel_views")
            .select("reel_id", { count: "exact", head: true })
            .eq("reel_id", active.id);
          if (views.error) setError(messageFor(views.error));
          else setViewCount(views.count ?? 0);
        } else {
          setViewCount(0);
          if (user) {
            const { error: viewError } = await supabase.rpc("record_reel_view", {
              p_reel_id: active.id,
            });
            if (viewError) setError(messageFor(viewError));
          }
        }
        if (!current) return;
      }
    });
    return () => {
      current = false;
    };
  }, [active?.id, user?.id]);

  useEffect(() => {
    if (!active) return;
    const refreshLikeCount = () => {
      void supabase
        .from("reel_likes")
        .select("user_id", { count: "exact", head: true })
        .eq("reel_id", active.id)
        .then(({ count, error: countError }) => {
          if (countError) setError(messageFor(countError));
          else setLikeCount(count ?? 0);
        });
    };
    const refreshCommentCount = () => {
      void supabase
        .from("reel_comments")
        .select("id", { count: "exact", head: true })
        .eq("reel_id", active.id)
        .eq("is_hidden", false)
        .then(({ count, error: countError }) => {
          if (countError) setError(messageFor(countError));
          else {
            setCommentCount(count ?? 0);
            if (showComments) void loadComments();
          }
        });
    };
    const unsubscribeLike = user
      ? subscribeSocialTable("reel_likes", (change) => {
          const row = change.eventType === "DELETE" ? change.old : change.new;
          if (row.reel_id === active.id) {
            refreshLikeCount();
            if (user && row.user_id === user.id)
              setItems((current) =>
                current.map((reel) =>
                  reel.id === active.id
                    ? { ...reel, likedByMe: change.eventType !== "DELETE" }
                    : reel,
                ),
              );
          }
        })
      : () => {};
    const unsubscribeComment = subscribeSocialTable("reel_comments", (change) => {
      const row = change.eventType === "DELETE" ? change.old : change.new;
      if (row.reel_id === active.id) refreshCommentCount();
    });
    const unsubscribeCommentLike = user
      ? subscribeSocialTable("comment_likes", (change) => {
          const row = change.eventType === "DELETE" ? change.old : change.new;
          const commentId = row.reel_comment_id;
          if (typeof commentId === "string" && comments.some((comment) => comment.id === commentId))
            void loadComments();
        })
      : () => {};
    return () => {
      unsubscribeLike();
      unsubscribeComment();
      unsubscribeCommentLike();
    };
  }, [active?.id, comments, showComments, user]);

  useEffect(() => {
    let current = true;
    if (!user || !active || user.id === active.author_id) {
      setFollowStatus("none");
      return;
    }
    void supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", active.author_id)
      .maybeSingle()
      .then(({ data, error: followError }) => {
        if (!current) return;
        if (followError) setError(messageFor(followError));
        else setFollowStatus((data?.status as "pending" | "accepted") ?? "none");
      });
    return () => {
      current = false;
    };
  }, [active?.author_id, user?.id]);

  async function toggleCreatorFollow() {
    if (!user || !active || user.id === active.author_id || busy) return;
    setBusy(true);
    setError("");
    const nextStatus = active.profiles?.is_private ? "pending" : "accepted";
    const result =
      followStatus === "none"
        ? await supabase
            .from("follows")
            .upsert(
              { follower_id: user.id, following_id: active.author_id, status: nextStatus },
              { onConflict: "follower_id,following_id" },
            )
        : await supabase
            .from("follows")
            .delete()
            .eq("follower_id", user.id)
            .eq("following_id", active.author_id);
    setBusy(false);
    if (result.error) setError(friendlyError(result.error));
    else setFollowStatus(followStatus === "none" ? nextStatus : "none");
  }

  async function toggle(flag: "like" | "save") {
    if (!user || !active || busy) return;
    setBusy(true);
    setError("");
    const currentlySet = flag === "like" ? active.likedByMe : active.savedByMe;
    try {
      const result = await setSocialReaction(
        supabase,
        flag === "like" ? "reel_likes" : "reel_saves",
        { reel_id: active.id, user_id: user.id },
        currentlySet,
      );
      if (result.error) {
        setError(friendlyError(result.error));
        setBusy(false);
        return;
      }
      if (flag === "like") {
        const [likeState, countState] = await Promise.all([
          supabase
            .from("reel_likes")
            .select("reel_id")
            .eq("reel_id", active.id)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("reel_likes")
            .select("reel_id", { count: "exact", head: true })
            .eq("reel_id", active.id),
        ]);
        if (likeState.error || countState.error)
          setError(messageFor(likeState.error || countState.error));
        else {
          setLikeCount(countState.count ?? 0);
          setItems((current) =>
            current.map((reel) =>
              reel.id === active.id ? { ...reel, likedByMe: Boolean(likeState.data) } : reel,
            ),
          );
        }
      }
      if (flag === "save")
        setItems((current) =>
          current.map((reel) =>
            reel.id !== active.id
              ? reel
              : {
                  ...reel,
                  savedByMe: flag === "save" ? !currentlySet : reel.savedByMe,
                },
          ),
        );
    } catch (error) {
      setError(friendlyError(error instanceof Error ? { message: error.message } : null));
    } finally {
      setBusy(false);
    }
  }

  const loadComments = useCallback(async () => {
    if (!active) return;
    setCommentStatus("Loading the conversation…");
    const { data, error: queryError } = await supabase
      .from("reel_comments")
      .select(
        "id,author_id,parent_id,body,created_at,profiles!reel_comments_author_id_fkey(id,username,display_name,avatar_url)",
      )
      .eq("reel_id", active.id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true })
      .limit(100);
    if (queryError) {
      setError(friendlyError(queryError));
      setCommentStatus("Comments couldn’t load. Close and reopen to try again.");
      return;
    }
    const rows = (data ?? []) as unknown as Omit<
      ReelComment,
      "like_count" | "reply_count" | "liked_by_me"
    >[];
    const ids = rows.map((comment) => comment.id);
    const [counts, ownLikes] = ids.length
      ? await Promise.all([
          supabase.rpc("get_social_comment_counts", {
            p_post_comment_ids: [],
            p_reel_comment_ids: ids,
          }),
          user
            ? supabase
                .from("comment_likes")
                .select("reel_comment_id")
                .eq("user_id", user.id)
                .in("reel_comment_id", ids)
            : Promise.resolve({ data: [], error: null }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (counts.error || ownLikes.error) {
      setError(friendlyError(counts.error || ownLikes.error));
      return;
    }
    const countRows = parseSocialCommentCounts(counts.data);
    if (!countRows) {
      setError("The reel comment counts returned an invalid response. Reload and try again.");
      return;
    }
    const stats = new Map(
      countRows.filter((row) => row.target_type === "reel").map((row) => [row.comment_id, row]),
    );
    const liked = new Set((ownLikes.data ?? []).map((row) => row.reel_comment_id));
    setComments(
      rows.map((comment) => ({
        ...comment,
        like_count: Number(stats.get(comment.id)?.like_count ?? 0),
        reply_count: Number(stats.get(comment.id)?.reply_count ?? 0),
        liked_by_me: liked.has(comment.id),
      })),
    );
    setCommentStatus("");
  }, [active, user]);

  useEffect(() => {
    if (showComments) void loadComments();
  }, [loadComments, showComments]);

  async function sendComment(eventOrText: FormEvent | string, parentId?: string) {
    const body = typeof eventOrText === "string" ? eventOrText : commentDraft;
    if (typeof eventOrText !== "string") eventOrText.preventDefault();
    if (!user || !active || !active.allow_comments || !body.trim() || busy) return false;
    setBusy(true);
    const { error: insertError } = await supabase.from("reel_comments").insert({
      reel_id: active.id,
      author_id: user.id,
      parent_id: parentId ?? replyingTo?.id ?? null,
      body: body.trim(),
    });
    setBusy(false);
    if (insertError) {
      setError(friendlyError(insertError));
      return false;
    }
    setCommentDraft("");
    setReplyingTo(null);
    setCommentCount((count) => count + 1);
    await loadComments();
    return true;
  }

  async function toggleReelCommentLike(comment: ReelComment) {
    if (!user) {
      navigate("/login", { state: { from: `/reels?reel=${active?.id ?? ""}` } });
      return;
    }
    if (!active || busy) return;
    const next = !comment.liked_by_me;
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              liked_by_me: next,
              like_count: Math.max(0, item.like_count + (next ? 1 : -1)),
            }
          : item,
      ),
    );
    const result = next
      ? await supabase
          .from("comment_likes")
          .insert({ user_id: user.id, reel_comment_id: comment.id })
      : await supabase
          .from("comment_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("reel_comment_id", comment.id);
    if (result.error && result.error.code !== "23505") {
      setError(friendlyError(result.error));
      await loadComments();
      return;
    }
    const [counts, ownLike] = await Promise.all([
      supabase.rpc("get_social_comment_counts", {
        p_post_comment_ids: [],
        p_reel_comment_ids: [comment.id],
      }),
      supabase
        .from("comment_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("reel_comment_id", comment.id)
        .maybeSingle(),
    ]);
    if (counts.error || ownLike.error) {
      setError(friendlyError(counts.error || ownLike.error));
      return;
    }
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              liked_by_me: Boolean(ownLike.data),
              like_count: Number(counts.data?.[0]?.like_count ?? 0),
              reply_count: Number(counts.data?.[0]?.reply_count ?? item.reply_count),
            }
          : item,
      ),
    );
  }

  async function removeReelComment(comment: ReelComment) {
    if (
      !user ||
      comment.author_id !== user.id ||
      !window.confirm("Delete this comment and its replies?")
    )
      return;
    const { error: deleteError } = await supabase
      .from("reel_comments")
      .delete()
      .eq("id", comment.id)
      .eq("author_id", user.id);
    if (deleteError) setError(friendlyError(deleteError));
    else await loadComments();
  }

  async function reportReelComment(comment: ReelComment) {
    if (!user) return;
    setCommentStatus("");
    const { data, error: reportError } = await supabase.rpc("report_social_content", {
      p_target_type: "comment",
      p_target_id: comment.id,
      p_category: "other",
      p_reason: "",
    });
    if (reportError) setError(friendlyError(reportError));
    else {
      const result = Array.isArray(data) ? data[0] : data;
      setCommentStatus(
        result?.already_reported
          ? "You have already reported this comment."
          : "Comment reported. Thank you for helping keep VELORI safe.",
      );
    }
  }

  async function share() {
    if (!active || !active.allow_sharing) return;
    setShareOpen(true);
  }

  async function reportReel() {
    if (!user || !active || active.author_id === user.id) return;
    const { data, error: reportError } = await supabase.rpc("report_social_content", {
      p_target_type: "reel",
      p_target_id: active.id,
      p_category: "other",
      p_reason: "",
    });
    if (reportError) setError(friendlyError(reportError));
    else {
      const result = Array.isArray(data) ? data[0] : data;
      setReportStatus(
        result?.already_reported
          ? "You have already reported this reel."
          : "Reel reported. Thank you for helping keep VELORI safe.",
      );
    }
  }

  async function deleteReel() {
    if (!user || !active || active.author_id !== user.id || busy) return;
    if (!window.confirm("Delete this reel and its video? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const { data: deleted, error: deleteError } = await supabase.rpc("delete_own_reel", {
        p_reel_id: active.id,
      });
      if (deleteError) throw deleteError;
      if (!deleted) throw new Error("This Reel could not be deleted or is no longer available.");
      setShowComments(false);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("reel");
        next.delete("comment");
        return next;
      });
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <FeatureDisabled name="Reels" />;
  if (!inStudio) {
    const toFeatureComment = (comment: ReelComment): FeatureReelComment => ({
      id: comment.id,
      userId: comment.author_id,
      username: `@${comment.profiles?.username || "member"}`,
      avatarUrl: comment.profiles?.avatar_url ?? "",
      text: comment.body,
      likes: comment.like_count,
      isLiked: comment.liked_by_me,
      timestamp: new Date(comment.created_at).toLocaleDateString(),
      canDelete: Boolean(user && comment.author_id === user.id),
      canReport: Boolean(user && comment.author_id !== user.id),
    });
    const featureComments = comments
      .filter((comment) => !comment.parent_id)
      .map((comment) => ({
        ...toFeatureComment(comment),
        replies: comments.filter((reply) => reply.parent_id === comment.id).map(toFeatureComment),
      }));
    const featureReels: FeatureReel[] = items.map((reel) => {
      const isActiveReel = reel.id === active?.id;
      const videoAsset = reel.reel_media.find((asset) => asset.media_type === "video");
      return {
        id: reel.id,
        videoUrl: reel.mediaSrc,
        thumbnailUrl: reel.posterSrc,
        duration: videoAsset?.duration_seconds ?? 0,
        user: {
          id: reel.author_id,
          username: reel.profiles?.username || "creator",
          displayName: reel.profiles?.display_name || reel.profiles?.username || "VELORI creator",
          avatarUrl: reel.profiles?.avatar_url ?? "",
        },
        caption: reel.caption || reel.title || "",
        likes: isActiveReel ? likeCount : 0,
        commentCount: isActiveReel ? commentCount : 0,
        comments: isActiveReel ? featureComments : [],
        shares: 0,
        isLiked: reel.likedByMe,
        isSaved: reel.savedByMe,
        isFollowing: isActiveReel && followStatus !== "none",
        canLike: Boolean(user && reel.allow_likes),
        canComment: reel.allow_comments,
        canSave: Boolean(user),
        canShare: reel.allow_sharing,
        canFollow: Boolean(user && user.id !== reel.author_id),
        followLabel:
          isActiveReel && followStatus === "pending"
            ? "Requested"
            : isActiveReel && followStatus === "accepted"
              ? "Following"
              : "Follow",
        canReport: Boolean(user && user.id !== reel.author_id),
        canDelete: Boolean(user && user.id === reel.author_id),
      };
    });
    const activeComment = comments.find((comment) => comment.id === replyingTo?.id);

    return (
      <ReelsExperience
        reels={featureReels}
        currentIndex={activeIndex}
        commentsOpen={showComments}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadingMore={loadingMore}
        actionBusy={busy}
        onBack={() => (window.history.length > 1 ? navigate(-1) : navigate("/home"))}
        onDismiss={() =>
          hasMore ? void loadMore() : window.history.length > 1 ? navigate(-1) : navigate("/home")
        }
        onSearch={() => navigate("/search")}
        onDM={() => navigate("/messages")}
        onCreate={user ? () => navigate("/reels/create") : undefined}
        onRetry={() => void load()}
        onLoadMore={() => void loadMore()}
        onIndexChange={(index) => {
          if (index < items.length) {
            setSlideDirection(index > activeIndex ? "next" : "previous");
            setActiveId(items[index].id);
          }
        }}
        onCommentsOpenChange={setShowComments}
        onLike={(id) => {
          if (id === active?.id) void toggle("like");
        }}
        onSave={(id) => {
          if (id === active?.id) void toggle("save");
        }}
        onShare={(id) => {
          if (id === active?.id) void share();
        }}
        onFollow={(id) => {
          if (id === active?.author_id) void toggleCreatorFollow();
        }}
        onAddComment={(id, text, parentId) =>
          id === active?.id ? sendComment(text, parentId) : Promise.resolve(false)
        }
        onLikeComment={(featureComment) => {
          const comment = comments.find((item) => item.id === featureComment.id);
          if (comment) void toggleReelCommentLike(comment);
        }}
        onDeleteComment={(featureComment) => {
          const comment = comments.find((item) => item.id === featureComment.id);
          if (comment) void removeReelComment(comment);
        }}
        onReportComment={(featureComment) => {
          const comment = comments.find((item) => item.id === featureComment.id);
          if (comment) void reportReelComment(comment);
        }}
        onReply={(featureComment) => {
          const comment = comments.find((item) => item.id === featureComment.id);
          if (comment) setReplyingTo(comment);
        }}
        replyTo={activeComment ? `@${activeComment.profiles?.username || "member"}` : undefined}
        replyParentId={replyingTo?.parent_id ?? replyingTo?.id}
        onCancelReply={() => setReplyingTo(null)}
        commentStatus={commentStatus}
        shareDialog={
          shareOpen && active ? (
            <ShareToMessageDialog
              contentType="reel"
              contentId={active.id}
              onClose={() => setShareOpen(false)}
            />
          ) : null
        }
      />
    );
  }
  return (
    <div className={inStudio ? "narrow-page reel-studio-page" : "narrow-page reels-page"}>
      <PageHeading
        eyebrow={inStudio ? "REELS STUDIO" : "REELS"}
        title={inStudio ? "Create a reel" : "Reels"}
        subtitle={
          inStudio
            ? "Shape a vertical video for your community."
            : "Watch clips from your community and share your own."
        }
      />
      {!inStudio && user ? (
        <Link className="reel-create-link" to="/reels/create">
          <Plus size={17} /> Create a reel
        </Link>
      ) : null}
      {inStudio && !user ? (
        <EmptyState
          icon={Video}
          title="Share a reel"
          text="Sign in to upload and interact with reels."
          action="Sign in"
          to="/login"
        />
      ) : null}
      {!inStudio && error && (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <Button className="button button-outline" onClick={() => void load()} disabled={loading}>
            Retry
          </Button>
        </div>
      )}
      {!inStudio && loading ? (
        <RuntimeLoading label="Loading reels…" />
      ) : !inStudio && active ? (
        <m.article
          className="reel-viewer-card"
          aria-label="Reel"
          data-slide-direction={slideDirection}
          data-comments-open={showComments ? "true" : "false"}
          data-ui-hidden={!uiVisible && !showComments ? "true" : "false"}
          drag={showComments || reducedMotion ? false : "y"}
          dragControls={reelDragControls}
          dragListener={false}
          dragConstraints={REEL_DRAG_CONSTRAINTS}
          dragElastic={REEL_DRAG_ELASTIC}
          dragMomentum={false}
          animate={{ y: 0 }}
          transition={defaultSpring}
          onPointerDown={(event) => {
            revealUi();
            if (event.target instanceof Element && event.target.closest(REEL_DRAG_SKIP_SELECTOR))
              return;
            reelDragControls.start(event);
          }}
          onDragEnd={(_, info) => {
            if (showComments) return;
            const swipeUp = info.offset.y < -72 || info.velocity.y < -650;
            const swipeDown = info.offset.y > 72 || info.velocity.y > 650;
            if (info.offset.y < -150 && info.velocity.y < -1400) {
              if (window.history.length > 1) navigate(-1);
              else navigate("/home");
              return;
            }
            if (swipeUp && activeIndex < items.length - 1) {
              setActiveId(items[activeIndex + 1].id);
            } else if (swipeUp && hasMore) {
              void loadMore();
            } else if (swipeDown && activeIndex > 0) {
              setActiveId(items[activeIndex - 1].id);
            }
          }}
          onPointerMove={revealUi}
          onFocusCapture={revealUi}
          onKeyDown={revealUi}
          onWheel={(event) => {
            revealUi();
            if (event.target instanceof Element && event.target.closest(".reel-comments-sheet"))
              return;
            if (Math.abs(event.deltaY) < 24) return;
            event.preventDefault();
            if (event.deltaY > 0) {
              if (activeIndex < items.length - 1) setActiveId(items[activeIndex + 1].id);
              else if (hasMore) void loadMore();
            } else if (activeIndex > 0) setActiveId(items[activeIndex - 1].id);
          }}
        >
          <header>
            <button
              type="button"
              className="reel-back-button"
              aria-label="Back from reels"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/home"))}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <div className="reel-author">
              {active.profiles?.avatar_url ? (
                <img src={active.profiles.avatar_url} alt="" />
              ) : (
                <span>
                  <Video size={17} />
                </span>
              )}
              <div>
                <ProfileLink
                  username={active.profiles?.username}
                  aria-label={`Open ${active.profiles?.display_name || active.profiles?.username || "creator"}'s profile`}
                >
                  {active.profiles?.display_name || `@${active.profiles?.username || "creator"}`}
                </ProfileLink>
                <small>{active.title || "Reel"}</small>
              </div>
              {user && user.id !== active.author_id ? (
                <button
                  type="button"
                  className="reel-follow-button"
                  onClick={() => void toggleCreatorFollow()}
                  disabled={busy}
                >
                  {followStatus === "accepted"
                    ? "Following"
                    : followStatus === "pending"
                      ? "Requested"
                      : "Follow"}
                </button>
              ) : null}
            </div>
            <small>
              {activeIndex + 1} / {items.length}
            </small>
          </header>
          {active.mediaSrc ? (
            <>
              <AnimatePresence initial={false}>
                <m.video
                  key={active.id}
                  ref={activeVideoRef}
                  src={active.mediaSrc}
                  poster={active.posterSrc || undefined}
                  controls={false}
                  playsInline
                  muted={muted}
                  autoPlay
                  initial={
                    reducedMotion
                      ? false
                      : {
                          opacity: 0.7,
                          y: slideDirection === "next" ? "8%" : "-8%",
                        }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reducedMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 0.7,
                          y: slideDirection === "next" ? "-8%" : "8%",
                        }
                  }
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.36, ease: "easeOut" }}
                  onLoadStart={() => setVideoLoading(true)}
                  onCanPlay={() => setVideoLoading(false)}
                  onPlaying={() => {
                    setVideoLoading(false);
                    setVideoEnded(false);
                  }}
                  onLoadedMetadata={(event) => {
                    setPlaybackDuration(event.currentTarget.duration);
                    setPlaybackTime(event.currentTarget.currentTime);
                    reelProgress.set(
                      event.currentTarget.duration > 0
                        ? event.currentTarget.currentTime / event.currentTarget.duration
                        : 0,
                    );
                  }}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    setPlaybackTime(video.currentTime);
                    reelProgress.set(video.duration > 0 ? video.currentTime / video.duration : 0);
                  }}
                  onEnded={() => {
                    reelProgress.set(1);
                    if (items.length > 1) {
                      const otherReels = items.filter((reel) => reel.id !== active.id);
                      const nextReel = otherReels[Math.floor(Math.random() * otherReels.length)];
                      setActiveId(nextReel.id);
                    } else {
                      const video = activeVideoRef.current;
                      if (video) {
                        video.currentTime = 0;
                        void video.play().catch(() => {});
                      }
                    }
                  }}
                  onError={() => {
                    setVideoLoading(false);
                    setVideoFailed(true);
                  }}
                  onClick={handleVideoTap}
                />
              </AnimatePresence>
              <button
                type="button"
                className="reel-tap-play"
                aria-label="Play or pause reel"
                onClick={() => {
                  const video = activeVideoRef.current;
                  if (!video) return;
                  if (video.paused) void video.play().catch(() => {});
                  else video.pause();
                }}
              >
                <span aria-hidden="true">Ⅱ</span>
              </button>
              <div className="reel-progress-track" aria-hidden="true">
                <m.div
                  className="reel-progress-fill"
                  initial={false}
                  style={{ scaleX: progressScaleX }}
                />
              </div>
              <input
                className="reel-playback-progress"
                type="range"
                min="0"
                max={Math.max(playbackDuration, 0.1)}
                step="0.1"
                value={Math.min(playbackTime, playbackDuration || 0)}
                aria-label="Reel playback position"
                disabled={!playbackDuration}
                onChange={(event) => {
                  const time = Number(event.target.value);
                  setPlaybackTime(time);
                  if (activeVideoRef.current) {
                    activeVideoRef.current.currentTime = time;
                    reelProgress.set(
                      activeVideoRef.current.duration > 0
                        ? time / activeVideoRef.current.duration
                        : 0,
                    );
                  }
                }}
              />
              <AnimatePresence>
                {heartBurst ? (
                  <m.div
                    className="reel-heart-burst"
                    aria-hidden="true"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0 }}
                    animate={
                      reducedMotion ? { opacity: 1 } : { opacity: [0, 1, 0], scale: [0, 1.2, 1] }
                    }
                    exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={
                      reducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
                    }
                  >
                    <Heart size={92} fill="currentColor" strokeWidth={1.2} />
                  </m.div>
                ) : null}
              </AnimatePresence>
              {videoLoading && !videoFailed ? (
                <p className="reel-video-status" role="status">
                  Loading video…
                </p>
              ) : null}
              {videoFailed ? (
                <div className="reel-video-status is-error" role="alert">
                  This video could not be played.
                  <Button
                    className="button button-outline"
                    onClick={() => {
                      const video = activeVideoRef.current;
                      if (!video) return;
                      setVideoFailed(false);
                      setVideoLoading(true);
                      video.load();
                      void video.play().catch(() => setVideoFailed(true));
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
              {videoEnded ? (
                <Button
                  className="button button-outline reel-replay-button"
                  onClick={() => {
                    const video = activeVideoRef.current;
                    if (!video) return;
                    video.currentTime = 0;
                    setVideoEnded(false);
                    void video.play().catch(() => {});
                  }}
                >
                  Replay
                </Button>
              ) : null}
            </>
          ) : (
            <div className="reel-missing-media" role="status">
              This reel's video is unavailable.
            </div>
          )}
          <div className="reel-caption">
            <strong>{active.title || "Untitled reel"}</strong>
            {active.caption && <p>{active.caption}</p>}
          </div>
          {user?.id === active.author_id ? (
            <small className="muted">{viewCount.toLocaleString()} views</small>
          ) : null}
          <div className="reel-actions">
            {user && active.allow_likes && (
              <Button
                className="button button-outline"
                aria-pressed={active.likedByMe}
                disabled={busy}
                onClick={() => void toggle("like")}
              >
                <Heart size={17} fill={active.likedByMe ? "currentColor" : "none"} />
                {active.likedByMe ? "Unlike" : "Like"} · {likeCount.toLocaleString()}
              </Button>
            )}
            {likeCount > 0 ? (
              <LikeListButton target="reel" contentId={active.id} count={likeCount} />
            ) : null}
            {user && (
              <Button
                className="button button-outline"
                aria-pressed={active.savedByMe}
                disabled={busy}
                onClick={() => void toggle("save")}
              >
                <Bookmark size={17} />
                {active.savedByMe ? "Saved" : "Save"}
              </Button>
            )}
            {active.allow_sharing && (
              <Button className="button button-outline" onClick={() => void share()}>
                <Share2 size={17} />
                Share
              </Button>
            )}
            {user && active.author_id !== user.id ? (
              <Button className="button button-outline" onClick={() => void reportReel()}>
                <Flag size={17} />
                Report
              </Button>
            ) : null}
            <Button
              className="button button-outline"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Unmute reel" : "Mute reel"}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              {muted ? "Unmute" : "Mute"}
            </Button>
            {active.author_id === user?.id && (
              <Button
                className="button button-outline"
                disabled={busy}
                onClick={() => void deleteReel()}
              >
                <Trash2 size={17} />
                Delete
              </Button>
            )}
          </div>
          {reportStatus ? (
            <p className="inline-feedback" role="status">
              {reportStatus}
            </p>
          ) : null}
          <div className="reel-navigation">
            <Button
              className="button button-outline"
              onClick={() => setActiveId(items[Math.max(0, activeIndex - 1)].id)}
              disabled={activeIndex === 0}
            >
              <ArrowLeft size={16} />
              Previous
            </Button>
            <Button
              className="button button-outline"
              onClick={() => setActiveId(items[Math.min(items.length - 1, activeIndex + 1)].id)}
              disabled={activeIndex >= items.length - 1}
            >
              Next
              <ArrowRight size={16} />
            </Button>
          </div>
          {hasMore ? (
            <Button
              className="button button-outline"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading more reels…" : "Load more reels"}
            </Button>
          ) : null}
          {active.allow_comments && (
            <>
              <Button
                className="button button-outline reel-comments-trigger"
                onClick={() => {
                  setShowComments((value) => !value);
                  revealUi();
                }}
              >
                <MessageCircle size={17} />
                {showComments ? "Hide comments" : `Comments · ${commentCount.toLocaleString()}`}
              </Button>
              <AnimatePresence>
                {showComments ? (
                  <m.section
                    className="reel-comments reel-comments-sheet"
                    aria-label="Reel comments"
                    initial={reducedMotion ? false : { y: "100%" }}
                    animate={{ y: 0 }}
                    exit={reducedMotion ? { y: 0 } : { y: "100%" }}
                    transition={reducedMotion ? { duration: 0 } : heavySpring}
                    drag={reducedMotion ? false : "y"}
                    dragListener={false}
                    dragControls={commentsDragControls}
                    dragConstraints={COMMENT_SHEET_DRAG_CONSTRAINTS}
                    dragElastic={{ top: 0, bottom: 0.1 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 90 || info.velocity.y > 600) {
                        setShowComments(false);
                      }
                    }}
                  >
                    <div
                      className="reel-sheet-drag-handle"
                      onPointerDown={(event) => commentsDragControls.start(event)}
                      aria-hidden="true"
                    >
                      <span />
                    </div>
                    <div className="reel-comments-heading">
                      <h2>Comments</h2>
                      <button
                        type="button"
                        aria-label="Close comments"
                        onClick={() => setShowComments(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {commentStatus ? (
                      <p className="inline-feedback" role="status">
                        {commentStatus}
                      </p>
                    ) : null}
                    {comments.some((comment) => !comment.parent_id) ? (
                      <m.div
                        className="reel-comment-list"
                        initial={reducedMotion ? false : "hidden"}
                        animate={reducedMotion ? undefined : "visible"}
                        variants={reelCommentListStagger}
                      >
                        {comments
                          .filter((comment) => !comment.parent_id)
                          .map((comment, commentIndex) => (
                            <m.div
                              className="reel-comment-thread"
                              key={comment.id}
                              initial={reducedMotion ? false : "hidden"}
                              animate={reducedMotion ? undefined : "visible"}
                              variants={reelCommentEntrance}
                            >
                              <article className="reel-comment" id={`reel-comment-${comment.id}`}>
                                <ReelCommentIdentity comment={comment} />
                                <p>{comment.body}</p>
                                <small>{new Date(comment.created_at).toLocaleString()}</small>
                                <div className="comment-interactions">
                                  <m.button
                                    type="button"
                                    className={`comment-like-button ${comment.liked_by_me ? "is-liked" : ""}`}
                                    aria-pressed={comment.liked_by_me}
                                    onClick={() => void toggleReelCommentLike(comment)}
                                    whileTap={reducedMotion ? undefined : { scale: 1.3 }}
                                    transition={lightSpring}
                                  >
                                    <Heart
                                      size={14}
                                      fill={comment.liked_by_me ? "currentColor" : "none"}
                                    />
                                    {comment.liked_by_me ? "Unlike" : "Like"}
                                  </m.button>
                                  {comment.like_count > 0 ? (
                                    <LikeListButton
                                      target="reel_comment"
                                      contentId={comment.id}
                                      count={comment.like_count}
                                      showIcon={false}
                                    />
                                  ) : null}
                                </div>
                                {user ? (
                                  <button type="button" onClick={() => setReplyingTo(comment)}>
                                    Reply
                                  </button>
                                ) : null}
                                {user?.id === comment.author_id ? (
                                  <button
                                    type="button"
                                    onClick={() => void removeReelComment(comment)}
                                  >
                                    Delete
                                  </button>
                                ) : user ? (
                                  <button
                                    type="button"
                                    onClick={() => void reportReelComment(comment)}
                                  >
                                    Report
                                  </button>
                                ) : null}
                              </article>
                              {comments
                                .filter((reply) => reply.parent_id === comment.id)
                                .map((reply, replyIndex) => (
                                  <m.article
                                    className="reel-comment reel-comment-reply"
                                    id={`reel-comment-${reply.id}`}
                                    key={reply.id}
                                    initial={reducedMotion ? false : "hidden"}
                                    animate={reducedMotion ? undefined : "visible"}
                                    variants={reelCommentEntrance}
                                    transition={{
                                      ...(reducedMotion
                                        ? { duration: 0 }
                                        : componentEntranceTiming),
                                      delay: reducedMotion
                                        ? 0
                                        : (commentIndex + replyIndex + 1) * 0.05,
                                    }}
                                  >
                                    <ReelCommentIdentity comment={reply} />
                                    <p>{reply.body}</p>
                                    <small>{new Date(reply.created_at).toLocaleString()}</small>
                                    <div className="comment-interactions">
                                      <m.button
                                        type="button"
                                        className={`comment-like-button ${reply.liked_by_me ? "is-liked" : ""}`}
                                        aria-pressed={reply.liked_by_me}
                                        onClick={() => void toggleReelCommentLike(reply)}
                                        whileTap={reducedMotion ? undefined : { scale: 1.3 }}
                                        transition={lightSpring}
                                      >
                                        <Heart
                                          size={14}
                                          fill={reply.liked_by_me ? "currentColor" : "none"}
                                        />
                                        {reply.liked_by_me ? "Unlike" : "Like"}
                                      </m.button>
                                      {reply.like_count > 0 ? (
                                        <LikeListButton
                                          target="reel_comment"
                                          contentId={reply.id}
                                          count={reply.like_count}
                                          showIcon={false}
                                        />
                                      ) : null}
                                    </div>
                                    {user ? (
                                      <button type="button" onClick={() => setReplyingTo(reply)}>
                                        Reply
                                      </button>
                                    ) : null}
                                    {user?.id === reply.author_id ? (
                                      <button
                                        type="button"
                                        onClick={() => void removeReelComment(reply)}
                                      >
                                        Delete
                                      </button>
                                    ) : user ? (
                                      <button
                                        type="button"
                                        onClick={() => void reportReelComment(reply)}
                                      >
                                        Report
                                      </button>
                                    ) : null}
                                  </m.article>
                                ))}
                            </m.div>
                          ))}
                      </m.div>
                    ) : (
                      <p>No comments yet. Start the conversation.</p>
                    )}
                    {user && (
                      <form onSubmit={(event) => void sendComment(event)}>
                        {replyingTo ? (
                          <div className="comment-reply-context">
                            Replying to @{replyingTo.profiles?.username || "member"}
                            <button type="button" onClick={() => setReplyingTo(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : null}
                        <Textarea
                          value={commentDraft}
                          maxLength={2000}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          rows={2}
                          placeholder={replyingTo ? "Write a reply" : "Write a comment"}
                        />
                        <Button type="submit" disabled={busy || !commentDraft.trim()}>
                          <Send size={16} />
                          Comment
                        </Button>
                      </form>
                    )}
                  </m.section>
                ) : null}
              </AnimatePresence>
            </>
          )}
          {shareOpen && active ? (
            <ShareToMessageDialog
              contentType="reel"
              contentId={active.id}
              onClose={() => setShareOpen(false)}
            />
          ) : null}
        </m.article>
      ) : (
        !inStudio &&
        !error && (
          <EmptyState
            icon={Video}
            title="No reels yet"
            text="Published reels from your community will appear here."
          />
        )
      )}
    </div>
  );
}

export function ReelStudioPage() {
  const enabled = useFeatureFlag("reels_enabled", true);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (!enabled) return <FeatureDisabled name="Reels" />;
  if (loading) return <RuntimeLoading label="Checking your session…" />;
  if (!user) {
    return (
      <EmptyState
        icon={Video}
        title="Sign in to create a reel"
        text="Sign in to open the reel studio."
        action="Sign in"
        to="/login"
      />
    );
  }

  return (
    <div className="reel-studio-route">
      <ReelStudio
        userId={user.id}
        onClose={() => navigate("/reels")}
        onPublished={(reelId) => navigate(`/reels?reel=${encodeURIComponent(reelId)}`)}
      />
    </div>
  );
}

export function StoriesPage() {
  const enabled = useFeatureFlag("stories_enabled", true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { stories, loading, error, load, markViewed } = useVisibleStories(user?.id);
  const [composerMode, setComposerMode] = useState<"camera" | "gallery" | "text" | null>(() =>
    searchParams.get("create") === "1" ? "gallery" : null,
  );
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [overlayColor, setOverlayColor] = useState("#ffffff");
  const [overlayPosition, setOverlayPosition] = useState({ x: 50, y: 50 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [draggingOverlay, setDraggingOverlay] = useState(false);
  const [audience, setAudience] = useState<"public" | "followers" | "close_friends" | "private">(
    "followers",
  );
  const [writeError, setWriteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [viewerStart, setViewerStart] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const storyCanvasRef = useRef<HTMLDivElement>(null);
  const previewUrl = useObjectUrl(file);
  const groups = groupStories(stories);
  const flattened = groups.flatMap((group) => group.stories);
  const requestedStory = searchParams.get("story");
  const [unavailableStory, setUnavailableStory] = useState(false);

  useEffect(() => {
    if (!requestedStory || loading) return;
    const story = stories.find((item) => item.id === requestedStory);
    if (story) {
      setUnavailableStory(false);
      setViewerStart(story.id);
    } else {
      setUnavailableStory(true);
      setViewerStart(null);
    }
  }, [loading, requestedStory, stories]);

  function openStory(storyId: string) {
    setUnavailableStory(false);
    setViewerStart(storyId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("story", storyId);
      return next;
    });
  }

  function closeStory() {
    setViewerStart(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("story");
        return next;
      },
      { replace: true },
    );
  }

  async function createStory() {
    if (!user || saving || !composerMode || (composerMode === "text" ? !caption.trim() : !file))
      return;
    setSaving(true);
    setWriteError("");
    setPublishStatus("Preparing your story…");
    try {
      let uploadFile = file;
      let checked = file ? await validateSocialMedia(file) : null;
      if (file && checked?.kind === "image" && overlayText.trim()) {
        uploadFile = await renderStoryTextOverlay(file, overlayText, overlayColor, overlayPosition);
      }
      await publishStory({
        userId: user.id,
        file: uploadFile,
        audience,
        caption,
        onStatus: setPublishStatus,
      });
      setPublishStatus("Your story is live.");
      setComposerMode(null);
      setCaption("");
      setFile(null);
      setOverlayText("");
      setImageSize(null);
      navigate("/home");
    } catch (cause) {
      setPublishStatus("Your story was not published. Check the error and retry when ready.");
      setWriteError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const deleteOwnStory = async (story: Story) => {
    if (!user) return false;
    await removeStory(story, user.id);
    await load();
    return true;
  };

  if (!enabled) return <FeatureDisabled name="Stories" />;
  return (
    <PageWorkspace area="stories" className="stories-page">
      <section className="v-story-hub">
        <div>
          <span className="v-eyebrow">YOUR PEOPLE. RIGHT NOW.</span>
          <h1>
            Everyday, but
            <br />
            <em>never ordinary.</em>
          </h1>
          <p>A little closer to the people who make your world yours.</p>
        </div>
        <MotionSculpture />
      </section>
      {user ? (
        <p className="story-archive-link-row">
          <Link className="button" to="/stories/create">
            Open Story Studio
          </Link>
          <Link className="button button-outline" to="/stories/archive">
            Your story archive
          </Link>
        </p>
      ) : null}
      {user ? (
        <details className="story-quick-composer">
          <summary>
            Quick story update <span>+</span>
          </summary>
          <section className="story-create-panel">
            <CardHeading
              title="Create a story"
              subtitle="Expiry, replies, and reactions follow your story preferences."
            />
            {!composerMode ? (
              <div className="reel-form-actions" aria-label="Choose story type">
                <Button onClick={() => cameraInput.current?.click()}>
                  <Camera size={16} /> Camera
                </Button>
                <Button
                  className="button button-outline"
                  onClick={() => galleryInput.current?.click()}
                >
                  <ImageIcon size={16} /> Gallery
                </Button>
                <Button
                  className="button button-outline"
                  onClick={() => {
                    setComposerMode("text");
                    setFile(null);
                  }}
                >
                  <Type size={16} /> Text
                </Button>
                <input
                  ref={cameraInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  capture="environment"
                  hidden
                  aria-label="Capture story photo or video"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setOverlayText("");
                    setImageSize(null);
                    setOverlayPosition({ x: 50, y: 50 });
                    if (selected) {
                      setComposerMode("camera");
                      void validateSocialMedia(selected)
                        .then(() => setWriteError(""))
                        .catch((cause) => setWriteError(messageFor(cause)));
                    }
                    event.target.value = "";
                  }}
                />
                <input
                  ref={galleryInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  hidden
                  aria-label="Choose story from gallery"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setOverlayText("");
                    setImageSize(null);
                    setOverlayPosition({ x: 50, y: 50 });
                    if (selected) {
                      setComposerMode("gallery");
                      void validateSocialMedia(selected)
                        .then(() => setWriteError(""))
                        .catch((cause) => setWriteError(messageFor(cause)));
                    }
                    event.target.value = "";
                  }}
                />
              </div>
            ) : (
              <>
                {composerMode === "text" ? (
                  <Label>
                    Your story
                    <Textarea
                      value={caption}
                      maxLength={2000}
                      onChange={(event) => setCaption(event.target.value)}
                      rows={5}
                      placeholder="What would you like to share?"
                      autoFocus
                    />
                  </Label>
                ) : (
                  <>
                    <Label>
                      Add a caption (optional)
                      <Textarea
                        value={caption}
                        maxLength={2000}
                        onChange={(event) => setCaption(event.target.value)}
                        rows={3}
                        placeholder="Add a caption"
                      />
                    </Label>
                    <Label>
                      Photo or MP4 clip
                      <Input
                        key={file ? `${file.name}-${file.size}` : "empty"}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] ?? null;
                          setFile(selected);
                          setOverlayText("");
                          setImageSize(null);
                          setOverlayPosition({ x: 50, y: 50 });
                          if (selected) {
                            setComposerMode("gallery");
                            void validateSocialMedia(selected)
                              .then(() => setWriteError(""))
                              .catch((cause) => setWriteError(messageFor(cause)));
                          }
                        }}
                      />
                    </Label>
                  </>
                )}
                <label className="field">
                  <span>Audience</span>
                  <select
                    value={audience}
                    onChange={(event) => setAudience(event.target.value as typeof audience)}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                    <option value="close_friends">Close friends</option>
                    <option value="private">Only me</option>
                  </select>
                </label>
                {composerMode === "text" ? (
                  <div
                    className="story-upload-preview story-text-preview"
                    aria-label="Story preview"
                  >
                    {caption.trim() || "Your text story preview"}
                  </div>
                ) : previewUrl && file?.type.startsWith("video/") ? (
                  <video className="story-upload-preview" src={previewUrl} controls playsInline />
                ) : previewUrl && file?.type.startsWith("image/") ? (
                  <>
                    <div className="story-studio-canvas" aria-label="Story image canvas">
                      <div
                        ref={storyCanvasRef}
                        className="story-studio-media"
                        style={
                          imageSize
                            ? { aspectRatio: `${imageSize.width} / ${imageSize.height}` }
                            : undefined
                        }
                        onPointerMove={(event) => {
                          if (!draggingOverlay) return;
                          const bounds = event.currentTarget.getBoundingClientRect();
                          setOverlayPosition({
                            x: Math.min(
                              92,
                              Math.max(8, ((event.clientX - bounds.left) / bounds.width) * 100),
                            ),
                            y: Math.min(
                              92,
                              Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100),
                            ),
                          });
                        }}
                        onPointerUp={() => setDraggingOverlay(false)}
                        onPointerCancel={() => setDraggingOverlay(false)}
                      >
                        <img
                          src={previewUrl}
                          alt="Story image preview"
                          onLoad={(event) =>
                            setImageSize({
                              width: event.currentTarget.naturalWidth,
                              height: event.currentTarget.naturalHeight,
                            })
                          }
                        />
                        {overlayText.trim() ? (
                          <span
                            className="story-studio-overlay-text"
                            role="button"
                            tabIndex={0}
                            aria-label="Story text overlay. Drag to reposition. Use arrow keys to adjust."
                            style={{
                              left: `${overlayPosition.x}%`,
                              top: `${overlayPosition.y}%`,
                              color: overlayColor,
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              setDraggingOverlay(true);
                            }}
                            onPointerUp={() => setDraggingOverlay(false)}
                            onKeyDown={(event) => {
                              const step = event.shiftKey ? 5 : 1;
                              if (
                                !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                                  event.key,
                                )
                              )
                                return;
                              event.preventDefault();
                              setOverlayPosition((position) => ({
                                x: Math.min(
                                  92,
                                  Math.max(
                                    8,
                                    position.x +
                                      (event.key === "ArrowLeft"
                                        ? -step
                                        : event.key === "ArrowRight"
                                          ? step
                                          : 0),
                                  ),
                                ),
                                y: Math.min(
                                  92,
                                  Math.max(
                                    8,
                                    position.y +
                                      (event.key === "ArrowUp"
                                        ? -step
                                        : event.key === "ArrowDown"
                                          ? step
                                          : 0),
                                  ),
                                ),
                              }));
                            }}
                          >
                            {overlayText}
                          </span>
                        ) : (
                          <span className="story-studio-overlay-hint">
                            Your text will appear here
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="story-studio-tools">
                      <Label>
                        Image text
                        <Textarea
                          value={overlayText}
                          maxLength={180}
                          onChange={(event) => setOverlayText(event.target.value)}
                          rows={2}
                          placeholder="Add text to your image"
                        />
                      </Label>
                      <div className="story-studio-tool-row">
                        <span>Text color</span>
                        <div className="story-studio-colors" role="group" aria-label="Text color">
                          {["#ffffff", "#f7aacb", "#a8c9f5", "#dcd4fa", "#ffd875"].map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="story-studio-color"
                              aria-label={`Choose ${color} text`}
                              aria-pressed={overlayColor === color}
                              style={{ "--swatch-color": color } as React.CSSProperties}
                              onClick={() => setOverlayColor(color)}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="story-studio-reset"
                          onClick={() => setOverlayPosition({ x: 50, y: 50 })}
                        >
                          Center text
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
            {composerMode && (
              <div className="reel-form-actions">
                <Button
                  onClick={() => void createStory()}
                  disabled={
                    saving ||
                    (composerMode === "text" ? !caption.trim() : !file) ||
                    Boolean(writeError)
                  }
                >
                  {saving ? "Uploading and publishing…" : "Publish story"}
                </Button>
                <Button
                  className="button button-outline"
                  onClick={() => {
                    setComposerMode(null);
                    setCaption("");
                    setFile(null);
                    setOverlayText("");
                    setImageSize(null);
                    setWriteError("");
                    setPublishStatus("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            )}
            {publishStatus ? (
              <p role="status" aria-live="polite" className="muted">
                {publishStatus}
              </p>
            ) : null}
            <small>JPEG, PNG, WebP, or MP4 · up to 100 MB.</small>
            {writeError && (
              <p className="form-error" role="alert">
                {writeError}
              </p>
            )}
          </section>
        </details>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title="Share a story"
          text="Sign in to publish and keep track of stories you have viewed."
          action="Sign in"
          to="/login"
        />
      )}
      {error && (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <Button className="button button-outline" onClick={() => void load()} disabled={loading}>
            Retry
          </Button>
        </div>
      )}
      {unavailableStory ? (
        <div className="inline-feedback" role="status">
          <p>This story is unavailable or has expired.</p>
          <Button className="button button-outline" onClick={closeStory}>
            Back to stories
          </Button>
        </div>
      ) : null}
      {loading ? (
        <RuntimeLoading label="Loading stories…" />
      ) : groups.length ? (
        <div className="stories-list" aria-label="Active stories">
          {groups.map((group) => {
            const first = group.stories[0];
            const name = group.profile?.display_name || `@${group.profile?.username || "member"}`;
            return (
              <button
                key={group.authorId}
                type="button"
                className="story-list-card"
                data-depth-surface
                data-seen={group.stories.every((story) => story.seen)}
                onClick={() => openStory(first.id)}
              >
                {first.mediaSrc &&
                  (first.media_type === "video" ? (
                    <video src={first.mediaSrc} muted playsInline />
                  ) : (
                    <img src={first.mediaSrc} alt="" />
                  ))}
                {!first.mediaSrc && (
                  <span className="v-story-preview-text">
                    {first.caption || "A little moment."}
                  </span>
                )}
                <span className="story-list-copy">
                  <strong>{name}</strong>
                  <small>
                    {group.stories.length} {group.stories.length === 1 ? "story" : "stories"} ·
                    expires {new Date(first.expires_at).toLocaleTimeString()}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        !error && (
          <EmptyState
            icon={Sparkles}
            title="No active stories"
            text="Stories from your circle will show here. Share the first one if you like."
          />
        )
      )}
      {viewerStart && (
        <StoryViewer
          onRetryMedia={load}
          stories={flattened}
          initialId={viewerStart}
          viewerId={user?.id}
          onViewed={markViewed}
          onDelete={deleteOwnStory}
          onClose={closeStory}
        />
      )}
    </PageWorkspace>
  );
}

export function StoriesArchivePage() {
  const enabled = useFeatureFlag("stories_enabled", true);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerStart, setViewerStart] = useState<string | null>(null);
  const [missingStory, setMissingStory] = useState(false);
  const requestedStory = searchParams.get("story");

  const load = useCallback(async () => {
    if (!user) {
      setStories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: archiveError } = await supabase.rpc("archive_my_expired_stories");
      if (archiveError) throw archiveError;
      const { data, error: queryError } = await supabase
        .from("stories")
        .select(
          "id,author_id,status,audience,visual_duration_seconds,caption,media_url,media_type,allow_reactions,allow_replies,expires_at,created_at,published_at,archived_at,profiles!author_id(username,display_name,avatar_url),story_media(id,object_path,media_type,mime_type,byte_size)",
        )
        .eq("author_id", user.id)
        .eq("status", "archived")
        .not("published_at", "is", null)
        .order("archived_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      const rows = (data ?? []) as unknown as Story[];
      const paths = rows.flatMap((story) =>
        (story.story_media ?? []).map((asset) => asset.object_path).filter(Boolean),
      );
      const signed = await signSocialMedia(SOCIAL_MEDIA_BUCKETS.stories, paths);
      setStories(
        rows.map((story) => {
          const asset = story.story_media?.find((item) => item.object_path);
          return {
            ...story,
            status: "archived",
            mediaSrc: (asset && signed.get(asset.object_path)) || story.media_url || "",
            seen: true,
          };
        }),
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!requestedStory || loading) return;
    const archived = stories.find((story) => story.id === requestedStory);
    if (archived) {
      setMissingStory(false);
      setViewerStart(archived.id);
    } else {
      setMissingStory(true);
      setViewerStart(null);
    }
  }, [loading, requestedStory, stories]);

  const closeViewer = () => {
    setViewerStart(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("story");
        return next;
      },
      { replace: true },
    );
  };

  if (!enabled) return <FeatureDisabled name="Stories" />;
  if (!user) {
    return (
      <PageWorkspace area="stories" className="stories-archive-page">
        <PageHeading
          eyebrow="STORIES"
          title="Your story archive"
          subtitle="Sign in to view Stories saved to your private archive."
        />
        <EmptyState
          icon={Sparkles}
          title="Sign in to continue"
          text="Your Story archive is private to your account."
          action="Sign in"
          to="/login"
        />
      </PageWorkspace>
    );
  }

  return (
    <PageWorkspace area="stories" className="stories-archive-page">
      <Link to="/stories" className="back-link">
        <ArrowLeft size={17} /> Back to Stories
      </Link>
      <PageHeading
        eyebrow="STORIES"
        title="Your story archive"
        subtitle="Expired Stories saved for you, visible only to your account."
      />
      {error ? (
        <Problem message={error} retry={() => void load()} />
      ) : loading ? (
        <RuntimeLoading label="Loading your Story archive…" />
      ) : stories.length ? (
        <div className="stories-list" aria-label="Archived stories">
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              className="story-list-card"
              onClick={() => {
                setViewerStart(story.id);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("story", story.id);
                  return next;
                });
              }}
            >
              {story.mediaSrc && story.media_type === "video" ? (
                <video src={story.mediaSrc} muted playsInline preload="metadata" />
              ) : story.mediaSrc ? (
                <img src={story.mediaSrc} alt="" loading="lazy" />
              ) : (
                <span className="story-archive-text-preview">{story.caption.slice(0, 80)}</span>
              )}
              <span className="story-list-copy">
                <strong>
                  {story.caption || (story.media_type === "text" ? "Text Story" : "Story")}
                </strong>
                <small>
                  Archived {new Date(story.archived_at || story.expires_at).toLocaleString()}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Your archive is empty"
          text="Stories are kept here after they expire, when archive saving is enabled."
          action="Create a story"
          to="/stories?create=1"
        />
      )}
      {missingStory ? (
        <p className="inline-feedback" role="status">
          That Story is no longer in your archive.
        </p>
      ) : null}
      {viewerStart ? (
        <StoryViewer
          onRetryMedia={load}
          stories={stories}
          initialId={viewerStart}
          viewerId={user.id}
          onViewed={async () => {}}
          onDelete={async (story) => {
            await removeStory(story, user.id);
            await load();
            return true;
          }}
          onClose={closeViewer}
        />
      ) : null}
    </PageWorkspace>
  );
}
