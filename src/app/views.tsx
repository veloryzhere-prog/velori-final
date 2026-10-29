import { createUuid } from "../lib/uuid.mjs";
import { TaggedPosts } from "../components/social/TaggedPosts";
import { buildDocumentationDocument } from "../features/information/document-source.mjs";
import { VeloriLoop } from "../components/VeloriLoop";
import { informationPages } from "../features/information/catalog";
import { ProfileConnections } from "../components/ProfileConnections";
import { SponsoredCard, useAdvertisement } from "../features/campaigns/SponsoredCard";
import { setSocialReaction } from "../lib/social-reactions.mjs";
import { PostReader } from "../product/PostReader";
import { ProfileIdentity } from "../product/ProfileIdentity";
import { FeedScreen } from "../product/FeedScreen";
import { AuthScreen } from "../product/AuthScreen";
import { AuthJourney } from "../components/AuthJourney";
import { PageWorkspace } from "../components/PageWorkspace";
import { SceneHeading } from "../components/SceneHeading";
import { FeedWelcome } from "../components/FeedWelcome";
import { SettingsWorkspace } from "../components/SettingsWorkspace";
import { AuthEditorial } from "../components/AuthEditorial";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { ConnectionScene } from "../components/ConnectionScene";
import { FeedLaunchpad } from "../components/FeedLaunchpad";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  m,
  useDragControls,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bell,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Feather,
  Eye,
  EyeOff,
  Flag,
  Film,
  Heart,
  Image as ImageIcon,
  LockKeyhole,
  Monitor,
  Mail,
  MessageCircle,
  Plus,
  RotateCw,
  Share2,
  Search as SearchIcon,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { accountDestination, authRedirect } from "../lib/auth-redirect";
import { safeReturnPath } from "../lib/auth-navigation.mjs";
import { isEligibleForApkPromotions } from "../lib/apk-promotion-eligibility.mjs";
import { readForgeLandingDraft } from "../features/artifacts/forge-landing-state";
import {
  isStrongAccountPassword,
  isValidAccountEmail,
  MIN_ACCOUNT_PASSWORD_LENGTH,
  normalizeEmail,
  passwordPolicy,
} from "../lib/auth-input.mjs";
import veloriLogo from "../imports/Velori_Gradient_Wing_Logo.png";
import { useAuth } from "../lib/auth";
import { useCreatorStudioTheme } from "../lib/motion-provider";
import { fetchStudioCatalog, type StudioStickerAsset } from "../lib/studio-catalog";
import {
  LikeListButton,
  parseSocialCommentCounts,
  ProfileLink,
  ShareToMessageDialog,
  subscribeSocialTable,
} from "./social-engagement";
import { useFeatureFlag } from "../lib/feature-flags";
import { useSiteSettings } from "../lib/site-settings";
import { customHtmlDocument } from "../lib/custom-html-document";
import { signSocialMedia, SOCIAL_MEDIA_BUCKETS } from "../lib/social-media";
import { MotionList, MotionListItem } from "../lib/motion";
import {
  PROFILE_CHANGED_EVENT,
  publishProfileChange,
  type ProfileSnapshot,
} from "../lib/profile-events";
import {
  loadDraftMedia,
  optimizePostImage,
  uploadPostMedia,
  type DraftMediaRecord,
} from "../lib/post-media";
import {
  friendlyError,
  postSelection,
  supabase,
  type Post,
  type PostMedia,
  type Profile,
} from "../lib/supabase";
import { EmptyState, NotFound, Problem } from "./shell";
import { Button, CardHeading, Input, Label, Textarea } from "./admin-primitives";
import { Dialog } from "../components/ui";
import "../components/social/post-comments.css";
import { ProfilePostGrid } from "../components/social/ProfilePostGrid";
import { StoryTray } from "./social-media-pages";
import { CmsPublicPage, type PublishedCmsPage } from "./cms-public-page";
import {
  cachedPublishedCmsPage,
  loadPublishedCmsPage,
  normalizeCmsRoute,
  type PublishedCmsPageResult,
} from "../lib/published-cms-pages";
import { PostPreview } from "../components/post-editor/Preview";
import { PostEditorCanvas } from "../components/post-editor/Canvas";
import { LayersPanel, type LayersPanelProps } from "../components/post-editor/LayersPanel";
import { CollaborationPanel } from "../components/post-editor/CollaborationPanel";
import { BrandTemplates } from "../components/post-editor/BrandTemplates";
import StudioShell from "../components/studios/StudioShell";
import ToolsTab from "../components/studios/left-panel/ToolsTab";
import MediaTab from "../components/studios/left-panel/MediaTab";
import TemplatesTab from "../components/studios/left-panel/TemplatesTab";
import BrandTab, { type StudioBrandKit } from "../components/studios/left-panel/BrandTab";
import PreviewPanel from "../components/studios/right-panel/PreviewPanel";
import TextProperties from "../components/studios/right-panel/TextProperties";
import LayerProperties from "../components/studios/right-panel/LayerProperties";
import type {
  PostEditorLayer,
  PostEditorSlide,
  PostEditorAspectRatio,
} from "../../types/post-editor";
import { PostMediaGallery as InteractivePostMediaGallery } from "../components/social/PostMediaGallery";
import { sendPostDraftCursor, type PostDraftChannel } from "../lib/post-editor/collab";
import { normalizePostCanvasLayers } from "../lib/post-editor/draft-scene.mjs";
import {
  BRAND_STORAGE_KEY,
  createTemplateCatalog,
  pushHistory,
} from "../lib/post-editor/brand-templates.mjs";

const PAGE_SIZE = 12;
const noPostMedia: PostMedia[] = [];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

function loadStudioBrandKit(): StudioBrandKit {
  try {
    const stored = localStorage.getItem(BRAND_STORAGE_KEY);
    if (!stored) return { colors: [], fonts: [] };
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return { colors: [], fonts: [] };
    const colorsValue = Reflect.get(value, "colors");
    const fontsValue = Reflect.get(value, "fonts");
    const logoUrl = Reflect.get(value, "logoUrl");
    const name = Reflect.get(value, "name");
    return {
      colors: Array.isArray(colorsValue)
        ? colorsValue
            .filter((color): color is string => typeof color === "string")
            .slice(0, 5)
            .map((hex, index) => ({ name: `Brand ${index + 1}`, hex }))
        : [],
      fonts: Array.isArray(fontsValue)
        ? fontsValue
            .filter((font): font is string => typeof font === "string")
            .slice(0, 2)
            .map((font) => ({ name: font }))
        : [],
      logoUrl: typeof logoUrl === "string" ? logoUrl : null,
      logoName: typeof name === "string" ? `${name} logo` : "Brand logo",
    };
  } catch {
    return { colors: [], fonts: [] };
  }
}

type PostEngagementCount = {
  post_id: string;
  like_count: number | string | null;
  comment_count: number | string;
};

function parsePostEngagementCounts(data: unknown): PostEngagementCount[] | null {
  if (!Array.isArray(data)) return null;
  const rows: PostEngagementCount[] = [];
  for (const value of data) {
    if (!value || typeof value !== "object") return null;
    const postId: unknown = Reflect.get(value, "post_id");
    const likeCount: unknown = Reflect.get(value, "like_count");
    const commentCount: unknown = Reflect.get(value, "comment_count");
    if (
      typeof postId !== "string" ||
      (likeCount !== null && typeof likeCount !== "number" && typeof likeCount !== "string") ||
      (likeCount !== null && !Number.isFinite(Number(likeCount))) ||
      (typeof commentCount !== "number" && typeof commentCount !== "string") ||
      !Number.isFinite(Number(commentCount))
    ) {
      return null;
    }
    rows.push({ post_id: postId, like_count: likeCount, comment_count: commentCount });
  }
  return rows;
}

function requestFailureDetails(label: string, error: unknown): string {
  if (!error || typeof error !== "object") return `${label}\n${String(error)}`;
  const fields = ["code", "message", "details", "hint"].flatMap((key) => {
    const value = Reflect.get(error, key);
    return typeof value === "string" && value.trim() ? [`${key}: ${value}`] : [];
  });
  return fields.length ? `${label}\n${fields.join("\n")}` : `${label}\nNo error details returned.`;
}

async function addPostEngagementCounts(posts: Post[], viewerId?: string) {
  if (posts.length === 0) return posts;
  const ids = posts.map((post) => post.id);
  const [countResult, likeResult, saveResult] = await Promise.all([
    supabase.rpc("get_post_engagement_counts", { p_post_ids: ids }),
    viewerId
      ? supabase.from("likes").select("post_id").eq("user_id", viewerId).in("post_id", ids)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? supabase.from("saves").select("post_id").eq("user_id", viewerId).in("post_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (countResult.error || likeResult.error || saveResult.error)
    throw countResult.error || likeResult.error || saveResult.error;
  const countRows = parsePostEngagementCounts(countResult.data);
  if (!countRows) throw new Error("The post engagement counts returned an invalid response.");
  const counts = new Map(countRows.map((row) => [row.post_id, row]));
  const liked = new Set((likeResult.data ?? []).map((row) => row.post_id));
  const saved = new Set((saveResult.data ?? []).map((row) => row.post_id));
  return posts.map((post) => {
    const count = counts.get(post.id);
    return {
      ...post,
      like_count: count?.like_count === null ? null : Number(count?.like_count ?? 0),
      comment_count: Number(count?.comment_count ?? 0),
      liked_by_me: liked.has(post.id),
      saved_by_me: saved.has(post.id),
    };
  });
}

async function createAvatarImage(file: File, zoom: number, rotation: number) {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image editor is unavailable in this browser.");
  const scale = Math.max(size / image.width, size / image.height) * zoom;
  context.translate(size / 2, size / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not prepare this image."))),
      "image/webp",
      0.86,
    );
  });
  if (blob.size > 5 * 1024 * 1024) throw new Error("The optimized profile photo is too large.");
  return blob;
}

function relativeDate(value: string) {
  const date = new Date(value);
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g).map((part, i) =>
        part.startsWith("#") ? (
          <Link
            key={i}
            to={`/hashtags/${encodeURIComponent(part.slice(1))}`}
            className="inline-link"
          >
            {part}
          </Link>
        ) : part.startsWith("@") ? (
          <Link
            key={i}
            to={`/profile/${encodeURIComponent(part.slice(1))}`}
            className="inline-link"
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}

function PostMediaGallery({ media }: { media: PostMedia[] }) {
  return <InteractivePostMediaGallery media={media} />;
}

function AnimatedProfileStat({ value }: { value: number }) {
  const reducedMotion = useInterfaceMotion().reduced;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setCount(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: setCount,
    });
    return () => controls.stop();
  }, [reducedMotion, value]);

  return <>{Math.round(count).toLocaleString()}</>;
}

function PostCard({ post }: { post: Post; onChange?: () => void }) {
  const reactionPending = useRef(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useInterfaceMotion().reduced;
  const [author, setAuthor] = useState(post.profiles);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const [liked, setLiked] = useState(
    () => post.liked_by_me ?? Boolean(post.likes?.some((item) => item.user_id === user?.id)),
  );
  const [saved, setSaved] = useState(
    () => post.saved_by_me ?? Boolean(post.saves?.some((item) => item.user_id === user?.id)),
  );
  const [likeCount, setLikeCount] = useState(post.like_count ?? post.likes?.length ?? 0);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const ownsPost = post.author_id === user?.id;

  useEffect(() => {
    setAuthor(post.profiles);
    setLiked(post.liked_by_me ?? Boolean(post.likes?.some((item) => item.user_id === user?.id)));
    setSaved(post.saved_by_me ?? Boolean(post.saves?.some((item) => item.user_id === user?.id)));
    setLikeCount(post.like_count ?? post.likes?.length ?? 0);
    setCommentCount(post.comment_count ?? 0);
  }, [
    post.profiles,
    post.likes,
    post.saves,
    post.like_count,
    post.comment_count,
    post.liked_by_me,
    post.saved_by_me,
    user?.id,
  ]);
  useEffect(
    () =>
      subscribeSocialTable("likes", (change) => {
        const record = change.eventType === "DELETE" ? change.old : change.new;
        if (record.post_id !== post.id) return;
        if (user && record.user_id === user.id) setLiked(change.eventType !== "DELETE");
        void supabase
          .from("likes")
          .select("user_id", { count: "exact", head: true })
          .eq("post_id", post.id)
          .then(({ count, error: countError }) => {
            if (countError) setActionMessage(friendlyError(countError));
            else setLikeCount(count ?? 0);
          });
      }),
    [post.id, user],
  );
  useEffect(
    () =>
      subscribeSocialTable("comments", (change) => {
        const row = change.eventType === "DELETE" ? change.old : change.new;
        if (row.post_id !== post.id) return;
        void supabase
          .rpc("get_post_engagement_counts", { p_post_ids: [post.id] })
          .then(({ data, error: countError }) => {
            if (countError) setActionMessage(friendlyError(countError));
            else setCommentCount(Number(data?.[0]?.comment_count ?? 0));
          });
      }),
    [post.id],
  );
  useEffect(() => {
    const updateAuthor = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (changed?.id !== post.author_id) return;
      setAuthor((current) =>
        current
          ? {
              ...current,
              username: changed.username,
              display_name: changed.display_name || "",
              avatar_url: changed.avatar_url,
            }
          : current,
      );
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateAuthor);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateAuthor);
  }, [post.author_id]);

  async function toggle(table: "likes" | "saves", active: boolean) {
    if (reactionPending.current) return;
    if (!user) {
      navigate("/login");
      return;
    }
    reactionPending.current = true;
    setBusy(true);
    const nextActive = !active;
    if (table === "likes") {
      setLiked(nextActive);
      setLikeCount((count) => Math.max(0, count + (nextActive ? 1 : -1)));
    } else setSaved(nextActive);
    try {
      const result = await setSocialReaction(
        supabase,
        table,
        { post_id: post.id, user_id: user.id },
        active,
      );
      if (result.error) {
        setActionMessage(friendlyError(result.error));
        if (table === "likes") {
          setLiked(active);
          setLikeCount((count) => Math.max(0, count + (active ? 1 : -1)));
        } else setSaved(active);
        setBusy(false);
        return;
      }
      if (table === "likes") {
        const [currentLike, countResult] = await Promise.all([
          supabase
            .from("likes")
            .select("user_id")
            .eq("post_id", post.id)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("likes")
            .select("user_id", { count: "exact", head: true })
            .eq("post_id", post.id),
        ]);
        if (currentLike.error || countResult.error)
          setActionMessage(friendlyError(currentLike.error ?? countResult.error));
        else {
          setLiked(Boolean(currentLike.data));
          setLikeCount(countResult.count ?? 0);
          setActionMessage("");
        }
      } else setActionMessage("");
    } catch (error) {
      setActionMessage(friendlyError(error instanceof Error ? { message: error.message } : null));
      if (table === "likes") {
        setLiked(active);
        setLikeCount((count) => Math.max(0, count + (active ? 1 : -1)));
      } else setSaved(active);
    } finally {
      reactionPending.current = false;
      setBusy(false);
    }
  }

  async function reportPost() {
    if (!user || ownsPost) return;
    const { data, error: reportError } = await supabase.rpc("report_social_content", {
      p_target_type: "post",
      p_target_id: post.id,
      p_category: "other",
      p_reason: "",
    });
    if (reportError) setActionMessage(friendlyError(reportError));
    else {
      const result = Array.isArray(data) ? data[0] : data;
      setActionMessage(
        result?.already_reported
          ? "You have already reported this post."
          : "Post reported. Thank you for helping keep VELORI safe.",
      );
    }
  }

  // The count renders in exactly one place: the "who liked this" chip when it
  // is available, otherwise the like button itself (signed-out viewers, zero
  // counts, hidden counts). It used to render in both places at once.
  const showLikeCountChip = Boolean(user) && likeCount > 0 && !(post.hide_like_count && !ownsPost);

  return (
    <article className="post-card">
      <div className="post-header">
        <ProfileLink className="avatar avatar-pink" username={author.username}>
          {author.avatar_url ? (
            <img src={author.avatar_url} alt="" />
          ) : (
            author.display_name?.charAt(0).toUpperCase() || author.username.charAt(0).toUpperCase()
          )}
        </ProfileLink>
        <div className="post-author">
          <ProfileLink username={author.username}>
            {author.display_name || author.username}
          </ProfileLink>
          <span>
            @{author.username} <span className="dot-sep">·</span>{" "}
            <Link to={`/post/${post.id}`}>{relativeDate(post.created_at)}</Link>
          </span>
        </div>
        <Link className="post-more" to={`/post/${post.id}`} aria-label="Open post">
          <ArrowRight size={18} />
        </Link>
      </div>
      <div
        className="post-media-stage"
        onDoubleClick={() => {
          if (post.allow_likes === false) return;
          if (!liked) void toggle("likes", false);
          if (user && !reducedMotion) setLikeBurst(true);
        }}
      >
        <PostMediaGallery media={post.post_media || noPostMedia} />
        {likeBurst && (
          <m.span
            className="post-doubletap-heart"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.15, 1] }}
            transition={{ duration: 0.32 }}
            onAnimationComplete={() => setLikeBurst(false)}
          >
            <Heart size={72} fill="currentColor" />
          </m.span>
        )}
      </div>
      <div className="post-actions">
        <m.button
          disabled={busy || (post.allow_likes === false && !liked)}
          className={`post-action ${liked ? "is-liked" : ""}`}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          onClick={() => void toggle("likes", liked)}
          whileTap={reducedMotion ? undefined : { scale: 0.9 }}
          transition={
            reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
          }
        >
          <m.span
            className="post-action-icon"
            aria-hidden="true"
            animate={reducedMotion ? undefined : { scale: liked ? [1, 1.35, 1] : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Heart size={19} />
            <m.span
              className="post-action-icon-fill"
              animate={
                reducedMotion ? undefined : { opacity: liked ? 1 : 0, scale: liked ? 1 : 0.65 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              aria-hidden="true"
            >
              <Heart size={19} fill="currentColor" />
            </m.span>
          </m.span>
          <span>
            {showLikeCountChip || (post.hide_like_count && !ownsPost)
              ? liked
                ? "Liked"
                : "Like"
              : likeCount || "Like"}
          </span>
        </m.button>
        {showLikeCountChip ? (
          <LikeListButton
            target="post"
            contentId={post.id}
            count={likeCount}
            className="post-like-count"
            label={likeCount.toLocaleString()}
            showIcon={false}
          />
        ) : null}
        <button
          type="button"
          className="post-action"
          aria-haspopup="dialog"
          aria-label={`Open comments, ${commentCount.toLocaleString()} replies`}
          onClick={() => setCommentsOpen(true)}
        >
          <MessageCircle size={19} />
          <span>
            {post.allow_comments === false
              ? "Comments off"
              : `Comments · ${commentCount.toLocaleString()}`}
          </span>
        </button>
        <m.button
          disabled={busy}
          className={`post-action ${saved ? "is-saved" : ""}`}
          aria-label={saved ? "Remove saved post" : "Save post"}
          aria-pressed={saved}
          onClick={() => void toggle("saves", saved)}
          whileTap={reducedMotion ? undefined : { scale: 0.9 }}
          transition={
            reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
          }
        >
          <m.span
            className="post-action-icon"
            aria-hidden="true"
            animate={reducedMotion ? undefined : { rotate: saved ? [0, -12, 0] : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Bookmark size={19} />
            <m.span
              className="post-action-icon-fill"
              animate={
                reducedMotion ? undefined : { opacity: saved ? 1 : 0, scale: saved ? 1 : 0.65 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              aria-hidden="true"
            >
              <Bookmark size={19} fill="currentColor" />
            </m.span>
          </m.span>
          <span>{saved ? "Saved" : "Save"}</span>
        </m.button>
        <button
          type="button"
          className="post-action share-action"
          aria-label="Share post"
          disabled={post.allow_sharing === false}
          onClick={() => setShareOpen(true)}
        >
          <Send size={18} />
          <span>Share</span>
        </button>
        {user && !ownsPost ? (
          <button
            type="button"
            className="post-action"
            aria-label="Report post"
            onClick={() => void reportPost()}
          >
            <Flag size={18} />
            <span>Report</span>
          </button>
        ) : null}
      </div>
      <div
        className={`post-body ${post.body.length > 320 && !captionExpanded ? "post-body-clamped" : ""}`}
      >
        <RichText text={post.body} />
        {post.body.length > 320 && (
          <button
            className="post-caption-toggle"
            type="button"
            aria-expanded={captionExpanded}
            onClick={() => setCaptionExpanded((value) => !value)}
          >
            {captionExpanded ? "less" : "more"}
          </button>
        )}
      </div>
      {actionMessage ? (
        <p className="inline-feedback" role="status" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}
      {shareOpen ? (
        <ShareToMessageDialog
          contentType="post"
          contentId={post.id}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {commentsOpen ? (
        <Dialog
          open
          title="Comments"
          className="v32-post-comments"
          onClose={() => setCommentsOpen(false)}
        >
          <PostDetail postId={post.id} commentsOnly />
        </Dialog>
      ) : null}
    </article>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return <SceneHeading eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />;
}

type SuggestedProfile = Profile & {
  follow_status: "none" | "pending" | "accepted";
};

function SuggestedPeopleRail({ posts }: { posts: Post[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const match of post.body.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
        const tag = match[1].toLowerCase();
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [posts]);

  const loadSuggestions = useCallback(async () => {
    if (!user) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const [followResult, profileResult, dismissedResult] = await Promise.all([
      supabase.from("follows").select("following_id,status").eq("follower_id", user.id),
      supabase.rpc("profile_search", { p_query: "", p_limit: 40 }),
      supabase
        .from("suggestion_dismissals")
        .select("suggested_profile_id")
        .eq("profile_id", user.id),
    ]);

    if (followResult.error || profileResult.error || dismissedResult.error) {
      setSuggestions([]);
      setError("Suggestions couldn't be loaded.");
      setLoading(false);
      return;
    }

    const currentRelationships = new Map<string, "pending" | "accepted">(
      (followResult.data ?? [])
        .filter((row): row is { following_id: string; status: "pending" | "accepted" } => {
          return (
            typeof row?.following_id === "string" &&
            (row.status === "pending" || row.status === "accepted")
          );
        })
        .map((row) => [row.following_id, row.status]),
    );
    const dismissed = new Set((dismissedResult.data ?? []).map((row) => row.suggested_profile_id));

    const next: SuggestedProfile[] = ((profileResult.data ?? []) as Profile[])
      .filter(
        (profile) =>
          profile.id !== user.id &&
          !currentRelationships.has(profile.id) &&
          !dismissed.has(profile.id),
      )
      .slice(0, 6)
      .map((profile) => ({
        ...profile,
        bio: profile.bio || "",
        follow_status: "none",
      }));

    setSuggestions(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  async function toggleFollow(profile: SuggestedProfile) {
    if (!user) {
      navigate("/login");
      return;
    }

    setBusyId(profile.id);
    setError("");
    const existingStatus = profile.follow_status;
    const shouldFollow = existingStatus === "none";

    try {
      if (shouldFollow) {
        const { error } = await supabase.from("follows").upsert(
          {
            follower_id: user.id,
            following_id: profile.id,
            status: profile.is_private ? "pending" : "accepted",
          },
          { onConflict: "follower_id,following_id" },
        );

        if (error) throw error;

        setSuggestions((current) =>
          current.map((item) =>
            item.id === profile.id
              ? {
                  ...item,
                  follow_status: profile.is_private ? "pending" : "accepted",
                }
              : item,
          ),
        );
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);

        if (error) throw error;

        setSuggestions((current) =>
          current.map((item) =>
            item.id === profile.id
              ? {
                  ...item,
                  follow_status: "none",
                }
              : item,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to update follow relationship:", error);
      setError(friendlyError(error as { code?: string; message?: string }));
    } finally {
      setBusyId(null);
    }
  }

  async function dismissSuggestion(profile: SuggestedProfile) {
    if (!user || busyId) return;
    setBusyId(profile.id);
    setError("");
    const { error: dismissError } = await supabase.from("suggestion_dismissals").insert({
      profile_id: user.id,
      suggested_profile_id: profile.id,
    });
    if (dismissError) setError(friendlyError(dismissError));
    else setSuggestions((current) => current.filter((item) => item.id !== profile.id));
    setBusyId(null);
  }

  if (!user) return null;

  return (
    <aside className="people-rail" aria-label="Community sidebar">
      <div className="people-rail-card">
        <div className="people-rail-header">
          <div className="people-rail-title">
            <Compass size={15} aria-hidden="true" />
            <span>Suggested</span>
          </div>
          <Link to="/people">See all</Link>
        </div>

        {error ? (
          <p className="muted people-empty" role="alert">
            {error}{" "}
            <button type="button" className="link-button" onClick={() => void loadSuggestions()}>
              Retry
            </button>
          </p>
        ) : null}

        {loading ? (
          <div className="people-skeleton" aria-label="Loading suggested people">
            <div className="people-skeleton-line" />
            <div className="people-skeleton-line" />
            <div className="people-skeleton-line" />
          </div>
        ) : suggestions.length ? (
          <div className="people-list">
            {suggestions.map((profile) => {
              const isPending = profile.follow_status === "pending";
              const isFollowing = profile.follow_status === "accepted";
              const buttonLabel = isFollowing ? "Following" : isPending ? "Requested" : "Follow";

              return (
                <div key={profile.id} className="suggested-profile">
                  <Link
                    to={`/profile/${encodeURIComponent(profile.username)}`}
                    className="suggested-avatar"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      <span>
                        {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Link>
                  <div className="suggested-meta">
                    <Link
                      to={`/profile/${encodeURIComponent(profile.username)}`}
                      className="suggested-name"
                    >
                      {profile.display_name || profile.username}
                    </Link>
                    <span>@{profile.username}</span>
                  </div>
                  <button
                    className={`button ${isFollowing ? "button-outline" : "button-primary"}`}
                    type="button"
                    disabled={busyId === profile.id}
                    onClick={() => void toggleFollow(profile)}
                    aria-label={
                      isFollowing
                        ? `Unfollow ${profile.username}`
                        : isPending
                          ? `Cancel follow request to ${profile.username}`
                          : `Follow ${profile.username}`
                    }
                  >
                    {busyId === profile.id ? "Please wait…" : buttonLabel}
                  </button>
                  <button
                    className="suggested-dismiss"
                    type="button"
                    aria-label={`Dismiss suggestion for ${profile.display_name || profile.username}`}
                    title="Dismiss suggestion"
                    disabled={busyId === profile.id}
                    onClick={() => void dismissSuggestion(profile)}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted people-empty">
            You’re all caught up. More people will show up here soon.
          </p>
        )}
      </div>
      <div className="people-rail-card feed-trending-card">
        <div className="people-rail-header">
          <div className="people-rail-title">
            <Compass size={15} aria-hidden="true" />
            <span>Trending</span>
          </div>
          <Link to="/explore">Explore</Link>
        </div>
        {trendingTags.length ? (
          trendingTags.map(([tag, count]) => (
            <Link
              className="feed-trending-row"
              to={`/hashtags/${encodeURIComponent(tag)}`}
              key={tag}
            >
              <span>
                <strong>#{tag}</strong>
                <small>
                  {count} {count === 1 ? "post" : "posts"}
                </small>
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ))
        ) : (
          <p className="muted people-empty">Hashtags from public conversations will appear here.</p>
        )}
      </div>
    </aside>
  );
}

export function Feed() {
  const { user, loading: authLoading } = useAuth();
  const reducedMotion = useInterfaceMotion().reduced;
  const [posts, setPosts] = useState<Post[]>([]);
  const [ownProfile, setOwnProfile] = useState<Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url"
  > | null>(null);
  const [error, setError] = useState("");
  const [errorCursor, setErrorCursor] = useState<Post | undefined>();
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const loadingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (cursor?: Post) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError("");
      setErrorCursor(undefined);
      try {
        let request = supabase
          .from("posts")
          .select(postSelection)
          .in("visibility", ["public", "followers"])
          .eq("is_published", true)
          .is("archived_at", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);
        if (cursor)
          request = request.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
          );
        const { data, error: dbError } = await request;
        if (dbError) {
          setError(friendlyError(dbError));
          setErrorCursor(cursor);
          return;
        }
        try {
          const result = await addPostEngagementCounts((data ?? []) as unknown as Post[], user?.id);
          setPosts((prev) => (cursor ? [...prev, ...result] : result));
          setMore(result.length === PAGE_SIZE);
        } catch (cause) {
          setError(friendlyError(cause as { code?: string; message?: string }));
          setErrorCursor(cursor);
        }
      } catch (cause) {
        setError(friendlyError(cause as { code?: string; message?: string }));
        setErrorCursor(cursor);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [user?.id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const applyProfileChange = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (changed?.id === user?.id) {
        setOwnProfile({ ...changed, display_name: changed.display_name || "" });
      }
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
    if (!user) {
      setOwnProfile(null);
      return () => {
        active = false;
        window.removeEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
      };
    }
    void supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setOwnProfile((data as typeof ownProfile) ?? null);
      });
    return () => {
      active = false;
      window.removeEventListener(PROFILE_CHANGED_EVENT, applyProfileChange);
    };
  }, [user]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !target ||
      !more ||
      loading ||
      error ||
      !posts.length ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingRef.current) {
          void load(posts[posts.length - 1]);
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [error, load, loading, more, posts]);

  return (
    <FeedScreen
      name={ownProfile?.display_name || ownProfile?.username}
      avatar={ownProfile?.avatar_url}
      stories={<StoryTray />}
      loading={loading}
      refresh={() => void load()}
      recommendations={<SuggestedPeopleRail posts={posts} />}
    >
      {loading && posts.length === 0 ? (
        <div className="feed-skeleton-stack" aria-label="Loading posts">
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </div>
      ) : error && posts.length === 0 ? (
        <Problem message={error} retry={() => void load()} />
      ) : posts.length ? (
        <>
          <div className="feed-post-list" role="list">
            {posts.map((post, index) => (
              <m.div
                key={post.id}
                role="listitem"
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.3,
                        delay: (index % PAGE_SIZE) * 0.05,
                        ease: "easeOut",
                      }
                }
              >
                <PostCard post={post} onChange={() => void load()} />
                {posts[0]?.id === post.id ? <AdSpot placement="feed" /> : null}
              </m.div>
            ))}
          </div>
          {error ? <Problem message={error} retry={() => void load(errorCursor)} /> : null}
          {loading ? (
            <div className="feed-skeleton-stack" aria-label="Loading more posts">
              <FeedPostSkeleton />
            </div>
          ) : null}
          {more && (
            <>
              <div ref={loadMoreRef} className="feed-load-more-sentinel" aria-hidden="true" />
              <button
                className="button button-outline load-more"
                onClick={() => void load(posts[posts.length - 1])}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </>
          )}
        </>
      ) : (
        <EmptyState
          icon={Feather}
          title="The conversation starts here"
          text="No public posts yet. When someone shares a public post, it will appear here."
          action={user ? "Write the first post" : "Join the conversation"}
          to={user ? "/create" : "/signup"}
        />
      )}
    </FeedScreen>
  );
}

function FeedPostSkeleton() {
  const reducedMotion = useInterfaceMotion().reduced;
  return (
    <div className="feed-post-skeleton" aria-hidden="true">
      <m.span
        className="feed-skeleton-shimmer"
        animate={reducedMotion ? undefined : { x: ["-100%", "220%"] }}
        transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
      />
      <div className="feed-skeleton-header">
        <span className="feed-skeleton-avatar" />
        <span className="feed-skeleton-author" />
      </div>
      <span className="feed-skeleton-media" />
      <div className="feed-skeleton-actions">
        <span />
        <span />
        <span />
      </div>
      <span className="feed-skeleton-line" />
      <span className="feed-skeleton-line is-short" />
    </div>
  );
}

export function Explore() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    let active = true;
    void supabase
      .from("posts")
      .select(postSelection)
      .eq("is_published", true)
      .is("archived_at", null)
      .is("deleted_at", null)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(18)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setPostsError(friendlyError(error));
        else setPosts((data ?? []) as unknown as Post[]);
        setLoadingPosts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const match of post.body.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
        const tag = match[1].toLowerCase();
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [posts]);

  return (
    <PageWorkspace area="discover" className="explore-page">
      <PageHeading
        eyebrow="EXPLORE"
        title="Explore VELORI"
        subtitle="Find real conversations, creators, and moments from the community."
        action={<Compass className="heading-icon" size={30} />}
      />
      <Link to="/search" className="explore-search-link">
        <SearchIcon size={19} aria-hidden="true" />
        <span>Search people, posts, and hashtags</span>
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
      <div className="explore-layout">
        <section
          className="explore-discover"
          aria-label="Explore community posts"
          aria-busy={loadingPosts}
        >
          <div className="explore-topic-tabs" aria-label="Explore categories">
            <Link className="is-active" to="/explore">
              For you
            </Link>
            <Link to="/search?tab=people">People</Link>
            <Link to="/reels">Reels</Link>
            <Link to="/groups">Groups</Link>
            <Link to="/search?tab=hashtags">Topics</Link>
          </div>
          {postsError ? (
            <Problem message={postsError} />
          ) : loadingPosts ? (
            <MotionList className="explore-post-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <MotionListItem key={index}>
                  <div className="explore-post-skeleton" aria-label="Loading post" />
                </MotionListItem>
              ))}
            </MotionList>
          ) : posts.length ? (
            <MotionList className="explore-post-grid">
              {posts.map((post) => (
                <MotionListItem key={post.id}>
                  <article className="explore-post-card">
                    {post.post_media?.length ? (
                      <div className="explore-post-media">
                        <PostMediaGallery media={post.post_media} />
                      </div>
                    ) : (
                      <Link className="explore-text-tile" to={`/post/${post.id}`}>
                        <MessageCircle size={19} aria-hidden="true" />
                        <span>{post.body}</span>
                      </Link>
                    )}
                    <div className="explore-post-meta">
                      <Link to={`/post/${post.id}`} aria-label="Open this post">
                        <strong>
                          {post.profiles?.display_name ||
                            (post.profiles?.username
                              ? `@${post.profiles.username}`
                              : "Community post")}
                        </strong>
                        <span>{post.body}</span>
                      </Link>
                    </div>
                  </article>
                </MotionListItem>
              ))}
            </MotionList>
          ) : (
            <EmptyState
              icon={Compass}
              title="Nothing to explore yet"
              text="Public posts from the community will appear here when they are shared."
              action="Search people"
              to="/search?tab=people"
            />
          )}
        </section>
        <aside className="explore-trending" aria-label="Trending topics">
          <div className="explore-trending-card">
            <div className="explore-trending-heading">
              <span className="page-heading-eyebrow">COMMUNITY</span>
              <h2>Trending</h2>
            </div>
            {trendingTags.length ? (
              trendingTags.map(([tag, count], index) => (
                <Link
                  className="explore-trending-row"
                  to={`/hashtags/${encodeURIComponent(tag)}`}
                  key={tag}
                >
                  <span className="explore-trending-rank">0{index + 1}</span>
                  <span>
                    <strong>#{tag}</strong>
                    <small>
                      {count} {count === 1 ? "post" : "posts"}
                    </small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <p className="explore-trending-empty">
                Topics appear here when people use hashtags in public posts.
              </p>
            )}
            <Link className="explore-trending-all" to="/search?tab=hashtags">
              Explore topics <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </PageWorkspace>
  );
}

export function Search() {
  const { user } = useAuth();
  const location = useLocation();
  const isPeopleRoute = location.pathname === "/people";
  const [params, setParams] = useSearchParams();
  const { tag } = useParams();
  const [input, setInput] = useState(tag ? `#${tag}` : params.get("q") || "");
  const [results, setResults] = useState<Post[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [reels, setReels] = useState<
    {
      id: string;
      title: string;
      caption: string;
      created_at: string;
      profiles: { username: string; display_name: string } | null;
    }[]
  >([]);
  const [groups, setGroups] = useState<
    {
      id: string;
      slug: string;
      name: string;
      description: string;
      privacy: string;
      member_count: number;
      avatar_url: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(params.get("tab") || (isPeopleRoute ? "people" : "top"));
  const query = tag ? `#${tag}` : params.get("q") || "";
  const searchCache = useRef(
    new Map<
      string,
      {
        expires: number;
        posts: Post[];
        people: Profile[];
        reels: typeof reels;
        groups: typeof groups;
      }
    >(),
  );
  useEffect(() => {
    setInput(query);
  }, [query]);
  useEffect(() => {
    if (!query.trim() && isPeopleRoute && user) {
      let active = true;
      const loadPeople = async () => {
        setLoading(true);
        setError("");
        const [profileResult, followResult, dismissalResult] = await Promise.all([
          supabase.rpc("profile_search", { p_query: "", p_limit: 40 }),
          supabase.from("follows").select("following_id,status").eq("follower_id", user.id),
          supabase
            .from("suggestion_dismissals")
            .select("suggested_profile_id")
            .eq("profile_id", user.id),
        ]);
        if (!active) return;
        const failure = profileResult.error || followResult.error || dismissalResult.error;
        if (failure) setError(friendlyError(failure));
        else {
          const following = new Set((followResult.data ?? []).map((row) => row.following_id));
          const dismissed = new Set(
            (dismissalResult.data ?? []).map((row) => row.suggested_profile_id),
          );
          setPeople(
            ((profileResult.data ?? []) as Profile[])
              .filter((person) => !following.has(person.id) && !dismissed.has(person.id))
              .slice(0, 20),
          );
        }
        setResults([]);
        setReels([]);
        setGroups([]);
        setLoading(false);
      };
      void loadPeople();
      return () => {
        active = false;
      };
    }
    if (!query.trim()) {
      setResults([]);
      setPeople([]);
      setReels([]);
      setGroups([]);
      setError("");
      setLoading(false);
      return;
    }
    const cacheKey = `${user?.id ?? "guest"}:${tab}:${query.trim()}`;
    const cached = searchCache.current.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setResults(cached.posts);
      setPeople(cached.people);
      setReels(cached.reels);
      setGroups(cached.groups);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const safe = query
        .trim()
        .replace(/[%_,()]/g, "")
        .slice(0, 80);
      const hashtag = /^#[a-zA-Z0-9_]{1,64}$/.test(query.trim())
        ? query.trim().slice(1).toLowerCase()
        : null;
      // PostgREST's OR syntax is a filter expression, so never interpolate raw user input into it.
      const safeName = safe.replace(/^@/, "").replace(/[^\p{L}\p{N} ]/gu, "");
      const searchPeople = (tab === "top" || tab === "people") && !hashtag && Boolean(safeName);
      const searchPosts = tab === "top" || tab === "posts" || tab === "hashtags";
      const searchReels = (tab === "top" || tab === "reels") && !hashtag && Boolean(safeName);
      const searchGroups = (tab === "top" || tab === "groups") && !hashtag && Boolean(safeName);
      const [postResult, peopleResult, reelResult, groupResult] = await Promise.all([
        !searchPosts
          ? Promise.resolve({ data: [] as Post[], error: null })
          : hashtag
            ? supabase
                .from("posts")
                .select(`${postSelection},post_tags!inner(tag)`)
                .in("visibility", ["public", "followers"])
                .eq("is_published", true)
                .is("archived_at", null)
                .is("deleted_at", null)
                .eq("post_tags.tag", hashtag)
                .order("created_at", { ascending: false })
                .limit(20)
                .abortSignal(controller.signal)
            : supabase
                .from("posts")
                .select(postSelection)
                .in("visibility", ["public", "followers"])
                .eq("is_published", true)
                .is("archived_at", null)
                .is("deleted_at", null)
                .ilike("body", `%${safe}%`)
                .order("created_at", { ascending: false })
                .limit(20)
                .abortSignal(controller.signal),
        !searchPeople
          ? Promise.resolve({ data: [] as Profile[], error: null })
          : supabase
              .rpc("profile_search", { p_query: safeName, p_limit: 20 })
              .abortSignal(controller.signal),
        !searchReels
          ? Promise.resolve({
              data: [] as {
                id: string;
                title: string;
                caption: string;
                created_at: string;
                profiles: { username: string; display_name: string } | null;
              }[],
              error: null,
            })
          : supabase
              .from("reels")
              .select("id,title,caption,created_at,profiles!author_id(username,display_name)")
              .eq("status", "published")
              .eq("is_deleted", false)
              .eq("moderation_state", "clean")
              .or(`title.ilike.%${safeName}%,caption.ilike.%${safeName}%`)
              .order("created_at", { ascending: false })
              .limit(12)
              .abortSignal(controller.signal),
        !searchGroups
          ? Promise.resolve({
              data: [] as {
                id: string;
                slug: string;
                name: string;
                description: string;
                privacy: string;
                member_count: number;
                avatar_url: string | null;
              }[],
              error: null,
            })
          : supabase
              .from("groups")
              .select("id,slug,name,description,privacy,member_count,avatar_url")
              .ilike("name", `%${safeName}%`)
              .order("member_count", { ascending: false })
              .limit(12)
              .abortSignal(controller.signal),
      ]);
      if (!active) return;
      const searchError =
        postResult.error || peopleResult.error || reelResult.error || groupResult.error;
      if (searchError) setError(friendlyError(searchError));
      else {
        let engagedPosts: Post[] = [];
        if (searchPosts) {
          try {
            const engaged = await addPostEngagementCounts(
              (postResult.data ?? []) as unknown as Post[],
              user?.id,
            );
            if (!active) return;
            engagedPosts = engaged;
            setResults(engaged);
          } catch (cause) {
            setError(friendlyError(cause as { code?: string; message?: string }));
          }
        } else {
          setResults([]);
        }
        setPeople(peopleResult.data as Profile[]);
        setReels(reelResult.data as unknown as typeof reels);
        setGroups(groupResult.data as unknown as typeof groups);
        searchCache.current.set(cacheKey, {
          expires: Date.now() + 30000,
          posts: engagedPosts,
          people: (peopleResult.data ?? []) as Profile[],
          reels: (reelResult.data ?? []) as unknown as typeof reels,
          groups: (groupResult.data ?? []) as unknown as typeof groups,
        });
        if (searchCache.current.size > 20) {
          const oldest = searchCache.current.keys().next().value;
          if (oldest) searchCache.current.delete(oldest);
        }
      }
      setLoading(false);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tab, user?.id, isPeopleRoute]);
  const showPeople = tab === "top" || tab === "people";
  const showPosts = tab === "top" || tab === "posts" || tab === "hashtags";
  const showReels = tab === "top" || tab === "reels";
  const showGroups = tab === "top" || tab === "groups";
  function submit(e: FormEvent) {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim(), tab } : { tab });
  }
  return (
    <PageWorkspace area="discover" className="search-page">
      <PageHeading
        eyebrow="FIND YOUR NEXT FAVORITE"
        title={isPeopleRoute ? "Discover People" : tag ? `#${tag}` : "Discover something new."}
        subtitle={
          isPeopleRoute
            ? "Find people to follow and make your VELORI community your own."
            : "Search for people, conversations, and ideas that matter to you."
        }
      />
      <form className="search-field" onSubmit={submit}>
        <SearchIcon size={21} />
        <input
          aria-label="Search VELORI"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isPeopleRoute ? "Search people" : "Search people, posts, reels, groups, or #hashtags"
          }
        />
        <button type="submit" className="button button-primary">
          Search <ArrowRight size={16} />
        </button>
      </form>
      {!isPeopleRoute && <AdSpot placement="search" />}
      <div className="search-tabs" role="tablist" aria-label="Search categories">
        {["top", "people", "posts", "reels", "hashtags", "groups"].map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "selected" : ""}
            onClick={() => {
              setTab(item);
              if (!tag) setParams(query ? { q: query, tab: item } : { tab: item });
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="skeleton-stack" role="status" aria-label="Loading search results">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : error ? (
        <Problem
          message={error}
          retry={() => setParams({ q: query, tab, retry: String(Date.now()) })}
        />
      ) : !query && !isPeopleRoute ? (
        <EmptyState
          icon={SearchIcon}
          title="What sparks your curiosity?"
          text="Search for a name, a conversation, or a hashtag to find your way in."
        />
      ) : (
        <>
          {showPeople && people.length > 0 && (
            <div className="result-group">
              <h2>People</h2>
              {people.map((person) => (
                <ProfileLink username={person.username} key={person.id} className="person-result">
                  <span className="avatar avatar-blue">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt="" loading="lazy" />
                    ) : (
                      person.display_name?.charAt(0).toUpperCase() ||
                      person.username[0].toUpperCase()
                    )}
                  </span>
                  <span>
                    <strong>{person.display_name || person.username}</strong>
                    <small>@{person.username}</small>
                  </span>
                  <ArrowRight size={18} />
                </ProfileLink>
              ))}
            </div>
          )}
          {showPosts && results.length > 0 && (
            <div className="result-group">
              <h2>Conversations</h2>
              {results.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
          {showReels && reels.length > 0 && (
            <div className="result-group">
              <h2>Reels</h2>
              {reels.map((reel) => (
                <Link
                  to={`/reels?reel=${encodeURIComponent(reel.id)}`}
                  key={reel.id}
                  className="person-result"
                >
                  <span className="avatar avatar-pink" aria-hidden="true">
                    ▶
                  </span>
                  <span>
                    <strong>{reel.title || reel.caption.slice(0, 90) || "Reel"}</strong>
                    <small>
                      {reel.profiles?.display_name || `@${reel.profiles?.username ?? "creator"}`}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          )}
          {showGroups && groups.length > 0 && (
            <div className="result-group">
              <h2>Groups</h2>
              {groups.map((group) => (
                <Link
                  to={`/groups/${encodeURIComponent(group.slug)}`}
                  key={group.id}
                  className="person-result"
                >
                  <span className="avatar avatar-blue" aria-hidden="true">
                    {group.avatar_url ? (
                      <img src={group.avatar_url} alt="" loading="lazy" />
                    ) : (
                      <Users size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{group.name}</strong>
                    <small>
                      {group.member_count} {group.member_count === 1 ? "member" : "members"} ·{" "}
                      {group.privacy}
                    </small>
                    {group.description ? <small>{group.description}</small> : null}
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          )}
          {(!showPeople || !people.length) &&
            (!showPosts || !results.length) &&
            (!showReels || !reels.length) &&
            (!showGroups || !groups.length) && (
              <EmptyState
                icon={SearchIcon}
                title="Nothing found this time"
                text="Try another word or check the spelling. Only public content appears in search."
              />
            )}
        </>
      )}
    </PageWorkspace>
  );
}

export function PostDetail({
  postId,
  commentsOnly = false,
}: {
  postId?: string;
  commentsOnly?: boolean;
} = {}) {
  const { id: routeId } = useParams();
  const id = postId ?? routeId;
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<
    {
      id: string;
      author_id: string;
      parent_id: string | null;
      body: string;
      created_at: string;
      like_count: number;
      liked_by_me: boolean;
      profiles: Profile;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [body, setBody] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [allowSharing, setAllowSharing] = useState(true);
  const [postBusy, setPostBusy] = useState(false);
  const load = useCallback(async () => {
    if (!id || !uuidPattern.test(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setErrorDetails("");
    const [{ data, error: postError }, { data: replies, error: commentError }] = await Promise.all([
      supabase.from("posts").select(postSelection).eq("id", id).maybeSingle(),
      supabase
        .from("comments")
        .select(
          "id,author_id,parent_id,body,created_at,profiles!comments_author_id_fkey(id,username,display_name,avatar_url,is_private)",
        )
        .eq("post_id", id)
        .order("created_at")
        .limit(100),
    ]);
    if (postError || commentError) {
      const failedRequest = postError ? "Post query" : "Comment query";
      const failure = postError || commentError;
      setError(friendlyError(failure));
      setErrorDetails(requestFailureDetails(failedRequest, failure));
    } else {
      let loadedPost: Post | null = null;
      if (data) {
        try {
          loadedPost =
            (await addPostEngagementCounts([data as unknown as Post], user?.id))[0] ?? null;
        } catch (cause) {
          setError(friendlyError(cause as { code?: string; message?: string }));
          setErrorDetails(requestFailureDetails("Post engagement query", cause));
          setLoading(false);
          return;
        }
      }
      setPost(loadedPost);
      if (loadedPost) {
        setEditBody(loadedPost.body);
        setVisibility(loadedPost.visibility || "public");
        setAllowComments(loadedPost.allow_comments !== false);
        setAllowLikes(loadedPost.allow_likes !== false);
        setHideLikeCount(loadedPost.hide_like_count === true);
        setAllowSharing(loadedPost.allow_sharing !== false);
      }
      const commentRows = (replies ?? []) as unknown as Omit<
        (typeof comments)[number],
        "like_count" | "liked_by_me"
      >[];
      const ids = commentRows.map((comment) => comment.id);
      const [countsResult, ownLikesResult] =
        ids.length && user
          ? await Promise.all([
              supabase.rpc("get_social_comment_counts", {
                p_post_comment_ids: ids,
                p_reel_comment_ids: [],
              }),
              user
                ? supabase
                    .from("comment_likes")
                    .select("post_comment_id")
                    .eq("user_id", user.id)
                    .in("post_comment_id", ids)
                : Promise.resolve({ data: [], error: null }),
            ])
          : [
              { data: [], error: null },
              { data: [], error: null },
            ];
      if (countsResult.error || ownLikesResult.error) {
        const failure = countsResult.error || ownLikesResult.error;
        setError(friendlyError(failure));
        setErrorDetails(
          requestFailureDetails(
            countsResult.error ? "Comment counts query" : "Comment likes query",
            failure,
          ),
        );
        setComments([]);
      } else {
        const countRows = user ? parseSocialCommentCounts(countsResult.data) : [];
        if (!countRows) {
          setError("The post comment counts returned an invalid response. Reload and try again.");
          setErrorDetails("Comment counts query\nThe response did not match the expected shape.");
          setComments([]);
          setLoading(false);
          return;
        }
        const counts = new Map(
          countRows
            .filter((row) => row.target_type === "post")
            .map((row) => [row.comment_id, row.like_count]),
        );
        const ownLikes = new Set((ownLikesResult.data ?? []).map((row) => row.post_comment_id));
        setComments(
          commentRows.map((comment) => ({
            ...comment,
            like_count: Number(counts.get(comment.id) ?? 0),
            liked_by_me: ownLikes.has(comment.id),
          })),
        );
      }
    }
    setLoading(false);
  }, [id, user]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () =>
      subscribeSocialTable("comments", (change) => {
        const row = change.eventType === "DELETE" ? change.old : change.new;
        if (row.post_id === id) void load();
      }),
    [id, load],
  );
  useEffect(() => {
    const commentId = new URLSearchParams(location.search).get("comment");
    if (!commentId || !comments.length) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`post-comment-${commentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [comments, location.search]);
  useEffect(() => {
    if (!user) return;
    return subscribeSocialTable("comment_likes", (change) => {
      const row = change.eventType === "DELETE" ? change.old : change.new;
      const commentId = row.post_comment_id;
      if (typeof commentId !== "string") return;
      void supabase
        .rpc("get_social_comment_counts", {
          p_post_comment_ids: [commentId],
          p_reel_comment_ids: [],
        })
        .then(({ data, error: countError }) => {
          if (countError) return;
          const countRow = parseSocialCommentCounts(data)?.find(
            (item) => item.target_type === "post" && item.comment_id === commentId,
          );
          if (!countRow) {
            setError("The updated comment count could not be read. Reload and try again.");
            return;
          }
          const count = Number(countRow.like_count);
          setComments((current) =>
            current.map((comment) =>
              comment.id === commentId
                ? {
                    ...comment,
                    like_count: count,
                    liked_by_me:
                      user && row.user_id === user.id
                        ? change.eventType !== "DELETE"
                        : comment.liked_by_me,
                  }
                : comment,
            ),
          );
        });
    });
  }, [user?.id]);
  useEffect(() => {
    const updateProfiles = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (!changed) return;
      setComments((current) =>
        current.map((comment) =>
          comment.profiles.id === changed.id
            ? {
                ...comment,
                profiles: {
                  ...comment.profiles,
                  username: changed.username,
                  display_name: changed.display_name || "",
                  avatar_url: changed.avatar_url,
                },
              }
            : comment,
        ),
      );
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateProfiles);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateProfiles);
  }, []);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!user || !id || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("comments").insert({
      post_id: id,
      author_id: user.id,
      parent_id: replyingTo?.id ?? null,
      body: body.trim(),
    });
    setSending(false);
    if (error) setError(friendlyError(error));
    else {
      setBody("");
      setReplyingTo(null);
      void load();
    }
  }
  async function toggleCommentLike(comment: (typeof comments)[number]) {
    if (!user) {
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
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
          .insert({ user_id: user.id, post_comment_id: comment.id })
      : await supabase
          .from("comment_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_comment_id", comment.id);
    if (result.error && result.error.code !== "23505") {
      setError(friendlyError(result.error));
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                liked_by_me: !next,
                like_count: Math.max(0, item.like_count + (next ? -1 : 1)),
              }
            : item,
        ),
      );
      return;
    }
    const [counts, ownLike] = await Promise.all([
      supabase.rpc("get_social_comment_counts", {
        p_post_comment_ids: [comment.id],
        p_reel_comment_ids: [],
      }),
      supabase
        .from("comment_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_comment_id", comment.id)
        .maybeSingle(),
    ]);
    if (counts.error || ownLike.error) {
      setError(friendlyError(counts.error || ownLike.error));
      return;
    }
    const countRow = parseSocialCommentCounts(counts.data)?.find(
      (item) => item.target_type === "post" && item.comment_id === comment.id,
    );
    if (!countRow) {
      setError("The updated comment count could not be read. Reload and try again.");
      return;
    }
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              like_count: Number(countRow.like_count),
              liked_by_me: Boolean(ownLike.data),
            }
          : item,
      ),
    );
  }
  async function removeComment(comment: (typeof comments)[number]) {
    if (
      !user ||
      comment.author_id !== user.id ||
      !window.confirm("Delete this comment and its replies?")
    )
      return;
    const { error: deleteError } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id)
      .eq("author_id", user.id);
    if (deleteError) setError(friendlyError(deleteError));
    else void load();
  }
  async function reportComment(comment: (typeof comments)[number]) {
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
  async function savePost(e: FormEvent) {
    e.preventDefault();
    if (!user || !post || post.author_id !== user.id || !editBody.trim() || postBusy) return;
    setPostBusy(true);
    setError("");
    const changes = {
      body: editBody.trim(),
      visibility,
      allow_comments: allowComments,
      allow_likes: allowLikes,
      hide_like_count: hideLikeCount,
      allow_sharing: allowSharing,
    };
    const { error: saveError } = await supabase.from("posts").update(changes).eq("id", post.id);
    setPostBusy(false);
    if (saveError) setError(friendlyError(saveError));
    else {
      setPost({ ...post, ...changes });
      setEditing(false);
    }
  }
  async function changeLifecycle(action: "archive" | "trash") {
    if (!user || !post || post.author_id !== user.id || postBusy) return;
    setPostBusy(true);
    setError("");
    const changes =
      action === "archive"
        ? { archived_at: new Date().toISOString(), deleted_at: null }
        : { archived_at: null, deleted_at: new Date().toISOString() };
    const { error: lifecycleError } = await supabase
      .from("posts")
      .update(changes)
      .eq("id", post.id);
    setPostBusy(false);
    if (lifecycleError) setError(friendlyError(lifecycleError));
    else navigate(action === "archive" ? "/archive" : "/trash", { replace: true });
  }
  const Reader = commentsOnly ? Fragment : PostReader;
  if (!loading && !error && !post) return <NotFound />;
  return (
    <Reader>
      {loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <Problem message={error} retry={() => void load()} diagnostic={errorDetails} />
      ) : (
        post && (
          <div className={`post-reader-layout ${commentsOnly ? "post-comments-layout" : ""}`}>
            {!commentsOnly && (
              <div className="post-reader-story">
                <PostCard post={post} onChange={() => void load()} />
                {user?.id === post.author_id && (
                  <section className="post-owner-panel" aria-label="Manage your post">
                    {post.archived_at && <p role="status">This post is in your archive.</p>}
                    {post.deleted_at && (
                      <p role="status">
                        This post is in trash. It will be permanently removed after its recovery
                        period.
                      </p>
                    )}
                    <div className="post-owner-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setEditing((value) => !value)}
                        disabled={postBusy || Boolean(post.deleted_at)}
                      >
                        {editing ? "Close editor" : "Edit post & settings"}
                      </button>
                      {!post.archived_at && !post.deleted_at && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => void changeLifecycle("archive")}
                          disabled={postBusy}
                        >
                          Archive
                        </button>
                      )}
                      {!post.deleted_at && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => void changeLifecycle("trash")}
                          disabled={postBusy}
                        >
                          Move to trash
                        </button>
                      )}
                    </div>
                    {editing && (
                      <form className="post-edit-form" onSubmit={(event) => void savePost(event)}>
                        <label>
                          Post text
                          <textarea
                            value={editBody}
                            onChange={(event) => setEditBody(event.target.value)}
                            maxLength={2000}
                            required
                          />
                        </label>
                        <label>
                          Audience
                          <select
                            value={visibility}
                            onChange={(event) =>
                              setVisibility(event.target.value as typeof visibility)
                            }
                          >
                            <option value="public">Everyone</option>
                            <option value="followers">Followers</option>
                            <option value="private">Only me</option>
                          </select>
                        </label>
                        <label className="post-setting-check">
                          <input
                            type="checkbox"
                            checked={allowComments}
                            onChange={(event) => setAllowComments(event.target.checked)}
                          />
                          Allow comments
                        </label>
                        <label className="post-setting-check">
                          <input
                            type="checkbox"
                            checked={allowLikes}
                            onChange={(event) => setAllowLikes(event.target.checked)}
                          />
                          Allow likes
                        </label>
                        <label className="post-setting-check">
                          <input
                            type="checkbox"
                            checked={hideLikeCount}
                            onChange={(event) => setHideLikeCount(event.target.checked)}
                          />
                          Hide like count from other people
                        </label>
                        <label className="post-setting-check">
                          <input
                            type="checkbox"
                            checked={allowSharing}
                            onChange={(event) => setAllowSharing(event.target.checked)}
                          />
                          Allow sharing
                        </label>
                        <button
                          className="button button-primary"
                          disabled={postBusy || !editBody.trim()}
                        >
                          {postBusy ? "Saving…" : "Save post"}
                        </button>
                      </form>
                    )}
                  </section>
                )}
              </div>
            )}
            <aside className="post-reader-discussion">
              <div className="comments-section">
                {!commentsOnly && <h2>Join the conversation</h2>}
                {commentStatus ? (
                  <p className="inline-feedback" role="status">
                    {commentStatus}
                  </p>
                ) : null}
                {post.allow_comments === false ? (
                  <p className="muted">The author has turned comments off for this post.</p>
                ) : user ? (
                  <form onSubmit={send} className="comment-form">
                    {replyingTo ? (
                      <div className="comment-reply-context">
                        Replying to @{replyingTo.username}
                        <button type="button" onClick={() => setReplyingTo(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    <input
                      aria-label="Write a comment"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={1000}
                      placeholder="Add a thoughtful reply…"
                      required
                    />
                    <button disabled={sending || !body.trim()} className="button button-primary">
                      {sending ? "Posting…" : "Reply"} <Send size={16} />
                    </button>
                  </form>
                ) : (
                  <p className="muted">
                    <Link
                      to="/login"
                      state={{ from: `${location.pathname}${location.search}` }}
                      className="inline-link"
                    >
                      Sign in
                    </Link>{" "}
                    to leave a reply.
                  </p>
                )}
                {comments.length ? (
                  comments.map((comment) => (
                    <div
                      className={`comment ${comment.parent_id ? "comment-reply" : ""}`}
                      id={`post-comment-${comment.id}`}
                      key={comment.id}
                    >
                      <ProfileLink
                        className="avatar avatar-blue"
                        username={comment.profiles.username}
                        aria-label={`Open @${comment.profiles.username}'s profile`}
                      >
                        {comment.profiles.avatar_url ? (
                          <img src={comment.profiles.avatar_url} alt="" />
                        ) : (
                          comment.profiles.username[0].toUpperCase()
                        )}
                      </ProfileLink>
                      <div>
                        <ProfileLink
                          className="comment-author-link"
                          username={comment.profiles.username}
                        >
                          {comment.profiles.display_name || comment.profiles.username}
                        </ProfileLink>{" "}
                        <small>
                          @{comment.profiles.username} · {relativeDate(comment.created_at)}
                        </small>
                        <p>
                          <RichText text={comment.body} />
                        </p>
                        <div className="comment-interactions">
                          <button
                            type="button"
                            className={`comment-like-button ${comment.liked_by_me ? "is-liked" : ""}`}
                            aria-pressed={comment.liked_by_me}
                            onClick={() => void toggleCommentLike(comment)}
                          >
                            <Heart size={14} fill={comment.liked_by_me ? "currentColor" : "none"} />
                            {comment.liked_by_me ? "Unlike" : "Like"}
                          </button>
                          {comment.like_count > 0 ? (
                            <LikeListButton
                              target="post_comment"
                              contentId={comment.id}
                              count={comment.like_count}
                              showIcon={false}
                            />
                          ) : null}
                          {user ? (
                            <button
                              type="button"
                              className="comment-reply-button"
                              onClick={() =>
                                setReplyingTo({
                                  id: comment.id,
                                  username: comment.profiles.username,
                                })
                              }
                            >
                              Reply
                            </button>
                          ) : null}
                          {user?.id === comment.author_id ? (
                            <button
                              type="button"
                              className="comment-reply-button"
                              onClick={() => void removeComment(comment)}
                            >
                              Delete
                            </button>
                          ) : user ? (
                            <button
                              type="button"
                              className="comment-reply-button"
                              onClick={() => void reportComment(comment)}
                            >
                              Report
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No replies yet. Be the first to add to the conversation.</p>
                )}
              </div>
            </aside>
          </div>
        )
      )}
    </Reader>
  );
}

export function OwnProfileRedirect() {
  const { user, loading } = useAuth();
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!user) {
      setDestination("");
      return () => {
        active = false;
      };
    }
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(friendlyError(queryError));
        else if (data?.username) setDestination(`/profile/${encodeURIComponent(data.username)}`);
        else setError("Your profile could not be found.");
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!user && !loading) return <Navigate to="/login" replace />;
  if (destination) return <Navigate to={destination} replace />;
  if (error) return <Problem message={error} />;
  return (
    <div
      className="narrow-page profile-loading"
      role="status"
      aria-live="polite"
      aria-label="Loading profile"
    >
      <div className="skeleton-card" />
    </div>
  );
}

export function ProfilePage() {
  const [connectionList, setConnectionList] = useState<"followers" | "following" | null>(null);
  const { username } = useParams();
  const { user } = useAuth();
  const reducedMotion = useInterfaceMotion().reduced;
  const coverRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: coverScrollProgress } = useScroll({
    target: coverRef,
    offset: ["start start", "end start"],
  });
  const coverParallaxY = useTransform(coverScrollProgress, [0, 1], [0, 36]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeProfileStoryId, setActiveProfileStoryId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profilePostCount, setProfilePostCount] = useState(0);
  const [profileTab, setProfileTab] = useState<"posts" | "reels" | "tagged">("posts");
  const [reels, setReels] = useState<
    {
      id: string;
      title: string;
      caption: string;
      thumbnail_url: string;
      created_at: string;
      reel_media: { object_path: string; media_type: string }[];
      coverSrc: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted">("none");
  const [followCounts, setFollowCounts] = useState<{
    followers_count: number | null;
    following_count: number | null;
  } | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [canMessageTarget, setCanMessageTarget] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await supabase
      .rpc("profile_discovery_by_username", { p_username: username || "" })
      .maybeSingle();
    const discoveredProfile = result.data as Profile | null;
    if (result.error) setError(friendlyError(result.error));
    else if (discoveredProfile) {
      setProfile(discoveredProfile);
      const [countsResult, relationResult, storyResult, messageResult] = await Promise.all([
        supabase.rpc("profile_follow_counts", { target_profile_id: discoveredProfile.id }),
        user && user.id !== discoveredProfile.id
          ? supabase
              .from("follows")
              .select("status")
              .eq("follower_id", user.id)
              .eq("following_id", discoveredProfile.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("stories")
          .select("id")
          .eq("author_id", discoveredProfile.id)
          .eq("status", "active")
          .eq("moderation_state", "clean")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        user && user.id !== discoveredProfile.id
          ? supabase.rpc("can_message_profile", { p_other_user_id: discoveredProfile.id })
          : Promise.resolve({ data: false, error: null }),
      ]);
      if (countsResult.error) {
        setFollowCounts(null);
        setError(friendlyError(countsResult.error));
      } else setFollowCounts(countsResult.data?.[0] || null);
      if (relationResult.error) setError(friendlyError(relationResult.error));
      else setFollowStatus((relationResult.data?.status as typeof followStatus) || "none");
      if (storyResult.error) setError(friendlyError(storyResult.error));
      else setActiveProfileStoryId(storyResult.data?.id ?? null);
      setCanMessageTarget(!messageResult.error && Boolean(messageResult.data));
      const recent = await supabase
        .from("posts")
        .select(postSelection, { count: "exact" })
        .eq("author_id", discoveredProfile.id)
        .in(
          "visibility",
          discoveredProfile.id === user?.id
            ? ["public", "followers", "private"]
            : ["public", "followers"],
        )
        .eq("is_published", true)
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (recent.error) setError(friendlyError(recent.error));
      else {
        setProfilePostCount(recent.count ?? 0);
        try {
          setPosts(
            await addPostEngagementCounts((recent.data ?? []) as unknown as Post[], user?.id),
          );
        } catch (cause) {
          setError(friendlyError(cause as { code?: string; message?: string }));
        }
      }
      const recentReels = await supabase
        .from("reels")
        .select("id,title,caption,thumbnail_url,created_at,reel_media(object_path,media_type)")
        .eq("author_id", discoveredProfile.id)
        .eq("status", "published")
        .eq("is_deleted", false)
        .eq("moderation_state", "clean")
        .order("created_at", { ascending: false })
        .limit(12);
      if (recentReels.error) setError(friendlyError(recentReels.error));
      else {
        const reelRows = (recentReels.data ?? []) as unknown as typeof reels;
        const paths = reelRows.flatMap((reel) =>
          reel.reel_media
            .filter((media) => media.media_type === "image")
            .map((media) => media.object_path),
        );
        try {
          const covers = await signSocialMedia(SOCIAL_MEDIA_BUCKETS.reels, paths);
          setReels(
            reelRows.map((reel) => ({
              ...reel,
              coverSrc:
                reel.reel_media
                  .filter((media) => media.media_type === "image")
                  .map((media) => covers.get(media.object_path))
                  .find(Boolean) || reel.thumbnail_url,
            })),
          );
        } catch (cause) {
          setError(friendlyError(cause as { code?: string; message?: string }));
          setReels(reelRows.map((reel) => ({ ...reel, coverSrc: reel.thumbnail_url })));
        }
      }
    } else setProfile(null);
    setLoading(false);
  }, [username, user]);
  useEffect(() => {
    void load();
  }, [load]);
  async function toggleFollow() {
    if (!user || !profile || user.id === profile.id || followBusy) return;
    setFollowBusy(true);
    setError("");
    if (followStatus === "none") {
      const status = profile.is_private ? "pending" : "accepted";
      const { error: followError } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
        status,
      });
      if (followError) setError(friendlyError(followError));
      else {
        setFollowStatus(status);
        void load();
      }
    } else {
      const { error: unfollowError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      if (unfollowError) setError(friendlyError(unfollowError));
      else {
        setFollowStatus("none");
        void load();
      }
    }
    setFollowBusy(false);
  }
  const isOwner = user?.id === profile?.id;
  const canViewProfilePosts = !profile?.is_private || isOwner || followStatus === "accepted";
  if (!loading && !error && !profile) return <NotFound />;
  return (
    <div className="narrow-page profile-page">
      {loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <Problem message={error} retry={() => void load()} />
      ) : (
        profile && (
          <div className="v-person-profile">
            <ProfileIdentity
              profile={profile}
              avatar={
                isOwner ? (
                  <Link
                    to="/stories?create=1"
                    className="profile-large-avatar profile-story-entry"
                    aria-label="Add a story"
                    title="Add story"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      profile.display_name?.charAt(0).toUpperCase() ||
                      profile.username[0].toUpperCase()
                    )}
                    <span className="profile-story-add-indicator" aria-hidden="true">
                      <Plus size={17} />
                    </span>
                  </Link>
                ) : activeProfileStoryId ? (
                  <Link
                    to={`/stories?story=${encodeURIComponent(activeProfileStoryId)}`}
                    className="profile-large-avatar profile-story-active"
                    aria-label={`View @${profile.username}'s story`}
                    title="View story"
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={`${profile.username}'s profile`} />
                    ) : (
                      profile.display_name?.charAt(0).toUpperCase() ||
                      profile.username[0].toUpperCase()
                    )}
                  </Link>
                ) : (
                  <div className="profile-large-avatar">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={`${profile.username}'s profile`} />
                    ) : (
                      profile.display_name?.charAt(0).toUpperCase() ||
                      profile.username[0].toUpperCase()
                    )}
                  </div>
                )
              }
              actions={
                <div className="profile-buttons">
                  {isOwner && (
                    <>
                      <Link to="/settings/account" className="button button-outline">
                        Edit profile
                      </Link>
                      <Link
                        to="/settings/account#profile-photo"
                        className="button button-outline"
                        aria-label="Edit profile photo"
                      >
                        <Camera size={16} /> Edit photo
                      </Link>
                      <Link to="/settings" className="button button-outline">
                        Settings
                      </Link>
                    </>
                  )}
                  {!isOwner && user && (
                    <>
                      <button
                        className={
                          followStatus === "accepted"
                            ? "button button-outline"
                            : "button button-primary"
                        }
                        disabled={followBusy}
                        onClick={() => void toggleFollow()}
                      >
                        {followBusy
                          ? "Please wait…"
                          : followStatus === "pending"
                            ? "Cancel request"
                            : followStatus === "accepted"
                              ? "Following"
                              : profile.is_private
                                ? "Request to follow"
                                : "Follow"}
                      </button>
                      {canMessageTarget ? (
                        <Link
                          to={`/messages?to=${encodeURIComponent(profile.username)}`}
                          className="button button-outline"
                        >
                          <MessageCircle size={16} /> Message
                        </Link>
                      ) : (
                        <button type="button" className="button button-outline" disabled>
                          Messaging restricted
                        </button>
                      )}
                    </>
                  )}
                  {!isOwner && !user && (
                    <>
                      <Link to="/login" className="button button-primary">
                        Sign in to follow
                      </Link>
                      <Link
                        to="/login"
                        state={{ from: `/messages?to=${encodeURIComponent(profile.username)}` }}
                        className="button button-outline"
                      >
                        <MessageCircle size={16} /> Sign in to message
                      </Link>
                    </>
                  )}
                  <button
                    className="button button-soft"
                    onClick={() => {
                      const url = window.location.href;
                      if (navigator.share) {
                        void navigator.share({ url }).catch((error: unknown) => {
                          if (error instanceof DOMException && error.name === "AbortError") return;
                          setShareMessage(
                            "Unable to share this profile. Copy its address and try again.",
                          );
                        });
                      } else {
                        void navigator.clipboard
                          .writeText(url)
                          .then(() => setShareMessage("Profile link copied."))
                          .catch(() =>
                            setShareMessage(
                              "Clipboard access is unavailable. Copy the address from your browser.",
                            ),
                          );
                      }
                    }}
                  >
                    Share profile
                  </button>
                </div>
              }
              counts={
                <div className="profile-counts" aria-label="Profile statistics">
                  {connectionList ? (
                    <ProfileConnections
                      key={profile.id}
                      profileId={profile.id}
                      username={profile.username}
                      initialDirection={connectionList}
                      onClose={() => setConnectionList(null)}
                    />
                  ) : null}
                  <div>
                    <strong>
                      <AnimatedProfileStat value={profilePostCount} />
                    </strong>
                    <span>Posts</span>
                  </div>
                  {followCounts?.followers_count !== null &&
                  followCounts?.followers_count !== undefined ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setConnectionList("followers")}
                    >
                      <strong>
                        <AnimatedProfileStat value={followCounts.followers_count} />
                      </strong>
                      <span>Followers</span>
                    </button>
                  ) : null}
                  {followCounts?.following_count !== null &&
                  followCounts?.following_count !== undefined ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setConnectionList("following")}
                    >
                      <strong>
                        <AnimatedProfileStat value={followCounts.following_count} />
                      </strong>
                      <span>Following</span>
                    </button>
                  ) : null}
                </div>
              }
              feedback={
                shareMessage ? (
                  <p className="inline-feedback" role="status" aria-live="polite">
                    {shareMessage}
                  </p>
                ) : null
              }
            />
            <section className="profile-timeline-recreated">
              <div className="profile-sections">
                <nav
                  className="profile-tabs"
                  aria-label="Profile sections"
                  role="tablist"
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    const tabs = [
                      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
                    ];
                    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
                    if (current < 0) return;
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                            tabs.length;
                    event.preventDefault();
                    tabs[next].focus();
                    tabs[next].click();
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    id="profile-tab-posts"
                    aria-controls="profile-content"
                    tabIndex={profileTab === "posts" ? 0 : -1}
                    aria-selected={profileTab === "posts"}
                    onClick={() => setProfileTab("posts")}
                  >
                    Posts
                    {profileTab === "posts" ? (
                      <m.span
                        className="profile-tab-indicator"
                        layoutId="profile-tab-indicator"
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 300, damping: 25 }
                        }
                      />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="profile-tab-reels"
                    aria-controls="profile-content"
                    tabIndex={profileTab === "reels" ? 0 : -1}
                    aria-selected={profileTab === "reels"}
                    onClick={() => setProfileTab("reels")}
                  >
                    Reels
                    {profileTab === "reels" ? (
                      <m.span
                        className="profile-tab-indicator"
                        layoutId="profile-tab-indicator"
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 300, damping: 25 }
                        }
                      />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="profile-tab-tagged"
                    aria-controls="profile-content"
                    tabIndex={profileTab === "tagged" ? 0 : -1}
                    aria-selected={profileTab === "tagged"}
                    onClick={() => setProfileTab("tagged")}
                  >
                    Tagged
                    {profileTab === "tagged" && (
                      <m.span
                        className="profile-tab-indicator"
                        layoutId="profile-tab-indicator"
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 300, damping: 25 }
                        }
                      />
                    )}
                  </button>
                </nav>
                {isOwner && (
                  <Link className="profile-saved-link" to="/saved">
                    <Bookmark size={16} aria-hidden="true" />
                    Saved
                  </Link>
                )}
              </div>
              <div
                id="profile-content"
                role="tabpanel"
                aria-labelledby={`profile-tab-${profileTab}`}
              >
                {profile.is_private && !canViewProfilePosts ? (
                  <EmptyState
                    icon={LockKeyhole}
                    title="This profile is private"
                    text="Follow this person to see posts shared with their followers."
                  />
                ) : null}
                {canViewProfilePosts && profileTab === "posts" && (
                  <div className="section-heading profile-post-heading" id="profile-posts">
                    <div>
                      <div className="eyebrow">
                        <span className="eyebrow-line" />
                        {isOwner ? "YOUR WORDS" : "THEIR WORDS"}
                      </div>
                      <h2>
                        Posts<span className="pink-period">.</span>
                      </h2>
                    </div>
                  </div>
                )}
                {canViewProfilePosts && profileTab === "tagged" && (
                  <TaggedPosts
                    key={`${profile.id}:${profile.username}:${user?.id ?? "anon"}`}
                    username={profile.username}
                  />
                )}
                {canViewProfilePosts && profileTab === "posts" && posts.length ? (
                  <ProfilePostGrid key={profile.id} posts={posts} />
                ) : canViewProfilePosts && profileTab === "posts" ? (
                  <EmptyState
                    icon={Feather}
                    title="Nothing shared just yet"
                    text={
                      isOwner
                        ? "Your first post starts a new connection. Share a thought, a photo, or a moment."
                        : "When this person posts, their words will find a home here."
                    }
                    action={isOwner ? "Create your first post" : undefined}
                    to={isOwner ? "/create" : undefined}
                  />
                ) : null}
                {canViewProfilePosts && profileTab === "reels" ? (
                  <section
                    className="profile-reels-section"
                    id="profile-reels"
                    aria-label="Creator reels"
                  >
                    <div className="section-heading profile-post-heading">
                      <div>
                        <div className="eyebrow">
                          <span className="eyebrow-line" /> SHORT VIDEOS
                        </div>
                        <h2>
                          Reels<span className="pink-period">.</span>
                        </h2>
                      </div>
                    </div>
                    {reels.length ? (
                      <div className="profile-reel-grid">
                        {reels.map((reel) => (
                          <Link
                            className="profile-reel-tile"
                            to={`/reels?reel=${encodeURIComponent(reel.id)}`}
                            key={reel.id}
                          >
                            {reel.coverSrc ? (
                              <img src={reel.coverSrc} alt="" loading="lazy" />
                            ) : (
                              <Video size={28} aria-hidden="true" />
                            )}
                            <span>{reel.title || reel.caption || "Watch reel"}</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No reels shared yet.</p>
                    )}
                  </section>
                ) : null}
              </div>
            </section>
          </div>
        )
      )}
    </div>
  );
}

type FollowRequest = {
  follower_id: string;
  following_id: string;
  created_at: string;
  profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
};

export function FollowRequests() {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("follows")
      .select(
        "follower_id,following_id,created_at,profiles!follows_follower_id_fkey(id,username,display_name,avatar_url)",
      )
      .eq("following_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (queryError) setError(friendlyError(queryError));
    else {
      setError("");
      setRequests((data || []) as unknown as FollowRequest[]);
    }
    setLoading(false);
  }, [authLoading, user]);
  useEffect(() => {
    void load();
  }, [load]);

  async function respond(request: FollowRequest, accept: boolean) {
    if (!user || busyId) return;
    setBusyId(request.follower_id);
    setError("");
    const result = accept
      ? await supabase
          .from("follows")
          .update({ status: "accepted" })
          .eq("follower_id", request.follower_id)
          .eq("following_id", user.id)
          .eq("status", "pending")
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", request.follower_id)
          .eq("following_id", user.id)
          .eq("status", "pending");
    if (result.error) setError(friendlyError(result.error));
    else setRequests((items) => items.filter((item) => item.follower_id !== request.follower_id));
    setBusyId("");
  }

  return (
    <PageWorkspace area="activity" className="">
      <PageHeading
        eyebrow="YOUR COMMUNITY"
        title="Follow requests."
        subtitle="Choose who can see posts shared with your followers."
      />
      {!user && !authLoading ? (
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to continue"
          text="Follow requests are private to your account."
          action="Sign in"
          to="/login"
        />
      ) : loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <Problem message={error} retry={() => void load()} />
      ) : requests.length ? (
        requests.map((request) => (
          <article className="settings-section follow-request-card" key={request.follower_id}>
            <ProfileLink username={request.profiles.username} className="follow-request-person">
              <span className="profile-avatar-small">
                {request.profiles.avatar_url ? (
                  <img src={request.profiles.avatar_url} alt="" />
                ) : (
                  request.profiles.display_name?.charAt(0).toUpperCase() ||
                  request.profiles.username[0].toUpperCase()
                )}
              </span>
              <span>
                <strong>{request.profiles.display_name || request.profiles.username}</strong>
                <small>@{request.profiles.username}</small>
              </span>
            </ProfileLink>
            <div className="follow-request-actions">
              <button
                className="button button-primary"
                disabled={Boolean(busyId)}
                onClick={() => void respond(request, true)}
              >
                {busyId === request.follower_id ? "Saving…" : "Accept"}
              </button>
              <button
                className="button button-outline"
                disabled={Boolean(busyId)}
                onClick={() => void respond(request, false)}
              >
                Decline
              </button>
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          icon={Users}
          title="No requests right now"
          text="New requests to follow your private profile will appear here."
        />
      )}
    </PageWorkspace>
  );
}

export function Saved() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: dbError } = await supabase
      .from("saves")
      .select(`post_id,posts(${postSelection})`)
      .eq("user_id", user.id)
      .is("posts.archived_at", null)
      .is("posts.deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (dbError) setError(friendlyError(dbError));
    else {
      // PostgREST can return an embedded many-to-one relation as either a single
      // object or a one-element array depending on how it resolves the foreign
      // key, so both shapes are flattened here rather than trusting one of them.
      const rows = (data ?? []) as unknown as {
        posts: Post | Post[] | null;
      }[];
      const savedPosts = rows.flatMap((row) => {
        if (!row.posts) return [];
        return Array.isArray(row.posts) ? row.posts : [row.posts];
      });
      try {
        setPosts(await addPostEngagementCounts(savedPosts, user.id));
      } catch (cause) {
        setError(friendlyError(cause as { code?: string; message?: string }));
      }
    }
    setLoading(false);
  }, [user, authLoading]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <PageWorkspace area="library" className="">
      <PageHeading
        eyebrow="JUST FOR YOU"
        title="Your saved moments."
        subtitle="A quiet place for the things you want to come back to."
      />
      {loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <Problem message={error} retry={() => void load()} />
      ) : !user ? (
        <EmptyState
          icon={LockKeyhole}
          title="Your collection is private"
          text="Sign in to see the posts you've kept close."
          action="Sign in"
          to="/login"
        />
      ) : posts.length ? (
        posts.map((post) => <PostCard key={post.id} post={post} onChange={() => void load()} />)
      ) : (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          text="See something worth revisiting? Save it and find it here, just for you."
          action="Explore posts"
          to="/home"
        />
      )}
    </PageWorkspace>
  );
}

type PostDraft = {
  id: string;
  author_id: string;
  body: string;
  visibility: "public" | "followers" | "private";
  updated_at: string;
};

type LocalPostDraftBackup = {
  id: string | null;
  body: string;
  visibility: "public" | "followers" | "private";
  allow_comments: boolean;
  allow_likes: boolean;
  hide_like_count: boolean;
  allow_sharing: boolean;
  canvas_layers_by_slide?: Record<string, PostEditorLayer[]>;
  canvas_backgrounds_by_slide?: Record<string, string>;
  updated_at: string;
};

function readLocalPostDraftBackup(key: string): LocalPostDraftBackup | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || "null",
    ) as Partial<LocalPostDraftBackup> | null;
    if (
      !value ||
      typeof value.body !== "string" ||
      value.body.length > 2000 ||
      (value.visibility !== "public" &&
        value.visibility !== "followers" &&
        value.visibility !== "private") ||
      typeof value.allow_comments !== "boolean" ||
      typeof value.allow_likes !== "boolean" ||
      typeof value.hide_like_count !== "boolean" ||
      typeof value.allow_sharing !== "boolean" ||
      typeof value.updated_at !== "string"
    )
      return null;
    return {
      ...(value as LocalPostDraftBackup),
      canvas_layers_by_slide: normalizePostCanvasLayers(value.canvas_layers_by_slide),
      canvas_backgrounds_by_slide:
        value.canvas_backgrounds_by_slide && typeof value.canvas_backgrounds_by_slide === "object"
          ? Object.fromEntries(
              Object.entries(value.canvas_backgrounds_by_slide).filter(
                ([key, color]) =>
                  typeof key === "string" &&
                  typeof color === "string" &&
                  /^#[0-9a-f]{3,8}$/i.test(color),
              ),
            )
          : {},
    };
  } catch {
    return null;
  }
}

export function PostLibrary({ kind }: { kind: "archive" | "trash" | "drafts" }) {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    if (kind === "drafts") {
      const { data, error: dbError } = await supabase
        .from("post_drafts")
        .select("id,author_id,body,visibility,updated_at")
        .eq("author_id", user.id)
        .neq("collaboration_status", "published")
        .order("updated_at", { ascending: false });
      const rows = (data || []) as PostDraft[];
      const localBackup = readLocalPostDraftBackup(`velori-post-draft:${user.id}`);
      if (localBackup?.id && !rows.some((draft) => draft.id === localBackup.id)) {
        rows.unshift({
          id: localBackup.id,
          author_id: user.id,
          body: localBackup.body,
          visibility: localBackup.visibility,
          updated_at: localBackup.updated_at,
        });
      }
      if (dbError && !rows.length) setError(friendlyError(dbError));
      else setDrafts(rows);
    } else {
      if (kind === "archive") {
        const { data, error: dbError } = await supabase
          .from("posts")
          .select(postSelection)
          .eq("author_id", user.id)
          .not("archived_at", "is", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (dbError) setError(friendlyError(dbError));
        else {
          try {
            setPosts(await addPostEngagementCounts((data ?? []) as unknown as Post[], user.id));
          } catch (cause) {
            setError(friendlyError(cause as { code?: string; message?: string }));
          }
        }
      } else {
        const { data, error: dbError } = await supabase
          .from("posts")
          .select(postSelection)
          .eq("author_id", user.id)
          .not("deleted_at", "is", null)
          .order("created_at", { ascending: false });
        if (dbError) setError(friendlyError(dbError));
        else {
          try {
            setPosts(await addPostEngagementCounts((data ?? []) as unknown as Post[], user.id));
          } catch (cause) {
            setError(friendlyError(cause as { code?: string; message?: string }));
          }
        }
      }
    }
    setLoading(false);
  }, [authLoading, user, kind]);
  useEffect(() => {
    void load();
  }, [load]);
  async function restore(post: Post) {
    setBusyId(post.id);
    const changes = kind === "archive" ? { archived_at: null } : { deleted_at: null };
    const { error: dbError } = await supabase.from("posts").update(changes).eq("id", post.id);
    setBusyId("");
    if (dbError) setError(friendlyError(dbError));
    else void load();
  }
  async function permanentlyDelete(post: Post) {
    if (!window.confirm("Permanently delete this post and its comments, likes, and saves?")) return;
    setBusyId(post.id);
    const { data: media, error: mediaQueryError } = await supabase
      .from("post_media")
      .select("object_path")
      .eq("post_id", post.id)
      .eq("author_id", user?.id);
    if (mediaQueryError) {
      setBusyId("");
      setError(friendlyError(mediaQueryError));
      return;
    }
    if (media?.length) {
      const { error: storageError } = await supabase.storage
        .from("post-media")
        .remove(media.map((item) => item.object_path));
      if (storageError) {
        setBusyId("");
        setError(friendlyError(storageError));
        return;
      }
    }
    const { error: dbError } = await supabase.from("posts").delete().eq("id", post.id);
    setBusyId("");
    if (dbError) setError(friendlyError(dbError));
    else void load();
  }
  async function deleteDraft(draft: PostDraft) {
    setBusyId(draft.id);
    const { data: media, error: mediaQueryError } = await supabase
      .from("post_draft_media")
      .select("object_path")
      .eq("draft_id", draft.id)
      .eq("author_id", user?.id);
    if (mediaQueryError) {
      setBusyId("");
      setError(friendlyError(mediaQueryError));
      return;
    }
    if (media?.length) {
      const { error: storageError } = await supabase.storage
        .from("post-media")
        .remove(media.map((item) => item.object_path));
      if (storageError) {
        setBusyId("");
        setError(friendlyError(storageError));
        return;
      }
    }
    const { error: dbError } = await supabase
      .from("post_drafts")
      .delete()
      .eq("id", draft.id)
      .eq("author_id", user?.id);
    setBusyId("");
    if (dbError) setError(friendlyError(dbError));
    else {
      try {
        if (user) {
          const key = `velori-post-draft:${user.id}`;
          if (readLocalPostDraftBackup(key)?.id === draft.id) localStorage.removeItem(key);
        }
      } catch {
        // The saved server draft has already been deleted.
      }
      void load();
    }
  }
  const title =
    kind === "archive" ? "Your archive." : kind === "trash" ? "Recently deleted." : "Your drafts.";
  const items = kind === "drafts" ? drafts.length : posts.length;
  return (
    <PageWorkspace area="library" className="">
      <PageHeading
        eyebrow="YOUR CONTENT"
        title={title}
        subtitle={
          kind === "archive"
            ? "Archived posts are hidden from your profile until you restore them."
            : kind === "trash"
              ? "Deleted posts can be restored for 30 days before permanent removal."
              : "Drafts save privately to your account and are ready when you are."
        }
      />
      {!user && !authLoading ? (
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to continue"
          text="Your content library is private to your account."
          action="Sign in"
          to="/login"
        />
      ) : loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : error ? (
        <Problem message={error} retry={() => void load()} />
      ) : items === 0 ? (
        <EmptyState
          icon={kind === "drafts" ? Feather : Bookmark}
          title={
            kind === "drafts"
              ? "No drafts saved"
              : kind === "archive"
                ? "Your archive is empty"
                : "Trash is empty"
          }
          text={
            kind === "drafts"
              ? "Save a work in progress from Create and it will appear here."
              : kind === "archive"
                ? "Posts you archive will be kept here for you."
                : "Posts you move to trash will be kept here temporarily."
          }
          action={kind === "drafts" ? "Create a post" : undefined}
          to={kind === "drafts" ? "/create" : undefined}
        />
      ) : kind === "drafts" ? (
        <div className="library-list">
          {drafts.map((draft) => (
            <article className="library-item" key={draft.id}>
              <div>
                <p>{draft.body || "Untitled draft"}</p>
                <small>
                  Updated {relativeDate(draft.updated_at)} ·{" "}
                  {draft.visibility === "private"
                    ? "Only me"
                    : draft.visibility === "followers"
                      ? "Followers"
                      : "Everyone"}
                </small>
              </div>
              <div className="post-owner-actions">
                <Link className="button button-outline" to={`/create?draft=${draft.id}`}>
                  Continue
                </Link>
                <button
                  className="button button-outline"
                  onClick={() => void deleteDraft(draft)}
                  disabled={busyId === draft.id}
                >
                  Delete draft
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        posts.map((post) => (
          <article className="library-item" key={post.id}>
            <div>
              <Link to={`/post/${post.id}`}>
                <RichText text={post.body} />
              </Link>
              <small>Posted {relativeDate(post.created_at)}</small>
            </div>
            <div className="post-owner-actions">
              <button
                className="button button-outline"
                onClick={() => void restore(post)}
                disabled={busyId === post.id}
              >
                Restore
              </button>
              <button
                className="button button-outline"
                onClick={() => void permanentlyDelete(post)}
                disabled={busyId === post.id}
              >
                Delete permanently
              </button>
            </div>
          </article>
        ))
      )}
    </PageWorkspace>
  );
}

export function CreatePost() {
  const creatorTheme = useCreatorStudioTheme("post");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const inviteToken = searchParams.get("invite");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [allowSharing, setAllowSharing] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(requestedDraftId);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftWorkflowStatus, setDraftWorkflowStatus] = useState("draft");
  const [collaborationRole, setCollaborationRole] = useState("owner");
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [inviteReady, setInviteReady] = useState(!inviteToken);
  const [collaborationDirty, setCollaborationDirty] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState<{ body: string; version_number: number } | null>(
    null,
  );
  const [remoteCursors, setRemoteCursors] = useState<
    Array<{ user_id: string; display_name: string; color: string; x: number; y: number }>
  >([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<Pick<
    Profile,
    "display_name" | "username" | "avatar_url"
  > | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);
  const [tourStep, setTourStep] = useState(() =>
    localStorage.getItem("velori-post-tour-done") ? 0 : 1,
  );
  const [saveIndicator, setSaveIndicator] = useState("Saved");
  const [mediaMode, setMediaMode] = useState<"photo" | "video" | "carousel">("photo");
  const [studioAspectRatio, setStudioAspectRatio] = useState<PostEditorAspectRatio>("4:5");
  const [studioZoom, setStudioZoom] = useState(0.3);
  const [studioFitRequest, setStudioFitRequest] = useState(0);
  const [studioSnapToGrid, setStudioSnapToGrid] = useState(false);
  const [studioSafeZone, setStudioSafeZone] = useState(false);
  const [studioPlatform, setStudioPlatform] = useState("IG");
  const [activeStudioTool, setActiveStudioTool] = useState<string | null>(null);
  const [studioSelectedElement, setStudioSelectedElement] = useState<
    "text" | "image" | "shape" | null
  >(null);
  const [selectedStudioTemplateId, setSelectedStudioTemplateId] = useState<string | null>(null);
  const [selectedCanvasLayer, setSelectedCanvasLayer] = useState<PostEditorLayer | null>(null);
  const [studioLayersPanel, setStudioLayersPanel] = useState<LayersPanelProps | null>(null);
  const [catalogStickers, setCatalogStickers] = useState<StudioStickerAsset[]>([]);
  const [stickerSearch, setStickerSearch] = useState("");
  const [catalogStickerError, setCatalogStickerError] = useState("");
  const [activeCanvasSlideIndex, setActiveCanvasSlideIndex] = useState(0);
  const [canvasLayersBySlide, setCanvasLayersBySlide] = useState<Record<string, PostEditorLayer[]>>(
    {},
  );
  const [canvasBackgroundsBySlide, setCanvasBackgroundsBySlide] = useState<Record<string, string>>(
    {},
  );
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showStickerLibrary, setShowStickerLibrary] = useState(false);
  const canvasLayersBySlideRef = useRef(canvasLayersBySlide);
  canvasLayersBySlideRef.current = canvasLayersBySlide;
  const [studioBrandKit] = useState(loadStudioBrandKit);
  const publishFormRef = useRef<HTMLFormElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const draftSaveRef = useRef<Promise<void>>(Promise.resolve());
  const persistDraftRef = useRef<() => Promise<string | null>>(async () => null);
  const collabChannelRef = useRef<PostDraftChannel | null>(null);
  const lastCursorBroadcastRef = useRef(0);
  const bodyValueRef = useRef(body);
  const collaborationDirtyRef = useRef(false);
  bodyValueRef.current = body;
  collaborationDirtyRef.current = collaborationDirty;
  const [draftMedia, setDraftMedia] = useState<DraftMediaRecord[]>([]);
  const draftMediaRef = useRef<DraftMediaRecord[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const localDraftKey = user ? `velori-post-draft:${user.id}` : "";
  const canEditCollaboration = ["owner", "admin", "editor"].includes(collaborationRole);

  const studioTemplates = useMemo(
    () =>
      createTemplateCatalog()
        .slice(0, 24)
        .map((template) => ({
          id: template.id,
          name: template.name,
          category: "post" as const,
          content: template.content,
          palette: template.palette,
          platform: template.platform,
          industry: template.industry,
          type: template.type,
        })),
    [],
  );
  const ratioValues: Record<PostEditorAspectRatio, number> = {
    "1:1": 1,
    "4:5": 4 / 5,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
  };
  const studioCanvasHeight = Math.round(1080 / ratioValues[studioAspectRatio]);

  const postCanvasSlides = useMemo<PostEditorSlide[]>(() => {
    const orderedMedia = draftMedia.slice().sort((left, right) => left.position - right.position);
    if (orderedMedia.length) {
      return orderedMedia.map((media, index) => {
        const savedLayers = canvasLayersBySlide[media.id];
        const layers = (
          savedLayers ?? [
            {
              id: `media-${media.id}`,
              type: "image" as const,
              name: media.media_type === "video" ? "Video clip" : "Photo",
              order: 0,
              x: 0,
              y: 0,
              width: 1080,
              height: studioCanvasHeight,
              rotation: 0,
              opacity: 1,
              blendMode: "normal",
              visible: true,
              locked: false,
              image: {
                id: media.id,
                src: media.preview_url,
                mediaType: media.media_type,
                fit: "cover" as const,
              },
            },
          ]
        ).map((layer) => {
          if (layer.type !== "image" || layer.image?.id !== media.id) return layer;
          const isFullCanvasImage = layer.x === 0 && layer.y === 0 && layer.width === 1080;
          return {
            ...layer,
            ...(isFullCanvasImage ? { height: studioCanvasHeight } : {}),
            image: { ...layer.image, src: media.preview_url },
          };
        });
        return {
          id: media.id,
          order: index,
          duration: 5,
          background: canvasBackgroundsBySlide[media.id] ?? "#fffdf7",
          layers,
        };
      });
    }
    const savedLayers = canvasLayersBySlide["post-body"];
    const layers: PostEditorLayer[] = savedLayers
      ? savedLayers.map((layer) =>
          layer.type === "text" && (layer.id === "post-body-text" || layer.id === "post-body-copy")
            ? {
                ...layer,
                text: {
                  ...layer.text,
                  id: layer.text?.id ?? `${layer.id}-text`,
                  content: body || "Write your post",
                },
              }
            : layer,
        )
      : [
          {
            id: "post-body-text",
            type: "text",
            name: "Post text",
            order: 0,
            x: 100,
            y: Math.round(studioCanvasHeight * 0.42),
            width: 880,
            height: Math.min(340, Math.round(studioCanvasHeight * 0.24)),
            rotation: 0,
            opacity: 1,
            blendMode: "normal",
            visible: true,
            locked: false,
            text: {
              id: "post-body-copy",
              content: body || "Write your post",
              fontFamily: "Inter",
              fontSize: 52,
              fontWeight: 700,
              color: "#1A1A1A",
              align: "center",
              letterSpacing: 0,
              lineHeight: 1.2,
              stroke: null,
              shadow: null,
            },
          },
        ];
    return [
      {
        id: "post-body",
        order: 0,
        duration: 5,
        background: canvasBackgroundsBySlide["post-body"] ?? "#fffdf7",
        layers,
      },
    ];
  }, [body, canvasLayersBySlide, canvasBackgroundsBySlide, draftMedia, studioCanvasHeight]);

  const activeCanvasSlide =
    postCanvasSlides[Math.min(activeCanvasSlideIndex, postCanvasSlides.length - 1)] ??
    postCanvasSlides[0];

  useEffect(() => {
    let active = true;
    void fetchStudioCatalog({ studio: "post", limit: 100 })
      .then((catalog) => {
        if (!active) return;
        setCatalogStickers(catalog.stickers);
        setCanvasLayersBySlide((current) => {
          let changed = false;
          const next = { ...current };
          for (const [slideId, layers] of Object.entries(current)) {
            next[slideId] = layers.map((layer) => {
              const catalogId = layer.image?.id?.startsWith("studio-catalog:")
                ? layer.image.id.slice("studio-catalog:".length)
                : null;
              const latest = catalogId
                ? catalog.stickers.find((sticker) => sticker.id === catalogId)?.assetUrl
                : null;
              if (!latest || !layer.image || layer.image.src === latest) return layer;
              changed = true;
              return { ...layer, image: { ...layer.image, src: latest } };
            });
          }
          if (changed) canvasLayersBySlideRef.current = next;
          return changed ? next : current;
        });
      })
      .catch((cause: unknown) => {
        if (active)
          setCatalogStickerError(
            cause instanceof Error ? cause.message : "The sticker catalog could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const addCatalogSticker = (sticker: StudioStickerAsset) => {
    if (!activeCanvasSlide || !sticker.assetUrl) return;
    const layerId = createUuid();
    const nextLayer: PostEditorLayer = {
      id: layerId,
      slideId: activeCanvasSlide.id,
      type: "image",
      name: sticker.name,
      order: activeCanvasSlide.layers.length,
      x: 390,
      y: 640,
      width: 280,
      height: 280,
      rotation: 0,
      opacity: 1,
      blendMode: "normal",
      visible: true,
      locked: false,
      image: { id: `studio-catalog:${sticker.id}`, src: sticker.assetUrl, fit: "contain" },
    };
    const nextLayers = [...activeCanvasSlide.layers, nextLayer];
    setCanvasLayersBySlide((current) => {
      const next = { ...current, [activeCanvasSlide.id]: nextLayers };
      canvasLayersBySlideRef.current = next;
      backUpDraftLocally({ canvas_layers_by_slide: next });
      return next;
    });
    setSelectedCanvasLayer(nextLayer);
    setStudioSelectedElement("image");
  };

  useEffect(() => {
    setActiveCanvasSlideIndex((index) => Math.min(index, postCanvasSlides.length - 1));
  }, [postCanvasSlides.length]);

  const handleCanvasSelection = useCallback((layer: PostEditorLayer | null) => {
    setSelectedCanvasLayer(layer);
    setStudioSelectedElement(layer ? layer.type : null);
  }, []);

  // Dragging is committed by Canvas on pointer-up. The parent updates its recoverable
  // local draft once per completed gesture rather than for every pointer-move frame.
  const handleCanvasLayersChange = useCallback(
    (layers: PostEditorLayer[]) => {
      if (!activeCanvasSlide) return;
      const nextLayersBySlide = {
        ...canvasLayersBySlideRef.current,
        [activeCanvasSlide.id]: layers,
      };
      canvasLayersBySlideRef.current = nextLayersBySlide;
      setCanvasLayersBySlide(nextLayersBySlide);
      backUpDraftLocally({ canvas_layers_by_slide: nextLayersBySlide });
      if (activeCanvasSlide.id !== "post-body") return;
      const captionLayer = layers.find(
        (layer) => layer.id === "post-body-text" || layer.id === "post-body-copy",
      );
      const updatedBody = captionLayer?.text?.content;
      if (typeof updatedBody === "string" && updatedBody !== body) {
        setHistory((items) => pushHistory(items, body));
        setRedoHistory([]);
        bodyValueRef.current = updatedBody;
        setBody(updatedBody);
        backUpDraftLocally({ body: updatedBody });
      }
      if (selectedCanvasLayer) {
        const selected = layers.find((layer) => layer.id === selectedCanvasLayer.id);
        if (selected) setSelectedCanvasLayer(selected);
      }
    },
    [activeCanvasSlide, body, selectedCanvasLayer],
  );

  const commitStudioLayers = (nextLayers: PostEditorLayer[]) => {
    if (!activeCanvasSlide) return;
    const normalized = nextLayers.map((layer, index) => ({
      ...layer,
      order: index,
      slideId: activeCanvasSlide.id,
    }));
    const nextLayersBySlide = {
      ...canvasLayersBySlideRef.current,
      [activeCanvasSlide.id]: normalized,
    };
    canvasLayersBySlideRef.current = nextLayersBySlide;
    setCanvasLayersBySlide(nextLayersBySlide);
    backUpDraftLocally({ canvas_layers_by_slide: nextLayersBySlide });
    if (selectedCanvasLayer) {
      setSelectedCanvasLayer(
        normalized.find((layer) => layer.id === selectedCanvasLayer.id) ?? null,
      );
    }
  };

  const addStudioLayer = (type: "text" | "shape" | "icon") => {
    if (!activeCanvasSlide) return;
    const id = createUuid();
    const order = activeCanvasSlide.layers.length;
    let layer: PostEditorLayer;
    if (type === "shape") {
      layer = {
        id,
        slideId: activeCanvasSlide.id,
        type: "shape",
        name: "Accent shape",
        order,
        x: 100,
        y: Math.round(studioCanvasHeight * 0.18),
        width: 340,
        height: 170,
        rotation: 0,
        opacity: 1,
        blendMode: "normal",
        visible: true,
        locked: false,
        shape: {
          id: `${id}-shape`,
          shapeType: "rounded-rectangle",
          fill: "#f1dc78",
          stroke: "transparent",
          strokeWidth: 0,
          radius: 28,
        },
      };
    } else {
      const isIcon = type === "icon";
      layer = {
        id,
        slideId: activeCanvasSlide.id,
        type: "text",
        name: isIcon ? "Decorative icon" : "New text",
        order,
        x: 110,
        y: Math.round(studioCanvasHeight * (isIcon ? 0.18 : 0.36)),
        width: isIcon ? 260 : 860,
        height: isIcon ? 180 : 250,
        rotation: 0,
        opacity: 1,
        blendMode: "normal",
        visible: true,
        locked: false,
        text: {
          id: `${id}-text`,
          content: isIcon ? "✦" : "Your headline",
          fontFamily: isIcon ? "Arial, sans-serif" : "Inter, sans-serif",
          fontSize: isIcon ? 132 : 64,
          fontWeight: 700,
          color: isIcon ? "#d1a900" : "#171713",
          align: isIcon ? "center" : "left",
          letterSpacing: 0,
          lineHeight: 1.15,
          stroke: null,
          shadow: null,
        },
      };
    }
    commitStudioLayers([...activeCanvasSlide.layers, layer]);
    setSelectedCanvasLayer(layer);
    setStudioSelectedElement(layer.type);
  };

  const applyCanvasBackground = (color: string) => {
    if (!activeCanvasSlide) return;
    const next = { ...canvasBackgroundsBySlide, [activeCanvasSlide.id]: color };
    setCanvasBackgroundsBySlide(next);
    backUpDraftLocally({ canvas_backgrounds_by_slide: next });
  };

  const handleSelectedLayerChange = (property: string, value: string | number | boolean) => {
    if (!activeCanvasSlide || !selectedCanvasLayer) return;
    const nextLayers = activeCanvasSlide.layers.map((layer) => {
      if (layer.id !== selectedCanvasLayer.id) return layer;
      if (property.startsWith("image.")) {
        const key = property.slice(6);
        return {
          ...layer,
          image: {
            ...(layer.image ?? { id: `${layer.id}-image`, src: "", fit: "cover" as const }),
            [key]: value,
          },
        } as PostEditorLayer;
      }
      if (property.startsWith("shape.")) {
        const key = property.slice(6);
        return {
          ...layer,
          shape: { ...(layer.shape ?? { id: `${layer.id}-shape` }), [key]: value },
        } as PostEditorLayer;
      }
      return { ...layer, [property]: value } as PostEditorLayer;
    });
    commitStudioLayers(nextLayers);
    const updated = nextLayers.find((layer) => layer.id === selectedCanvasLayer.id);
    if (updated) setSelectedCanvasLayer(updated);
  };

  const handleSelectedTextChange = (prop: string, value: string | number) => {
    if (!activeCanvasSlide || !selectedCanvasLayer) return;
    const target = activeCanvasSlide.layers.find((layer) => layer.id === selectedCanvasLayer.id);
    if (!target || target.type !== "text") return;
    const nextLayers = activeCanvasSlide.layers.map((layer) => {
      if (layer.id !== target.id) return layer;
      const text = { ...(layer.text ?? { id: `${layer.id}-text`, content: "" }) };
      if (prop === "fontFamily") text.fontFamily = String(value);
      else if (prop === "fontSize") text.fontSize = Number(value);
      else if (prop === "fontWeight") text.fontWeight = Number(value);
      else if (prop === "color") text.color = String(value);
      else if (prop === "align" && ["left", "center", "right"].includes(String(value)))
        text.align = value as "left" | "center" | "right";
      else if (prop === "lineHeight") text.lineHeight = Number(value);
      else if (prop === "letterSpacing") text.letterSpacing = Number(value);
      return { ...layer, text };
    });
    commitStudioLayers(nextLayers);
    const updated = nextLayers.find((layer) => layer.id === target.id);
    if (updated) setSelectedCanvasLayer(updated);
  };

  const handleLayerDelete = (id: string) => {
    if (!activeCanvasSlide) return;
    commitStudioLayers(activeCanvasSlide.layers.filter((layer) => layer.id !== id));
    if (selectedCanvasLayer?.id === id) {
      setSelectedCanvasLayer(null);
      setStudioSelectedElement(null);
    }
  };

  const handleLayerDuplicate = (id: string) => {
    if (!activeCanvasSlide) return;
    const source = activeCanvasSlide.layers.find((layer) => layer.id === id);
    if (!source) return;
    const duplicate: PostEditorLayer = {
      ...source,
      id: createUuid(),
      name: `${source.name} copy`,
      x: source.x + 24,
      y: source.y + 24,
      order: activeCanvasSlide.layers.length,
      text: source.text ? { ...source.text, id: createUuid() } : source.text,
      image: source.image ? { ...source.image } : source.image,
      shape: source.shape ? { ...source.shape, id: createUuid() } : source.shape,
    };
    commitStudioLayers([...activeCanvasSlide.layers, duplicate]);
    setSelectedCanvasLayer(duplicate);
    setStudioSelectedElement(duplicate.type);
  };

  const applyTemplateToCanvas = (templateId: string) => {
    const template = studioTemplates.find((item) => item.id === templateId);
    if (!template || !activeCanvasSlide) return;
    const palette = template.palette?.length ? template.palette : ["#e8d77e", "#fffdf7", "#202019"];
    const background = palette[1] || "#fffdf7";
    const foreground = palette[2] || "#202019";
    const accent = palette[0] || "#e8d77e";
    const baseMediaLayers = activeCanvasSlide.layers
      .filter((layer) => layer.type === "image" && layer.id === `media-${activeCanvasSlide.id}`)
      .map((layer, index) => ({ ...layer, order: index, slideId: activeCanvasSlide.id }));
    const baseOrder = baseMediaLayers.length;
    const newLayers: PostEditorLayer[] = [
      ...baseMediaLayers,
      {
        id: createUuid(),
        slideId: activeCanvasSlide.id,
        type: "shape",
        name: "Template accent",
        order: baseOrder,
        x: 82,
        y: Math.round(studioCanvasHeight * 0.16),
        width: 212,
        height: 14,
        rotation: 0,
        opacity: 1,
        blendMode: "normal",
        visible: true,
        locked: false,
        shape: {
          id: createUuid(),
          shapeType: "rounded-rectangle",
          fill: accent,
          stroke: "transparent",
          strokeWidth: 0,
          radius: 7,
        },
      },
      {
        id: createUuid(),
        slideId: activeCanvasSlide.id,
        type: "text",
        name: "Template headline",
        order: baseOrder + 1,
        x: 82,
        y: Math.round(studioCanvasHeight * 0.24),
        width: 920,
        height: 200,
        rotation: 0,
        opacity: 1,
        blendMode: "normal",
        visible: true,
        locked: false,
        text: {
          id: createUuid(),
          content: template.name.replace(/\s+\d+$/, ""),
          fontFamily: "Inter, sans-serif",
          fontSize: 72,
          fontWeight: 800,
          color: foreground,
          align: "left",
          letterSpacing: -1,
          lineHeight: 1.08,
          stroke: null,
          shadow: null,
        },
      },
      {
        id: createUuid(),
        slideId: activeCanvasSlide.id,
        type: "text",
        name: "Template copy",
        order: baseOrder + 2,
        x: 84,
        y: Math.round(studioCanvasHeight * 0.43),
        width: 860,
        height: 260,
        rotation: 0,
        opacity: 1,
        blendMode: "normal",
        visible: true,
        locked: false,
        text: {
          id: createUuid(),
          content: template.content || "Your idea starts here. Replace this copy with your own.",
          fontFamily: "Inter, sans-serif",
          fontSize: 36,
          fontWeight: 500,
          color: foreground,
          align: "left",
          letterSpacing: 0,
          lineHeight: 1.35,
          stroke: null,
          shadow: null,
        },
      },
    ];
    const nextBody =
      template.content?.trim() ||
      `${template.name.replace(/\s+\d+$/, "")}\n\nYour idea starts here. Replace this copy with your own.`;
    setHistory((items) => pushHistory(items, body));
    setRedoHistory([]);
    bodyValueRef.current = nextBody;
    setBody(nextBody);
    const backgrounds = { ...canvasBackgroundsBySlide, [activeCanvasSlide.id]: background };
    setCanvasBackgroundsBySlide(backgrounds);
    commitStudioLayers(newLayers);
    setSelectedCanvasLayer(newLayers[baseOrder + 1]);
    setStudioSelectedElement("text");
    backUpDraftLocally({
      body: nextBody,
      canvas_layers_by_slide: {
        ...canvasLayersBySlideRef.current,
        [activeCanvasSlide.id]: newLayers,
      },
      canvas_backgrounds_by_slide: backgrounds,
    });
  };

  const saveStatus =
    saveIndicator === "Saved" ? "saved" : saveIndicator.startsWith("Saving") ? "saving" : "unsaved";
  function chooseMediaMode(mode: "photo" | "video" | "carousel") {
    setMediaMode(mode);
    const input = mediaInputRef.current;
    if (!input) return;
    input.accept = mode === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp";
    input.multiple = mode === "carousel";
    input.click();
  }
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (command && event.key.toLowerCase() === "k" && !typing) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => {
    if (!draftLoaded || !user || !canEditCollaboration) return;
    const timer = window.setInterval(() => {
      if (bodyValueRef.current.trim()) void persistDraftRef.current();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draftLoaded, user, canEditCollaboration]);
  const handleRemoteDraft = useCallback(
    (remote: { body: string; version_number: number; collaboration_status?: string }) => {
      if (remote.collaboration_status) setDraftWorkflowStatus(remote.collaboration_status);
      if (remote.body === bodyValueRef.current) return;
      if (collaborationDirtyRef.current) setRemoteDraft(remote);
      else {
        bodyValueRef.current = remote.body;
        setBody(remote.body);
        setDraftStatus("Updated from a collaborator.");
      }
    },
    [],
  );
  const handleRemoteCursor = useCallback(
    (cursor: { user_id: string; display_name: string; color: string; x: number; y: number }) => {
      if (!user || cursor.user_id === user.id) return;
      setRemoteCursors((current) => [
        ...current.filter((item) => item.user_id !== cursor.user_id),
        cursor,
      ]);
    },
    [user],
  );
  const handleCollaborationChannel = useCallback((channel: PostDraftChannel) => {
    collabChannelRef.current = channel;
  }, []);

  useEffect(() => {
    if (!inviteToken) {
      setInviteReady(true);
      return;
    }
    if (loading || !user) return;
    setInviteReady(false);
    let active = true;
    void supabase
      .rpc("redeem_post_draft_share", { raw_token: inviteToken })
      .then(({ data, error: inviteError }) => {
        if (!active) return;
        if (inviteError) setError(friendlyError(inviteError));
        else if (requestedDraftId && data !== requestedDraftId)
          setError("This collaboration link does not match the requested draft.");
        setInviteReady(true);
      });
    return () => {
      active = false;
    };
  }, [inviteToken, requestedDraftId, user, loading]);

  useEffect(() => {
    if (!user) {
      setPreviewProfile(null);
      return;
    }
    let active = true;
    void supabase
      .from("profiles")
      .select("display_name,username,avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setPreviewProfile(data);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    setPreviewConfirmed(false);
  }, [body, draftMedia]);

  function replaceDraftMedia(items: DraftMediaRecord[]) {
    draftMediaRef.current = items;
    setDraftMedia(items);
  }

  function backUpDraftLocally(changes: Partial<LocalPostDraftBackup> = {}) {
    if (!user) return;
    const id = draftId || createUuid();
    setDraftId(id);
    try {
      localStorage.setItem(
        `velori-post-draft:${user.id}`,
        JSON.stringify({
          id,
          body,
          visibility,
          allow_comments: allowComments,
          allow_likes: allowLikes,
          hide_like_count: hideLikeCount,
          allow_sharing: allowSharing,
          canvas_layers_by_slide: canvasLayersBySlideRef.current,
          canvas_backgrounds_by_slide: canvasBackgroundsBySlide,
          updated_at: new Date().toISOString(),
          ...changes,
        } satisfies LocalPostDraftBackup),
      );
    } catch {
      setDraftStatus("Browser recovery storage is unavailable; use Save draft before leaving.");
    }
  }

  useEffect(() => {
    if (loading || !inviteReady) return;
    if (!user) {
      setDraftLoaded(true);
      return;
    }
    const localBackup = readLocalPostDraftBackup(`velori-post-draft:${user.id}`);
    if (!requestedDraftId) {
      if (localBackup) {
        setDraftId(localBackup.id);
        setDraftOwnerId(user.id);
        setCollaborationRole("owner");
        setBody(localBackup.body);
        setCanvasLayersBySlide(localBackup.canvas_layers_by_slide ?? {});
        setCanvasBackgroundsBySlide(localBackup.canvas_backgrounds_by_slide ?? {});
        setVisibility(localBackup.visibility);
        setAllowComments(localBackup.allow_comments);
        setAllowLikes(localBackup.allow_likes);
        setHideLikeCount(localBackup.hide_like_count);
        setAllowSharing(localBackup.allow_sharing);
        setDraftStatus("Recovered a recent draft from this device; syncing it to your account.");
        if (localBackup.id) {
          void loadDraftMedia(localBackup.id)
            .then(replaceDraftMedia)
            .catch(() =>
              setDraftStatus("Draft text restored. Reconnect to reload its uploaded media."),
            );
        }
      }
      setDraftLoaded(true);
      return;
    }
    let active = true;
    void supabase
      .from("post_drafts")
      .select(
        "id,author_id,body,visibility,allow_comments,allow_likes,hide_like_count,allow_sharing,updated_at,collaboration_status",
      )
      .eq("id", requestedDraftId)
      .maybeSingle()
      .then(({ data, error: draftError }) => {
        if (!active) return;
        if ((draftError || !data) && localBackup && localBackup.id === requestedDraftId) {
          setDraftId(localBackup.id);
          setDraftOwnerId(user.id);
          setBody(localBackup.body);
          setCanvasLayersBySlide(localBackup.canvas_layers_by_slide ?? {});
          setVisibility(localBackup.visibility);
          setAllowComments(localBackup.allow_comments);
          setAllowLikes(localBackup.allow_likes);
          setHideLikeCount(localBackup.hide_like_count);
          setAllowSharing(localBackup.allow_sharing);
          setDraftStatus("Recovered the unsynced draft from this device.");
          if (draftError) setError("");
        } else if (draftError) {
          setError(friendlyError(draftError));
        } else if (!data) {
          setError("That draft does not exist or belongs to another account.");
        } else {
          const restoreLocal = Boolean(
            localBackup &&
            localBackup.id === data.id &&
            Date.parse(localBackup.updated_at) > Date.parse(data.updated_at),
          );
          setDraftId(data.id);
          setDraftOwnerId(data.author_id);
          setDraftWorkflowStatus(data.collaboration_status || "draft");
          setCollaborationRole(data.author_id === user.id ? "owner" : "viewer");
          setBody(restoreLocal && localBackup ? localBackup.body : data.body);
          if (restoreLocal && localBackup) {
            setCanvasLayersBySlide(localBackup.canvas_layers_by_slide ?? {});
          }
          setVisibility(restoreLocal && localBackup ? localBackup.visibility : data.visibility);
          setAllowComments(
            restoreLocal && localBackup ? localBackup.allow_comments : data.allow_comments,
          );
          setAllowLikes(restoreLocal && localBackup ? localBackup.allow_likes : data.allow_likes);
          setHideLikeCount(
            restoreLocal && localBackup ? localBackup.hide_like_count : data.hide_like_count,
          );
          setAllowSharing(
            restoreLocal && localBackup ? localBackup.allow_sharing : data.allow_sharing,
          );
          if (restoreLocal) setDraftStatus("Recovered a newer unsynced edit from this device.");
        }
        if (data) {
          void loadDraftMedia(data.id)
            .then(replaceDraftMedia)
            .catch((mediaError) => setError(friendlyError(mediaError)));
        } else if (localBackup?.id === requestedDraftId) {
          void loadDraftMedia(requestedDraftId)
            .then(replaceDraftMedia)
            .catch(() =>
              setDraftStatus("Draft text restored. Reconnect to reload its uploaded media."),
            );
        }
        setDraftLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [loading, inviteReady, user, requestedDraftId]);

  const persistDraft = useCallback(async () => {
    if (!user) return null;
    const id = draftId || createUuid();
    setDraftId(id);
    setDraftStatus("Saving draft…");
    setSaveIndicator("Saving…");
    const saveOperation = draftSaveRef.current
      .catch(() => undefined)
      .then(async () => {
        const { error: saveError } = await supabase.from("post_drafts").upsert(
          {
            id,
            author_id: draftOwnerId || user.id,
            body,
            visibility,
            allow_comments: allowComments,
            allow_likes: allowLikes,
            hide_like_count: hideLikeCount,
            allow_sharing: allowSharing,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (saveError) throw saveError;
      });
    draftSaveRef.current = saveOperation;
    try {
      await saveOperation;
      if (bodyValueRef.current === body) {
        setCollaborationDirty(false);
        collaborationDirtyRef.current = false;
      }
      setDraftOwnerId((current) => current || user.id);
      setDraftStatus("Draft saved to your account.");
      setSaveIndicator("Saved");
      const backup = readLocalPostDraftBackup(localDraftKey);
      if (
        backup &&
        backup.id === id &&
        backup.body === body &&
        backup.visibility === visibility &&
        backup.allow_comments === allowComments &&
        backup.allow_likes === allowLikes &&
        backup.hide_like_count === hideLikeCount &&
        backup.allow_sharing === allowSharing
      ) {
        try {
          localStorage.removeItem(localDraftKey);
        } catch {
          // The server copy remains authoritative if browser cleanup is blocked.
        }
      }
      return id;
    } catch (cause) {
      setDraftStatus("");
      setSaveIndicator("Save failed — retry when connected");
      setError(friendlyError(cause as { code?: string; message?: string }));
      return null;
    }
  }, [
    user,
    draftId,
    draftOwnerId,
    body,
    visibility,
    allowComments,
    allowLikes,
    hideLikeCount,
    allowSharing,
    localDraftKey,
  ]);
  persistDraftRef.current = persistDraft;

  async function addPostMedia(file: File) {
    if (!user || mediaBusy || !canEditCollaboration) return false;
    if (draftMediaRef.current.length >= 10) {
      setError("A post can contain up to 10 images or videos.");
      return false;
    }
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const isVideo = file.type === "video/mp4";
    if (!isImage && !isVideo) {
      setError("Choose JPEG, PNG, or WebP images, or MP4 videos.");
      return false;
    }
    if ((isImage && file.size > 15 * 1024 * 1024) || (isVideo && file.size > 100 * 1024 * 1024)) {
      setError(
        isImage
          ? "Choose an image smaller than 15 MB."
          : "Choose an MP4 video smaller than 100 MB.",
      );
      return false;
    }
    if (isVideo) {
      const brand = new TextDecoder().decode(await file.slice(4, 8).arrayBuffer());
      if (brand !== "ftyp") {
        setError("This file is not a valid MP4 video.");
        return false;
      }
    }

    setMediaBusy(true);
    setUploadProgress(0);
    setError("");
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    let rowId = "";
    let objectPath = "";
    let mediaFile = file;
    try {
      if (isImage) mediaFile = await optimizePostImage(file);
      const activeDraftId = await persistDraft();
      if (!activeDraftId) return false;
      const extension = isVideo ? "mp4" : "webp";
      objectPath = `${user.id}/${activeDraftId}/${createUuid()}.${extension}`;
      const currentMedia = draftMediaRef.current;
      const usedPositions = new Set(currentMedia.map((item) => item.position));
      let position = 0;
      while (usedPositions.has(position)) position += 1;
      const { data: row, error: rowError } = await supabase
        .from("post_draft_media")
        .insert({
          draft_id: activeDraftId,
          author_id: user.id,
          object_path: objectPath,
          media_type: isVideo ? "video" : "image",
          position,
          alt_text: "",
        })
        .select("id")
        .single();
      if (rowError) throw rowError;
      rowId = row.id;
      await uploadPostMedia(objectPath, mediaFile, controller.signal, setUploadProgress);
      const { data: signed, error: signedError } = await supabase.storage
        .from("post-media")
        .createSignedUrl(objectPath, 3600);
      if (signedError) throw signedError;
      replaceDraftMedia([
        ...currentMedia,
        {
          id: row.id,
          draft_id: activeDraftId,
          object_path: objectPath,
          media_type: isVideo ? "video" : "image",
          position,
          alt_text: "",
          preview_url: signed.signedUrl,
        },
      ]);
      setDraftStatus("Media uploaded to your private draft.");
      return true;
    } catch (cause) {
      if (rowId && objectPath) {
        await supabase.storage.from("post-media").remove([objectPath]);
      }
      if (rowId) {
        await supabase.from("post_draft_media").delete().eq("id", rowId).eq("author_id", user.id);
      }
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setDraftStatus("Upload canceled. Your saved draft is still here.");
      } else {
        setError(friendlyError(cause as { code?: string; message?: string }));
      }
      return false;
    } finally {
      setMediaBusy(false);
      setUploadProgress(null);
      uploadAbortRef.current = null;
    }
  }

  async function removeDraftMedia(item: DraftMediaRecord) {
    if (mediaBusy || !canEditCollaboration) return;
    setMediaBusy(true);
    setError("");
    const { error: removeError } = await supabase.storage
      .from("post-media")
      .remove([item.object_path]);
    if (removeError) {
      setMediaBusy(false);
      setError(friendlyError(removeError));
      return;
    }
    const { error: rowError } = await supabase.from("post_draft_media").delete().eq("id", item.id);
    if (rowError) setError(friendlyError(rowError));
    else replaceDraftMedia(draftMediaRef.current.filter((media) => media.id !== item.id));
    setMediaBusy(false);
  }

  async function reorderDraftMedia(item: DraftMediaRecord, direction: -1 | 1) {
    const ordered = draftMedia.slice().sort((left, right) => left.position - right.position);
    const index = ordered.findIndex((media) => media.id === item.id);
    const nextIndex = index + direction;
    if (
      index < 0 ||
      nextIndex < 0 ||
      nextIndex >= ordered.length ||
      mediaBusy ||
      !canEditCollaboration
    )
      return;
    const first = ordered[index];
    const second = ordered[nextIndex];
    setMediaBusy(true);
    const firstResult = await supabase
      .from("post_draft_media")
      .update({ position: second.position })
      .eq("id", first.id);
    const secondResult = firstResult.error
      ? { error: firstResult.error }
      : await supabase
          .from("post_draft_media")
          .update({ position: first.position })
          .eq("id", second.id);
    if (firstResult.error || secondResult.error) {
      setError(friendlyError(firstResult.error || secondResult.error));
      if (draftId)
        void loadDraftMedia(draftId)
          .then(replaceDraftMedia)
          .catch(() => {});
    } else {
      replaceDraftMedia(
        draftMediaRef.current.map((media) =>
          media.id === first.id
            ? { ...media, position: second.position }
            : media.id === second.id
              ? { ...media, position: first.position }
              : media,
        ),
      );
    }
    setMediaBusy(false);
  }

  async function saveMediaAltText(item: DraftMediaRecord, altText: string) {
    if (!canEditCollaboration) return;
    replaceDraftMedia(
      draftMediaRef.current.map((media) =>
        media.id === item.id ? { ...media, alt_text: altText } : media,
      ),
    );
    const { error: altError } = await supabase
      .from("post_draft_media")
      .update({ alt_text: altText })
      .eq("id", item.id);
    if (altError) {
      replaceDraftMedia(
        draftMediaRef.current.map((media) =>
          media.id === item.id ? { ...media, alt_text: item.alt_text } : media,
        ),
      );
      setError(friendlyError(altError));
    }
  }

  useEffect(() => {
    if (!draftLoaded || !user || busy || !body.trim() || !canEditCollaboration) return;
    const timer = window.setTimeout(() => void persistDraft(), 700);
    return () => window.clearTimeout(timer);
  }, [draftLoaded, user, busy, body, persistDraft, canEditCollaboration]);
  if (loading)
    return (
      <div className="narrow-page">
        <div className="skeleton-card" />
      </div>
    );
  if (!user)
    return (
      <div className="narrow-page">
        <EmptyState
          icon={LockKeyhole}
          title="Your voice belongs here"
          text="Sign in to share something with the VELORI community."
          action="Sign in"
          to="/login"
        />
      </div>
    );
  if (!draftLoaded)
    return (
      <div className="narrow-page">
        <div className="skeleton-card" aria-label="Loading your draft" />
      </div>
    );
  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!user || !body.trim() || mediaBusy || !canEditCollaboration) return;
    setBusy(true);
    setError("");
    let mediaRows: Pick<
      DraftMediaRecord,
      "object_path" | "media_type" | "position" | "alt_text"
    >[] = [];
    if (draftId) {
      const { data: stagedMedia, error: mediaError } = await supabase
        .from("post_draft_media")
        .select("object_path,media_type,position,alt_text")
        .eq("draft_id", draftId)
        .eq("author_id", user.id)
        .order("position");
      if (mediaError) {
        setBusy(false);
        setError(friendlyError(mediaError));
        return;
      }
      mediaRows = (stagedMedia || []) as typeof mediaRows;
    }
    const { data, error: dbError } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        body: body.trim(),
        visibility,
        allow_comments: allowComments,
        allow_likes: allowLikes,
        hide_like_count: hideLikeCount,
        allow_sharing: allowSharing,
        is_published: false,
      })
      .select("id")
      .single();
    if (dbError) {
      setBusy(false);
      setError(friendlyError(dbError));
    } else {
      if (mediaRows.length) {
        const { error: mediaError } = await supabase.from("post_media").insert(
          mediaRows.map((media) => ({
            ...media,
            post_id: data.id,
            author_id: user.id,
          })),
        );
        if (mediaError) {
          await supabase.from("posts").delete().eq("id", data.id);
          setBusy(false);
          setError(friendlyError(mediaError));
          return;
        }
      }
      const { error: publishError } = await supabase
        .from("posts")
        .update({ is_published: true })
        .eq("id", data.id)
        .eq("author_id", user.id);
      if (publishError) {
        await supabase.from("posts").delete().eq("id", data.id);
        setBusy(false);
        setError(friendlyError(publishError));
        return;
      }
      await draftSaveRef.current.catch(() => undefined);
      if (draftId) {
        const { data: currentDraft, error: stateError } = await supabase
          .from("post_drafts")
          .select("collaboration_status")
          .eq("id", draftId)
          .eq("author_id", user.id)
          .maybeSingle();
        if (stateError)
          setError(
            `Your post is live, but its collaboration state could not be updated: ${friendlyError(stateError)}`,
          );
        else {
          const route =
            currentDraft?.collaboration_status === "draft"
              ? ["in_review", "approved", "published"]
              : currentDraft?.collaboration_status === "in_review"
                ? ["approved", "published"]
                : currentDraft?.collaboration_status === "approved" ||
                    currentDraft?.collaboration_status === "scheduled"
                  ? ["published"]
                  : [];
          for (const nextStatus of route) {
            const { error: statusError } = await supabase.rpc(
              "set_post_draft_collaboration_status",
              {
                target_draft: draftId,
                next_status: nextStatus,
                schedule_for: null,
              },
            );
            if (statusError) {
              setError(
                `Your post is live, but its collaboration history could not be finalized: ${friendlyError(statusError)}`,
              );
              break;
            }
          }
        }
      }
      try {
        localStorage.removeItem(localDraftKey);
      } catch {
        // Browser recovery data is only a fallback; the published post is authoritative.
      }
      setBusy(false);
      navigate(`/post/${data.id}`);
    }
  }
  const handleStudioToolSelect = (toolName: string) => {
    setActiveStudioTool(toolName);
    if (toolName === "Image") {
      chooseMediaMode("photo");
      mediaInputRef.current?.click();
    } else if (toolName === "Text") addStudioLayer("text");
    else if (toolName === "Shape") addStudioLayer("shape");
    else if (toolName === "Icon") addStudioLayer("icon");
    else if (toolName === "Background") setShowBackgroundPicker((open) => !open);
    else if (toolName === "Sticker") setShowStickerLibrary((open) => !open);
  };

  return (
    <StudioShell
      style={creatorTheme}
      projectName={body.trim().split(/\r?\n/, 1)[0]?.slice(0, 60) || "New post"}
      selectedElement={studioSelectedElement}
      saveStatus={saveStatus}
      zoom={studioZoom}
      onMobileToolSelect={handleStudioToolSelect}
      leftPanelContent={{
        tools: (
          <ToolsTab
            studio="post"
            activeTool={activeStudioTool}
            onSelectTool={handleStudioToolSelect}
          />
        ),
        media: (
          <MediaTab
            assets={draftMedia.map((media) => ({
              id: media.id,
              name: media.alt_text || (media.media_type === "video" ? "Video" : "Photo"),
              kind: media.media_type === "video" ? "video" : "photo",
              thumbnailUrl: media.preview_url,
            }))}
            onAssetSelect={(assetId) => {
              const index = postCanvasSlides.findIndex((slide) => slide.id === assetId);
              if (index >= 0) setActiveCanvasSlideIndex(index);
            }}
            onUpload={(files) => {
              void (async () => {
                for (const file of files) {
                  if (draftMediaRef.current.length >= 10) {
                    setError("A post can contain up to 10 images or videos.");
                    break;
                  }
                  if (!(await addPostMedia(file))) break;
                }
              })();
            }}
          />
        ),
        templates: (
          <TemplatesTab
            templates={studioTemplates}
            selectedTemplateId={selectedStudioTemplateId}
            onTemplateSelect={(templateId) => {
              setSelectedStudioTemplateId(templateId);
              applyTemplateToCanvas(templateId);
            }}
          />
        ),
        brand: (
          <>
            <BrandTab
              brandKit={studioBrandKit}
              onApplyBrand={(kit) => {
                const colors =
                  kit?.colors?.map((item) => item.hex) ??
                  studioBrandKit.colors.map((item) => item.hex);
                const fonts =
                  kit?.fonts?.map((item) => item.name) ??
                  studioBrandKit.fonts.map((item) => item.name);
                if (!selectedCanvasLayer) {
                  applyCanvasBackground(colors[0] || "#fffdf7");
                  return;
                }
                if (selectedCanvasLayer.type === "text") {
                  if (colors[1] || colors[0])
                    handleSelectedTextChange("color", colors[1] || colors[0]);
                  if (fonts[0]) handleSelectedTextChange("fontFamily", fonts[0]);
                } else if (selectedCanvasLayer.type === "shape" && colors[0]) {
                  handleSelectedLayerChange("shape.fill", colors[0]);
                } else if (selectedCanvasLayer.type === "image") {
                  setDraftStatus(
                    "Brand palette saved. Select a text or shape layer to apply brand color directly.",
                  );
                }
              }}
            />
            <details className="post-studio-template-disclosure">
              <summary>Brand kit and saved templates</summary>
              <BrandTemplates
                body={body}
                onApply={(text) => {
                  setHistory((items) => pushHistory(items, body));
                  setRedoHistory([]);
                  bodyValueRef.current = text;
                  setBody(text);
                  backUpDraftLocally({ body: text });
                }}
              />
            </details>
          </>
        ),
      }}
      rightPanelContent={
        studioSelectedElement === null ? (
          <PreviewPanel
            previewContent={
              <div className="studio-post-preview-content">
                {draftMedia[0]?.preview_url && <img src={draftMedia[0].preview_url} alt="" />}
                <p>{body || "Your post preview appears here."}</p>
              </div>
            }
            platform={studioPlatform}
            onPlatformChange={setStudioPlatform}
          />
        ) : selectedCanvasLayer?.type === "text" ? (
          <>
            <TextProperties
              customFonts={
                selectedCanvasLayer.text?.fontFamily ? [selectedCanvasLayer.text.fontFamily] : []
              }
              textElement={{
                fontFamily: selectedCanvasLayer.text?.fontFamily,
                fontSize: selectedCanvasLayer.text?.fontSize,
                fontWeight: selectedCanvasLayer.text?.fontWeight,
                color: selectedCanvasLayer.text?.color ?? "#171713",
                align: selectedCanvasLayer.text?.align,
                lineHeight: selectedCanvasLayer.text?.lineHeight,
                letterSpacing: selectedCanvasLayer.text?.letterSpacing,
              }}
              onChange={handleSelectedTextChange}
              onDuplicate={() => handleLayerDuplicate(selectedCanvasLayer.id)}
              onDelete={() => handleLayerDelete(selectedCanvasLayer.id)}
            />
            <LayerProperties
              layer={selectedCanvasLayer}
              showAppearance={false}
              onChange={handleSelectedLayerChange}
              onDuplicate={() => handleLayerDuplicate(selectedCanvasLayer.id)}
              onDelete={() => handleLayerDelete(selectedCanvasLayer.id)}
              onLockToggle={() => handleSelectedLayerChange("locked", !selectedCanvasLayer.locked)}
              onVisibilityToggle={() =>
                handleSelectedLayerChange("visible", !selectedCanvasLayer.visible)
              }
            />
          </>
        ) : selectedCanvasLayer ? (
          <LayerProperties
            layer={selectedCanvasLayer}
            onChange={handleSelectedLayerChange}
            onDuplicate={() => handleLayerDuplicate(selectedCanvasLayer.id)}
            onDelete={() => handleLayerDelete(selectedCanvasLayer.id)}
            onLockToggle={() => handleSelectedLayerChange("locked", !selectedCanvasLayer.locked)}
            onVisibilityToggle={() =>
              handleSelectedLayerChange("visible", !selectedCanvasLayer.visible)
            }
          />
        ) : null
      }
      onSave={() => {
        void persistDraft();
      }}
      onBack={() => navigate("/home")}
      onPreview={() => setPreviewOpen(true)}
      onPublish={() => publishFormRef.current?.requestSubmit()}
      onRename={(name) => {
        const lines = body.split(/\r?\n/);
        const updated = [name, ...lines.slice(1)].join("\n");
        setHistory((items) => pushHistory(items, body));
        setRedoHistory([]);
        bodyValueRef.current = updated;
        setBody(updated);
        backUpDraftLocally({ body: updated });
      }}
      onUndo={() => {
        const previous = history.at(-1);
        if (previous === undefined) return;
        setHistory((items) => items.slice(0, -1));
        setRedoHistory((items) => pushHistory(items, body));
        bodyValueRef.current = previous;
        setBody(previous);
      }}
      onRedo={() => {
        const next = redoHistory.at(-1);
        if (next === undefined) return;
        setRedoHistory((items) => items.slice(0, -1));
        setHistory((items) => pushHistory(items, body));
        bodyValueRef.current = next;
        setBody(next);
      }}
      onSnapChange={setStudioSnapToGrid}
      onSafeZoneChange={setStudioSafeZone}
      onZoomReset={() => setStudioFitRequest((request) => request + 1)}
    >
      <div className="narrow-page post-compose-page post-studio-compose">
        <div className="post-studio-canvas-stage">
          <label className="post-studio-canvas-heading">
            Aspect ratio
            <select
              aria-label="Canvas aspect ratio"
              value={studioAspectRatio}
              onChange={(event) =>
                setStudioAspectRatio(event.target.value as PostEditorAspectRatio)
              }
            >
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
          </label>
          {showBackgroundPicker && (
            <section className="post-studio-background-picker" aria-label="Canvas background">
              <div>
                <span className="post-studio-panel-eyebrow">CANVAS</span>
                <strong>Background color</strong>
              </div>
              <div className="post-studio-background-swatches">
                {[
                  "#fffdf7",
                  "#f7f1df",
                  "#f1dc78",
                  "#e9e3d3",
                  "#f8e1e5",
                  "#dce7f1",
                  "#202019",
                  "#ffffff",
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set background ${color}`}
                    aria-pressed={activeCanvasSlide?.background === color}
                    style={{ backgroundColor: color }}
                    onClick={() => applyCanvasBackground(color)}
                  />
                ))}
                <label className="post-studio-custom-color">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={canvasBackgroundsBySlide[activeCanvasSlide?.id ?? ""] ?? "#fffdf7"}
                    onChange={(event) => applyCanvasBackground(event.target.value)}
                  />
                </label>
              </div>
              <p>
                Backgrounds are saved in this browser's recovery draft. The current server draft and
                publish schema do not sync canvas layers/backgrounds yet.
              </p>
            </section>
          )}
          {showStickerLibrary && (
            <details
              className="post-studio-sticker-disclosure"
              open={showStickerLibrary}
              onToggle={(event) => setShowStickerLibrary(event.currentTarget.open)}
            >
              <summary>Sticker library</summary>
              <section className="post-studio-sticker-library" aria-label="Published stickers">
                <div>
                  <strong>Published stickers</strong>
                  <input
                    aria-label="Search published stickers"
                    placeholder="Search stickers"
                    value={stickerSearch}
                    onChange={(event) => setStickerSearch(event.target.value)}
                  />
                </div>
                {catalogStickerError ? <p role="alert">{catalogStickerError}</p> : null}
                <div className="post-studio-sticker-options">
                  {catalogStickers
                    .filter((item) =>
                      `${item.name} ${item.category} ${item.searchAliases.join(" ")} ${item.tags.join(" ")}`
                        .toLowerCase()
                        .includes(stickerSearch.toLowerCase()),
                    )
                    .map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        disabled={!sticker.assetUrl}
                        title={
                          sticker.assetUrl
                            ? `Add ${sticker.name}`
                            : "This sticker has no published asset file yet"
                        }
                        aria-label={`Add sticker: ${sticker.name}`}
                        onClick={() => addCatalogSticker(sticker)}
                      >
                        <img
                          src={sticker.thumbnailUrl || sticker.assetUrl || ""}
                          alt={sticker.altText || sticker.name}
                        />
                        <span>{sticker.name}</span>
                      </button>
                    ))}
                </div>
                {!catalogStickers.length && !catalogStickerError ? (
                  <p>No published stickers are available for Post Studio.</p>
                ) : null}
              </section>
            </details>
          )}
          <div
            className="post-studio-canvas-frame"
            style={{ aspectRatio: studioAspectRatio.replace(":", " / ") }}
          >
            <PostEditorCanvas
              key={activeCanvasSlide?.id ?? "post-canvas"}
              slide={activeCanvasSlide}
              selectedLayerId={selectedCanvasLayer?.id ?? null}
              showSafeZone={studioSafeZone}
              showGrid={false}
              snapToGrid={studioSnapToGrid}
              zoom={studioZoom}
              workspaceHeight="100%"
              workspaceStyle={{
                border: 0,
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-md)",
              }}
              showToolbar
              showLayersPanel={false}
              selectFirstLayer={false}
              onZoomChange={setStudioZoom}
              onSelectionChange={handleCanvasSelection}
              onLayersPanelChange={setStudioLayersPanel}
              onLayersChange={handleCanvasLayersChange}
              canvasHeight={studioCanvasHeight}
              fitRequest={studioFitRequest}
            />
          </div>
          <div className="post-studio-slide-dots" aria-label="Carousel slides">
            {postCanvasSlides.map((slide, index) => (
              <button
                key={slide.id}
                className="post-studio-slide-dot"
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeCanvasSlideIndex}
                onClick={() => {
                  setActiveCanvasSlideIndex(index);
                  setSelectedCanvasLayer(null);
                  setStudioSelectedElement(null);
                }}
              />
            ))}
          </div>
          <p className="post-studio-local-layout-note">
            Canvas layers and background are saved in this browser’s recovery draft. Uploaded media,
            caption, privacy, and interaction settings use the existing server draft and publishing
            workflow. Final published media is not yet flattened from the canvas composition.
          </p>
          {studioLayersPanel && (
            <div className="post-studio-layer-panel-wrap" aria-label="Canvas layer controls">
              <LayersPanel {...studioLayersPanel} />
            </div>
          )}
        </div>
        {tourStep > 0 && (
          <aside className="post-editor-tour" role="dialog" aria-label="Post editor tour">
            <div>
              <span>STEP {tourStep} OF 5</span>
              <strong>
                {
                  [
                    "Write your post",
                    "Add photos or video",
                    "Apply your brand",
                    "Preview the feed post",
                    "Save or publish",
                  ][tourStep - 1]
                }
              </strong>
              <small>
                {
                  [
                    "Start with the message you want people to remember.",
                    "Add accessible media and arrange it before publishing.",
                    "Set your logo, colors, type, and tone guide.",
                    "Check the post in its feed context before export or publish.",
                    "Save a draft or publish when the post is ready.",
                  ][tourStep - 1]
                }
              </small>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setTourStep(0);
                localStorage.setItem("velori-post-tour-done", "1");
              }}
            >
              Skip tour
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                if (tourStep === 5) localStorage.setItem("velori-post-tour-done", "1");
                setTourStep(tourStep === 5 ? 0 : tourStep + 1);
              }}
            >
              {" "}
              {tourStep === 5 ? "Done" : "Next"}
            </button>
          </aside>
        )}
        <section className="post-start-choices" aria-label="Choose what to create">
          <div>
            <strong>Create something</strong>
            <span>Pick a starting point. You can adjust the details before sharing.</span>
          </div>
          <button type="button" onClick={() => chooseMediaMode("photo")}>
            Photo
          </button>
          <button type="button" onClick={() => chooseMediaMode("video")}>
            Video
          </button>
          <button type="button" onClick={() => chooseMediaMode("carousel")}>
            Carousel
          </button>
          <button
            type="button"
            onClick={() => {
              setCommandOpen(false);
              document
                .querySelector<HTMLButtonElement>(
                  '.post-studio-shell .post-studio-tab[aria-label="Templates"]',
                )
                ?.click();
            }}
          >
            Start from a template
          </button>
          <button type="button" onClick={() => navigate("/drafts")}>
            Continue a draft
          </button>
        </section>
        <div className="post-editor-polishbar">
          <button
            className="button button-outline"
            type="button"
            onClick={() => setCommandOpen(true)}
          >
            ⌘K Commands
          </button>
          <button
            className="button button-outline"
            type="button"
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1);
              if (previous !== undefined) {
                setHistory((items) => items.slice(0, -1));
                setRedoHistory((items) => pushHistory(items, body));
                setBody(previous);
                bodyValueRef.current = previous;
              }
            }}
          >
            Undo
          </button>
          <button
            className="button button-outline"
            type="button"
            disabled={!redoHistory.length}
            onClick={() => {
              const next = redoHistory.at(-1);
              if (next !== undefined) {
                setRedoHistory((items) => items.slice(0, -1));
                setHistory((items) => pushHistory(items, body));
                setBody(next);
                bodyValueRef.current = next;
              }
            }}
          >
            Redo
          </button>
          <label>
            History timeline
            <input
              aria-label="History timeline"
              type="range"
              min="0"
              max={history.length}
              value={history.length}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value < history.length) {
                  const nextBody = history[value] ?? "";
                  bodyValueRef.current = nextBody;
                  setBody(nextBody);
                  backUpDraftLocally({ body: nextBody });
                }
              }}
            />
          </label>
          <span role="status">{saveIndicator}</span>
        </div>
        <form ref={publishFormRef} className="compose-card" onSubmit={publish}>
          <div className="compose-author">
            <span className="avatar avatar-pink">{user.email?.charAt(0).toUpperCase()}</span>
            <span>
              Posting as <strong>{user.email}</strong>
            </span>
          </div>
          <div className="post-compose-field-heading">
            <label htmlFor="post-caption">Caption</label>
            <span id="post-caption-guidance">
              Write a caption or start a conversation. Text-only posts are supported.
            </span>
          </div>
          <div className="post-compose-cursor-canvas">
            <textarea
              id="post-caption"
              autoFocus
              aria-describedby="post-caption-guidance"
              placeholder="What would you like to share?"
              maxLength={2000}
              readOnly={!canEditCollaboration}
              value={body}
              onPointerMove={(event) => {
                const now = Date.now();
                if (now - lastCursorBroadcastRef.current < 70) return;
                lastCursorBroadcastRef.current = now;
                const bounds = event.currentTarget.getBoundingClientRect();
                void sendPostDraftCursor(collabChannelRef.current, {
                  user_id: user.id,
                  display_name: previewProfile?.display_name || user.email || "Collaborator",
                  color: "#8b72e8",
                  x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
                  y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
                });
              }}
              onPointerLeave={() => {
                void sendPostDraftCursor(collabChannelRef.current, {
                  user_id: user.id,
                  display_name: previewProfile?.display_name || user.email || "Collaborator",
                  color: "#8b72e8",
                  x: -1,
                  y: -1,
                });
              }}
              onChange={(e) => {
                setHistory((items) => pushHistory(items, body));
                setRedoHistory([]);
                bodyValueRef.current = e.target.value;
                collaborationDirtyRef.current = true;
                setCollaborationDirty(true);
                backUpDraftLocally({ body: e.target.value });
                setBody(e.target.value);
              }}
              onBlur={() => {
                if (body.trim() && canEditCollaboration) void persistDraft();
              }}
            />
            {remoteCursors
              .filter((cursor) => cursor.x >= 0 && cursor.y >= 0)
              .map((cursor) => (
                <span
                  className="post-collab-cursor"
                  key={cursor.user_id}
                  style={{
                    left: `${cursor.x * 100}%`,
                    top: `${cursor.y * 100}%`,
                    borderColor: cursor.color,
                    color: cursor.color,
                  }}
                >
                  <i style={{ borderTopColor: cursor.color }} />
                  {cursor.display_name}
                </span>
              ))}
          </div>
          <section className="post-media-editor" aria-label="Post media">
            <div className="post-media-editor-heading">
              <div>
                <strong>Photo or video</strong>
                <small>
                  {draftMedia.length}/10 · Images are optimized before upload; media stays private
                  until its post is visible.
                </small>
              </div>
              <label className="button button-outline post-media-picker">
                <Camera size={16} /> Add photo or video
                <input
                  type="file"
                  accept={mediaMode === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"}
                  multiple={mediaMode === "carousel"}
                  ref={mediaInputRef}
                  disabled={mediaBusy || draftMedia.length >= 10 || !canEditCollaboration}
                  onChange={(event) => {
                    const selected = Array.from(event.currentTarget.files || []);
                    event.currentTarget.value = "";
                    void (async () => {
                      for (const file of selected) {
                        if (draftMediaRef.current.length >= 10) {
                          setError("A post can contain up to 10 images or videos.");
                          break;
                        }
                        const uploaded = await addPostMedia(file);
                        if (!uploaded) break;
                      }
                    })();
                  }}
                />
              </label>
            </div>
            {mediaBusy && (
              <div className="post-upload-progress" role="status" aria-live="polite">
                <span>Preparing or uploading media… {uploadProgress ?? 0}%</span>
                <progress max="100" value={uploadProgress ?? 0} />
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => uploadAbortRef.current?.abort()}
                >
                  Cancel upload
                </button>
              </div>
            )}
            {draftMedia.length > 0 && (
              <div className="post-media-draft-list">
                {draftMedia
                  .slice()
                  .sort((left, right) => left.position - right.position)
                  .map((item, index) => (
                    <article className="post-media-draft-item" key={item.id}>
                      {item.media_type === "video" ? (
                        <video src={item.preview_url} controls playsInline preload="metadata" />
                      ) : (
                        <img src={item.preview_url} alt={item.alt_text || "Draft image preview"} />
                      )}
                      <div className="post-media-draft-controls">
                        <label>
                          Alt text / description
                          <input
                            disabled={!canEditCollaboration}
                            value={item.alt_text}
                            maxLength={500}
                            placeholder="Describe this media for accessibility"
                            onChange={(event) =>
                              replaceDraftMedia(
                                draftMediaRef.current.map((media) =>
                                  media.id === item.id
                                    ? { ...media, alt_text: event.target.value }
                                    : media,
                                ),
                              )
                            }
                            onBlur={(event) => void saveMediaAltText(item, event.target.value)}
                          />
                        </label>
                        <div className="post-owner-actions">
                          <button
                            type="button"
                            className="button button-outline"
                            aria-label={`Move media ${index + 1} earlier`}
                            disabled={mediaBusy || index === 0 || !canEditCollaboration}
                            onClick={() => void reorderDraftMedia(item, -1)}
                          >
                            Move earlier
                          </button>
                          <button
                            type="button"
                            className="button button-outline"
                            aria-label={`Move media ${index + 1} later`}
                            disabled={
                              mediaBusy || index === draftMedia.length - 1 || !canEditCollaboration
                            }
                            onClick={() => void reorderDraftMedia(item, 1)}
                          >
                            Move later
                          </button>
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={mediaBusy || !canEditCollaboration}
                            onClick={() => void removeDraftMedia(item)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
          <details className="post-compose-more">
            <summary>More options</summary>
            <div className="post-compose-settings">
              <label>
                Audience
                <select
                  disabled={!canEditCollaboration}
                  value={visibility}
                  onChange={(event) => {
                    const value = event.target.value as typeof visibility;
                    backUpDraftLocally({ visibility: value });
                    setVisibility(value);
                  }}
                >
                  <option value="public">Everyone</option>
                  <option value="followers">Followers</option>
                  <option value="private">Only me</option>
                </select>
              </label>
              <label className="post-setting-check">
                <input
                  type="checkbox"
                  disabled={!canEditCollaboration}
                  checked={allowComments}
                  onChange={(event) => {
                    backUpDraftLocally({ allow_comments: event.target.checked });
                    setAllowComments(event.target.checked);
                  }}
                />{" "}
                Allow comments
              </label>
              <label className="post-setting-check">
                <input
                  type="checkbox"
                  disabled={!canEditCollaboration}
                  checked={allowLikes}
                  onChange={(event) => {
                    backUpDraftLocally({ allow_likes: event.target.checked });
                    setAllowLikes(event.target.checked);
                  }}
                />{" "}
                Allow likes
              </label>
              <label className="post-setting-check">
                <input
                  type="checkbox"
                  disabled={!canEditCollaboration}
                  checked={hideLikeCount}
                  onChange={(event) => {
                    backUpDraftLocally({ hide_like_count: event.target.checked });
                    setHideLikeCount(event.target.checked);
                  }}
                />{" "}
                Hide like count
              </label>
              <label className="post-setting-check">
                <input
                  type="checkbox"
                  disabled={!canEditCollaboration}
                  checked={allowSharing}
                  onChange={(event) => {
                    backUpDraftLocally({ allow_sharing: event.target.checked });
                    setAllowSharing(event.target.checked);
                  }}
                />{" "}
                Allow sharing
              </label>
            </div>
          </details>
          <div className="compose-footer">
            <span>
              {previewConfirmed
                ? "WYSIWYG preview confirmed. Changes will need a new preview."
                : draftStatus || "Use #hashtags and @usernames to link conversations."}{" "}
              <span className="character-count">{body.length}/2000</span>
            </span>
            <div className="compose-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye size={16} /> Preview feed
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={busy || !canEditCollaboration}
                onClick={() =>
                  void persistDraft().then((savedDraft) => savedDraft && navigate("/drafts"))
                }
              >
                Save draft
              </button>
              <button
                className="button button-primary"
                disabled={
                  !body.trim() ||
                  busy ||
                  !navigator.onLine ||
                  !canEditCollaboration ||
                  draftWorkflowStatus === "published" ||
                  Boolean(draftOwnerId && draftOwnerId !== user.id)
                }
              >
                {busy
                  ? "Publishing…"
                  : draftWorkflowStatus === "published"
                    ? "Already published"
                    : !canEditCollaboration
                      ? "Read-only role"
                      : draftOwnerId && draftOwnerId !== user.id
                        ? "Owner publishes this post"
                        : "Publish post"}{" "}
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
          {error && <Problem message={error} />}
        </form>
        <PostPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onConfirm={() => setPreviewConfirmed(true)}
          body={body}
          media={draftMedia}
          authorName={previewProfile?.display_name || user.email || "Your profile"}
          authorHandle={previewProfile?.username || user.email?.split("@")[0] || "you"}
          avatarUrl={previewProfile?.avatar_url}
        />
        {draftId && (
          <>
            {remoteDraft && (
              <div className="post-collab-conflict" role="alert">
                <span>A collaborator saved a newer version (v{remoteDraft.version_number}).</span>
                <button
                  type="button"
                  onClick={() => {
                    bodyValueRef.current = remoteDraft.body;
                    collaborationDirtyRef.current = false;
                    setBody(remoteDraft.body);
                    setCollaborationDirty(false);
                    setRemoteDraft(null);
                    setDraftStatus("Remote version loaded; save to make it the current version.");
                  }}
                >
                  Use their version
                </button>
                <button
                  type="button"
                  onClick={() => {
                    collaborationDirtyRef.current = true;
                    setRemoteDraft(null);
                    setDraftStatus("Your edit is kept. Save to create a new version.");
                  }}
                >
                  Keep my edit
                </button>
              </div>
            )}
            <CollaborationPanel
              draftId={draftId}
              user={user}
              ownerFallback={draftOwnerId === user.id}
              body={body}
              media={draftMedia}
              onRestoreVersion={(nextBody) => {
                bodyValueRef.current = nextBody;
                collaborationDirtyRef.current = true;
                setBody(nextBody);
                setCollaborationDirty(true);
                backUpDraftLocally({ body: nextBody });
              }}
              onRemoteDraft={handleRemoteDraft}
              onCursor={handleRemoteCursor}
              onChannel={handleCollaborationChannel}
              onRole={setCollaborationRole}
            />
          </>
        )}
        {commandOpen && (
          <div
            className="command-palette-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCommandOpen(false);
            }}
          >
            <section
              className="command-palette"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <h2>
                Quick actions <kbd>⌘K</kbd>
              </h2>
              {[
                ["Save draft", () => void persistDraft()],
                ["Open preview", () => setPreviewOpen(true)],
                [
                  "Apply current brand",
                  () => {
                    const first = studioBrandKit.colors[0]?.hex;
                    if (first && selectedCanvasLayer?.type === "shape")
                      handleSelectedLayerChange("shape.fill", first);
                    else if (selectedCanvasLayer?.type === "text")
                      handleSelectedTextChange(
                        "color",
                        studioBrandKit.colors[1]?.hex || first || "#171713",
                      );
                    else if (first) applyCanvasBackground(first);
                  },
                ],
                [
                  "Undo",
                  () => {
                    const previous = history.at(-1);
                    if (previous !== undefined) {
                      setHistory((items) => items.slice(0, -1));
                      setRedoHistory((items) => pushHistory(items, body));
                      setBody(previous);
                    }
                  },
                ],
                [
                  "Redo",
                  () => {
                    const next = redoHistory.at(-1);
                    if (next !== undefined) {
                      setRedoHistory((items) => items.slice(0, -1));
                      setHistory((items) => pushHistory(items, body));
                      setBody(next);
                    }
                  },
                ],
              ].map(([label, action]) => (
                <button
                  type="button"
                  key={label as string}
                  onClick={() => {
                    (action as () => void)();
                    setCommandOpen(false);
                  }}
                >
                  {label as string}
                  <span>↵</span>
                </button>
              ))}
              <p>⌘/Ctrl+S Save · ⌘/Ctrl+Z Undo · ⇧⌘/Ctrl+Z Redo · ⌘/Ctrl+Enter Preview</p>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setCommandOpen(false)}
              >
                Close
              </button>
            </section>
          </div>
        )}
      </div>
    </StudioShell>
  );
}

export function AuthPage() {
  const location = useLocation();
  const { pathname } = location;
  const { user, loading: authLoading, recovery, endRecovery } = useAuth();
  const navigate = useNavigate();
  const mode = pathname.slice(1);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (mode !== "reset-password" && !isValidAccountEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if ((mode === "signup" || mode === "reset-password") && !isStrongAccountPassword(password)) {
      setError(
        `Use at least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters, including a letter and a number or symbol.`,
      );
      return;
    }
    if ((mode === "signup" || mode === "reset-password") && password !== confirmation) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    if (mode === "reset-password" && (authLoading || !user || !recovery)) {
      setError("Open a fresh recovery link from your email before changing your password.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setError("Enter a display name to create your account.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        let referralCode = isEligibleForApkPromotions()
          ? (new URLSearchParams(location.search).get("ref")?.trim().toUpperCase() ?? "")
          : "";
        let referralNotice = "";
        if (referralCode) {
          const { data: validation, error: validationError } = await supabase.rpc(
            "velori_validate_referral_code",
            { p_code: referralCode },
          );
          if (validationError) {
            referralNotice =
              "Your account can still be created, but the referral link could not be verified and will not be attached.";
            referralCode = "";
          } else if (
            !validation ||
            typeof validation !== "object" ||
            !("valid" in validation) ||
            validation.valid !== true
          ) {
            const reason =
              validation && typeof validation === "object" && "reason" in validation
                ? validation.reason
                : null;
            const messages: Record<string, string> = {
              invalid_code: "The referral code is invalid.",
              disabled_code: "The referral code has been disabled.",
              expired_code: "The referral code has expired.",
              program_disabled: "The referral program is paused.",
              program_not_started: "The referral program has not started yet.",
              program_expired: "The referral program has ended.",
              self_referral: "You cannot refer your own account.",
              already_used: "Your account already has referral attribution.",
            };
            const reasonText = typeof reason === "string" ? messages[reason] : undefined;
            referralNotice = `${reasonText ?? "This referral link cannot be used."} Your account can still be created without referral attribution.`;
            referralCode = "";
          }
        }
        if (referralNotice) {
          try {
            sessionStorage.setItem("velori-referral-notice", referralNotice);
          } catch {
            // Referral validation must not prevent account creation when tab storage is unavailable.
          }
        }
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: authRedirect("/auth/confirm"),
            data: {
              display_name: displayName.trim(),
              ...(referralCode ? { referral_code: referralCode } : {}),
            },
          },
        });
        if (authError) setError(friendlyError(authError));
        else if (data.session) navigate("/auth/confirmed");
        else {
          try {
            sessionStorage.setItem("velori-pending-email", email.trim());
            sessionStorage.setItem("velori-resend-after", String(Date.now() + 60000));
          } catch {
            // The check-email page also accepts the address directly.
          }
          navigate("/auth/check-email");
        }
      } else if (mode === "forgot-password") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: authRedirect("/reset-password"),
        });
        if (authError) setError(friendlyError(authError));
        else
          setNotice(
            "If this address has an account, a recovery email has been requested. Check your inbox.",
          );
      } else if (mode === "reset-password") {
        const { error: authError } = await supabase.auth.updateUser({
          password,
        });
        if (authError) setError(friendlyError(authError));
        else {
          endRecovery();
          setNotice("Password updated. You can now continue to VELORI.");
          setPassword("");
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (authError) setError(friendlyError(authError));
        else if (data.user) {
          const destination = await accountDestination();
          const returnTo = safeReturnPath(location.state, window.location.origin);
          navigate(destination === "/home" && returnTo ? returnTo : destination, {
            replace: true,
          });
        }
      }
    } catch (cause) {
      setError(friendlyError(cause as { code?: string; message?: string }));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? "Find your place here."
      : mode === "forgot-password"
        ? "Let's get you back."
        : mode === "reset-password"
          ? "Choose a new password."
          : "Welcome back.";
  return (
    <AuthScreen
      mode={mode}
      title={title}
      email={email}
      setEmail={setEmail}
      displayName={displayName}
      setDisplayName={setDisplayName}
      password={password}
      setPassword={setPassword}
      confirmation={confirmation}
      setConfirmation={setConfirmation}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      busy={busy}
      error={error}
      notice={notice}
      submit={submit}
      recoveryBlocked={mode === "reset-password" && (authLoading || !user || !recovery)}
    />
  );
}

export function AuthConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const supportedTypes = new Set(["email", "signup"]);
  const otpType = type === "signup" ? "signup" : "email";
  const validLink = Boolean(tokenHash) && supportedTypes.has(type ?? "");

  // Supabase delivers confirmation links in more than one shape. The template in
  // supabase/email-templates/confirm-signup.html produces
  // `?token_hash=...&type=email`, but the stock template produces a
  // ConfirmationURL that the browser follows through /auth/v1/verify, which
  // establishes the session itself and then redirects here with no token_hash at
  // all. Previously that second shape was reported as a broken link even though
  // the account had just been confirmed, so the confirmed session is honoured
  // directly.
  const alreadyConfirmed = !tokenHash && Boolean(user?.email_confirmed_at);
  const verifiable = validLink || alreadyConfirmed || (!tokenHash && authLoading);

  async function confirm() {
    if (busy) return;
    if (!tokenHash || !supportedTypes.has(type ?? "")) {
      if (alreadyConfirmed) {
        navigate("/auth/confirmed", { replace: true });
        return;
      }
      setError("Open the verification link from your email, or request a new one.");
      return;
    }
    if (!navigator.onLine) {
      setError("You're offline. Reconnect and try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (authError) {
        setError(
          authError.code === "otp_expired"
            ? "This verification link is expired, has already been used, or belongs to an account that is already confirmed."
            : friendlyError(authError),
        );
      } else {
        try {
          sessionStorage.removeItem("velori-pending-email");
          sessionStorage.removeItem("velori-resend-after");
        } catch {
          // Confirmation state is held by Supabase Auth, not browser storage.
        }
        navigate("/auth/confirmed", { replace: true });
      }
    } catch {
      setError("We couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthJourney className="auth-simple auth-confirm">
      <img className="auth-logo" src={veloriLogo} alt="VELORI" />
      <div className="eyebrow">ACCOUNT SECURITY</div>
      {verifiable ? (
        <>
          <div className="mail-art">
            <ShieldCheck size={30} />
          </div>
          <h1>Verify your email.</h1>
          <p>
            Confirm your VELORI account when you're ready. Opening this page alone will not use the
            link.
          </p>
          {error && <Problem message={error} />}
          <button
            className="button button-primary form-submit"
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? "Verifying…" : "Verify my email"} <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <>
          <h1>This link couldn't be verified.</h1>
          <p>
            The link is missing required information or uses the wrong confirmation type. Request a
            new verification email, or sign in if your account is already confirmed.
          </p>
          <Link className="button button-primary form-submit" to="/auth/check-email">
            Request a new link <ArrowRight size={17} />
          </Link>
        </>
      )}
      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
        <Link to="/home">Go home</Link>
      </div>
    </AuthJourney>
  );
}

export function AuthCheckEmail() {
  const { user, loading: authLoading } = useAuth();
  const [referralNotice] = useState(() => {
    try {
      const notice = sessionStorage.getItem("velori-referral-notice") || "";
      sessionStorage.removeItem("velori-referral-notice");
      return notice;
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem("velori-pending-email") || "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(() => {
    try {
      return Math.max(
        0,
        Math.ceil((Number(sessionStorage.getItem("velori-resend-after")) - Date.now()) / 1000) || 0,
      );
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (!email.trim() || cooldown > 0 || busy) return;
    if (!navigator.onLine) {
      setError("You're offline. Reconnect and try again.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: authError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authRedirect("/auth/confirm") },
      });
      if (authError) setError(friendlyError(authError));
      else {
        setNotice(
          "If this address has a pending account, a new verification link has been requested. Use the latest email.",
        );
        setCooldown(60);
        try {
          sessionStorage.setItem("velori-pending-email", email.trim());
          sessionStorage.setItem("velori-resend-after", String(Date.now() + 60000));
        } catch {
          // Browser storage may be unavailable.
        }
      }
    } catch {
      setError("We couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (
    !authLoading &&
    user?.email_confirmed_at &&
    (!email || user.email?.toLowerCase() === email.toLowerCase())
  )
    return (
      <AuthJourney className="auth-simple">
        <EmptyState
          icon={Check}
          title="Email verified"
          text="Your VELORI account is confirmed."
          action="Continue to VELORI"
          to="/auth/confirmed"
        />
      </AuthJourney>
    );
  return (
    <AuthJourney className="auth-simple">
      <img className="auth-logo" src={veloriLogo} alt="VELORI" />
      <div className="mail-art">
        <Mail size={30} />
      </div>
      <div className="eyebrow">ONE SMALL STEP LEFT</div>
      <h1>Check your email.</h1>
      <p>
        {email ? (
          <>
            We requested a verification email for <a href={`mailto:${email}`}>{email}</a>.
          </>
        ) : (
          "Enter the address you used to sign up."
        )}{" "}
        Open the latest email and use its secure verification button.
      </p>
      {referralNotice && (
        <p className="success-message" role="status">
          {referralNotice}
        </p>
      )}
      <label className="email-correction">
        Email address
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
            setNotice("");
          }}
          placeholder="you@example.com"
        />
      </label>
      {error && <Problem message={error} />}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      <button
        className="button button-primary form-submit"
        disabled={busy || cooldown > 0 || !email.trim()}
        onClick={() => void resend()}
      >
        {busy
          ? "Requesting…"
          : cooldown > 0
            ? `Request another link in ${cooldown}s`
            : "Send a new verification link"}{" "}
        <ArrowRight size={17} />
      </button>
      <div className="auth-links">
        <Link to="/signup">Use a different email</Link>
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthJourney>
  );
}

export function AuthConfirmed() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [referralNotice] = useState(() => {
    try {
      const notice = sessionStorage.getItem("velori-referral-notice") || "";
      sessionStorage.removeItem("velori-referral-notice");
      return notice;
    } catch {
      return "";
    }
  });
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user?.email_confirmed_at) {
      setError(
        "We couldn't find a confirmed session. Sign in, or request a new verification link.",
      );
      return;
    }
    setError("");
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hasForgeDraft = false;
    try {
      hasForgeDraft = Boolean(readForgeLandingDraft(window.localStorage));
    } catch {
      // Continue through normal account routing when tab storage is unavailable.
    }
    void accountDestination()
      .then((path) => {
        if (!active) return;
        const nextPath = hasForgeDraft && path === "/home" ? "/forge" : path;
        setDestination(nextPath);
        timer = setTimeout(() => navigate(nextPath, { replace: true }), 1800);
      })
      .catch((cause) => {
        if (active) setError(friendlyError(cause as { code?: string; message?: string }));
      });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [loading, navigate, user]);

  return (
    <AuthJourney className="auth-simple auth-confirm">
      <img className="auth-logo" src={veloriLogo} alt="VELORI" />
      <div className="mail-art">
        <Check size={30} />
      </div>
      <div className="eyebrow">ACCOUNT CONFIRMED</div>
      <h1>Email verified.</h1>
      <p>Your VELORI account is confirmed. We are taking you to the next step.</p>
      {referralNotice && (
        <p className="success-message" role="status">
          {referralNotice}
        </p>
      )}
      {error && <Problem message={error} />}
      {loading || (!destination && !error) ? (
        <p role="status">Checking your account…</p>
      ) : destination ? (
        <Link className="button button-primary form-submit" to={destination}>
          Continue to VELORI <ArrowRight size={17} />
        </Link>
      ) : (
        <div className="auth-links">
          <Link to="/login">Sign in</Link>
          <Link to="/auth/check-email">Request a new link</Link>
        </div>
      )}
    </AuthJourney>
  );
}

export function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    const { error: dbError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: username.trim().toLowerCase(),
        display_name: name.trim(),
        bio: bio.trim(),
      },
      { onConflict: "id" },
    );
    setBusy(false);
    if (dbError) setError(friendlyError(dbError));
    else {
      let hasForgeDraft = false;
      try {
        hasForgeDraft = Boolean(readForgeLandingDraft(window.localStorage));
      } catch {
        // Continue through normal onboarding when tab storage is unavailable.
      }
      navigate(hasForgeDraft ? "/forge" : "/home");
    }
  }
  if (loading)
    return (
      <PageWorkspace area="account" className="">
        <div className="skeleton-card" />
      </PageWorkspace>
    );
  if (!user)
    return (
      <PageWorkspace area="account" className="">
        <EmptyState
          icon={LockKeyhole}
          title="Start with an account"
          text="Sign in to create your space."
          action="Sign in"
          to="/login"
        />
      </PageWorkspace>
    );
  return (
    <div className="auth-simple onboarding">
      <div className="mail-art">
        <Compass size={30} />
      </div>
      <div className="eyebrow">MAKE IT YOURS</div>
      <h1>Let's make some room for you.</h1>
      <p>A name, a few words, and you're on your way. You can change your details later.</p>
      <form onSubmit={submit} className="stacked-form">
        <label>
          Username
          <input
            required
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
          />
        </label>
        <label>
          Display name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          A little about you <span className="optional">optional</span>
          <textarea
            maxLength={300}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What makes you, you?"
          />
        </label>
        {error && <Problem message={error} />}
        <button className="button button-primary form-submit" disabled={busy}>
          {busy ? "Creating…" : "Enter VELORI"} <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const location = useLocation();
  const reducedMotion = useInterfaceMotion().reduced;
  const profileEditDragControls = useDragControls();
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "checking" | "available" | "taken" | "invalid" | "unverified"
  >("available");
  const [website, setWebsite] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "creator" | "business">("personal");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarRotation, setAvatarRotation] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">(() => {
    try {
      const preference = localStorage.getItem("velori-theme");
      return preference === "light" || preference === "dark" || preference === "system"
        ? preference
        : "light";
    } catch {
      return "light";
    }
  });
  function chooseTheme(preference: "light" | "dark" | "system") {
    setThemePreference(preference);
    try {
      localStorage.setItem("velori-theme", preference);
    } catch {
      // The current page still updates even when browser storage is blocked.
    }
    const dark =
      preference === "dark" ||
      (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#171b25" : "#fbfafb");
    window.dispatchEvent(new Event("theme-preference-updated"));
  }
  function clearAppearancePreference() {
    let storageCleared = false;
    try {
      localStorage.removeItem("velori-theme");
      storageCleared = true;
    } catch {
      // The preference still resets for this page load.
    }
    setThemePreference("light");
    document.documentElement.dataset.theme = "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#fbfafb");
    window.dispatchEvent(new Event("theme-preference-updated"));
    setStorageNotice(
      storageCleared
        ? "Saved appearance preference cleared. Light theme is active by default."
        : "Browser storage is blocked, so the preference could not be cleared from this device.",
    );
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .rpc("profile_self")
      .maybeSingle()
      .then(({ data, error: dbError }) => {
        if (!active) return;
        if (dbError) setError(friendlyError(dbError));
        const ownProfile = data as Profile | null;
        if (ownProfile) {
          setProfile(ownProfile);
          setName(ownProfile.display_name);
          setBio(ownProfile.bio);
          setUsername(ownProfile.username);
          setWebsite(ownProfile.website_url || "");
          setLinkTitle(ownProfile.link_title || "");
          setAccountType(ownProfile.account_type || "personal");
        }
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    if (!profile || !user) return;
    const candidate = username.trim().toLowerCase();
    if (!usernamePattern.test(candidate)) {
      setUsernameStatus("invalid");
      return;
    }
    if (candidate === profile.username) {
      setUsernameStatus("available");
      return;
    }
    setUsernameStatus("checking");
    let active = true;
    const timer = window.setTimeout(() => {
      void supabase.rpc("username_available", { candidate }).then(({ data, error: rpcError }) => {
        if (active) setUsernameStatus(rpcError ? "unverified" : data ? "available" : "taken");
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [profile, username, user]);
  useEffect(() => {
    if (profile && location.hash === "#profile-photo") setProfileEditOpen(true);
  }, [profile, location.hash]);
  useEffect(() => {
    if (!profileEditOpen || location.hash !== "#profile-photo") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("profile-photo")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [profileEditOpen, location.hash]);
  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);
  useEffect(() => {
    if (!profileEditOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileEditOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileEditOpen]);
  async function update(values: Partial<Profile>) {
    if (!user || !profile) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: dbError } = await supabase.from("profiles").update(values).eq("id", user.id);
    setBusy(false);
    if (dbError) setError(friendlyError(dbError));
    else {
      const updatedProfile = { ...profile, ...values };
      setProfile(updatedProfile);
      publishProfileChange({
        id: updatedProfile.id,
        username: updatedProfile.username,
        display_name: updatedProfile.display_name,
        avatar_url: updatedProfile.avatar_url,
      });
      setNotice("Changes saved to your account.");
      if (typeof values.username === "string") setUsername(values.username);
    }
  }
  async function deletePreviousAvatar(url: string | null | undefined) {
    if (!user || !url) return;
    try {
      const pathname = new URL(url).pathname;
      const marker = "/storage/v1/object/public/profile-avatars/";
      const index = pathname.indexOf(marker);
      if (index < 0) return;
      const objectPath = decodeURIComponent(pathname.slice(index + marker.length));
      if (objectPath.startsWith(`${user.id}/`)) {
        await supabase.storage.from("profile-avatars").remove([objectPath]);
      }
    } catch {
      // The profile reference is already changed; stale storage cleanup is best-effort.
    }
  }
  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setError("");
    setAvatarZoom(1);
    setAvatarRotation(0);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }
  async function saveAvatar() {
    if (!user || !profile || !avatarFile || avatarBusy) return;
    setAvatarBusy(true);
    setError("");
    setNotice("");
    let uploadedPath = "";
    try {
      const image = await createAvatarImage(avatarFile, avatarZoom, avatarRotation);
      uploadedPath = `${user.id}/${createUuid()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(uploadedPath, image, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(uploadedPath);
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (profileError) {
        await supabase.storage.from("profile-avatars").remove([uploadedPath]);
        throw profileError;
      }
      await deletePreviousAvatar(profile.avatar_url);
      const updatedProfile = { ...profile, avatar_url: data.publicUrl };
      setProfile(updatedProfile);
      publishProfileChange({
        id: updatedProfile.id,
        username: updatedProfile.username,
        display_name: updatedProfile.display_name,
        avatar_url: updatedProfile.avatar_url,
      });
      setAvatarFile(null);
      setAvatarPreview("");
      setNotice("Your profile photo has been updated.");
    } catch (cause) {
      setError(
        cause instanceof Error && !("code" in cause)
          ? cause.message
          : friendlyError(cause as { code?: string; message?: string }),
      );
    } finally {
      setAvatarBusy(false);
    }
  }
  async function removeAvatar() {
    if (!user || !profile?.avatar_url || avatarBusy) return;
    setAvatarBusy(true);
    setError("");
    setNotice("");
    const previousUrl = profile.avatar_url;
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (dbError) setError(friendlyError(dbError));
    else {
      const updatedProfile = { ...profile, avatar_url: null };
      setProfile(updatedProfile);
      publishProfileChange({
        id: updatedProfile.id,
        username: updatedProfile.username,
        display_name: updatedProfile.display_name,
        avatar_url: updatedProfile.avatar_url,
      });
      await deletePreviousAvatar(previousUrl);
      setNotice("Your profile photo has been removed.");
    }
    setAvatarBusy(false);
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile || busy) return;
    const nextUsername = username.trim().toLowerCase();
    if (!usernamePattern.test(nextUsername)) {
      setError("Use 3–24 lowercase letters, numbers, or underscores for your username.");
      return;
    }
    if (nextUsername !== profile.username) {
      if (usernameStatus !== "available") {
        setError(
          usernameStatus === "taken"
            ? "That username is already in use. Choose another one."
            : usernameStatus === "unverified"
              ? "Username availability could not be checked. Try again before saving."
              : "Wait for the username availability check to finish.",
        );
        return;
      }
      if (!window.confirm(`Change your profile address to @${nextUsername}?`)) return;
    }
    let normalizedWebsite: string | null = null;
    if (website.trim()) {
      try {
        const candidate = /^[a-z]+:\/\//i.test(website.trim())
          ? website.trim()
          : `https://${website.trim()}`;
        const parsed = new URL(candidate);
        if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) throw new Error();
        normalizedWebsite = parsed.toString();
      } catch {
        setError("Enter a valid website address.");
        return;
      }
    }
    await update({
      username: nextUsername,
      display_name: name.trim(),
      bio: bio.trim(),
      website_url: normalizedWebsite,
      link_title: linkTitle.trim() || null,
      account_type: accountType,
    });
  }
  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    if (!user || !newEmail.trim() || busy) return;
    const normalizedEmail = normalizeEmail(newEmail);
    if (!isValidAccountEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (normalizedEmail === normalizeEmail(user.email)) {
      setError("Enter a different email address.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: authError } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        {
          emailRedirectTo: new URL("/settings/account", window.location.origin).toString(),
        },
      );
      if (authError) setError(friendlyError(authError));
      else {
        setNotice(
          "Email change requested. Check the confirmation messages at the affected addresses. Your current address remains in use until Supabase confirms the change.",
        );
        setNewEmail("");
      }
    } catch {
      setError("We couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!user?.email || busy) return;
    if (!isStrongAccountPassword(newPassword)) {
      setError(
        `Use at least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters, including a letter and a number or symbol.`,
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(user.email),
        password: currentPassword,
      });
      if (verificationError) {
        setError("Your current password could not be verified.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(friendlyError(updateError));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      const { error: revokeError } = await supabase.auth.signOut({
        scope: "global",
      });
      if (revokeError) {
        setNotice(
          "Password changed. Other sessions could not be revoked automatically; sign out of unfamiliar devices from your Supabase account security settings.",
        );
      } else {
        setNotice(
          "Password changed and all sessions signed out. Sign in again with your new password.",
        );
      }
    } catch {
      setError("We couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsWorkspace>
      <div className="settings-section" data-settings-group="privacy">
        <div className="settings-icon">
          <LockKeyhole size={21} />
        </div>
        <div className="settings-body">
          <h2>Privacy</h2>
          <p>Manage account visibility, discoverability, connections, and interactions.</p>
          <Link to="/settings/privacy" className="button button-outline">
            Manage privacy settings
          </Link>
        </div>
      </div>
      <div className="settings-section" data-settings-group="notifications">
        <div className="settings-icon">
          <Bell size={21} />
        </div>
        <div className="settings-body">
          <h2>Notifications</h2>
          <p>Choose which activity appears in your timeline and which can reach your devices.</p>
          <Link to="/settings/notifications" className="button button-outline">
            Manage notification settings
          </Link>
        </div>
      </div>
      <div className="settings-section" data-settings-group="appearance">
        <div className="settings-icon">
          <Zap size={22} />
        </div>
        <div className="settings-body">
          <h2>Appearance</h2>
          <p>Choose the atmosphere that feels right.</p>
          <div className="appearance-choices">
            <button
              className={themePreference === "light" ? "chosen" : ""}
              aria-pressed={themePreference === "light"}
              onClick={() => chooseTheme("light")}
            >
              <span className="theme-preview light-preview" /> Light{" "}
              {themePreference === "light" && <Check size={16} />}
            </button>
            <button
              className={themePreference === "dark" ? "chosen" : ""}
              aria-pressed={themePreference === "dark"}
              onClick={() => chooseTheme("dark")}
            >
              <span className="theme-preview dark-preview" /> Dark{" "}
              {themePreference === "dark" && <Check size={16} />}
            </button>
            <button
              className={themePreference === "system" ? "chosen" : ""}
              aria-pressed={themePreference === "system"}
              onClick={() => chooseTheme("system")}
            >
              <Monitor size={18} /> System {themePreference === "system" && <Check size={16} />}
            </button>
          </div>
        </div>
      </div>
      <div className="settings-section" data-settings-group="storage">
        <div className="settings-icon cyan-icon">
          <ShieldCheck size={22} />
        </div>
        <div className="settings-body">
          <h2>Privacy & cookies</h2>
          <p>
            Essential browser storage keeps your Supabase sign-in session working. Light is the
            default appearance; you can save Light, Dark, or System in Settings. While you edit a
            post, a temporary recovery copy stays on this device until its Supabase draft is saved;
            it is removed after sync. There is no optional analytics or advertising storage.
          </p>
          <div className="setting-row">
            <div>
              <strong>Essential sign-in storage</strong>
              <small>Required to keep your account signed in.</small>
            </div>
            <span>Always on</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Appearance preference</strong>
              <small>
                Current choice:{" "}
                {themePreference === "system"
                  ? "System"
                  : themePreference === "dark"
                    ? "Dark"
                    : "Light"}
                .
              </small>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={clearAppearancePreference}
            >
              Clear preference
            </button>
          </div>
          {storageNotice && <p role="status">{storageNotice}</p>}
          <Link to="/cookies" className="link-button">
            Read the storage explanation
          </Link>
        </div>
      </div>
      {!user ? (
        <EmptyState
          icon={LockKeyhole}
          title="Sign in for account settings"
          text="Your profile and privacy preferences will appear here after you sign in."
          action="Sign in"
          to="/login"
        />
      ) : (
        <>
          <div className="settings-section" data-settings-group="account">
            <div className="settings-icon cyan-icon">
              <Mail size={22} />
            </div>
            <div className="settings-body">
              <h2>Account email</h2>
              <p>
                Signed in as {user.email}. Supabase may require confirmation from both addresses.
              </p>
              <form className="stacked-form settings-form" onSubmit={(e) => void changeEmail(e)}>
                <label>
                  New email address
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <button className="button button-primary" disabled={busy || !navigator.onLine}>
                  {busy ? "Requesting…" : "Request email change"}
                </button>
              </form>
            </div>
          </div>
          <div className="settings-section" data-settings-group="account">
            <div className="settings-icon cyan-icon">
              <LockKeyhole size={22} />
            </div>
            <div className="settings-body">
              <h2>Password & sessions</h2>
              <p>
                Verify your current password before changing it. A successful change signs out all
                sessions.
              </p>
              <form
                className="stacked-form settings-form"
                onSubmit={(event) => void changePassword(event)}
              >
                <label>
                  Current password
                  <input
                    type={showSettingsPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label>
                  New password
                  <input
                    type={showSettingsPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type={showSettingsPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                  />
                </label>
                <label className="password-reveal-setting">
                  <input
                    type="checkbox"
                    checked={showSettingsPassword}
                    onChange={(event) => setShowSettingsPassword(event.target.checked)}
                  />
                  Show password fields
                </label>
                <p className="auth-password-policy">
                  At least {MIN_ACCOUNT_PASSWORD_LENGTH} characters, with a letter and a number or
                  symbol.
                </p>
                <button className="button button-primary" disabled={busy || !navigator.onLine}>
                  {busy ? "Updating…" : "Change password"}
                </button>
              </form>
            </div>
          </div>
          <div className="settings-section" data-settings-group="account">
            <div className="settings-icon pink-icon">
              <Users size={22} />
            </div>
            <div className="settings-body">
              <h2>Your profile</h2>
              <p>How others get to know you.</p>
              {profile ? (
                <>
                  <div className="profile-edit-summary">
                    <div className="avatar-editor-preview">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" />
                      ) : (
                        <span>
                          {profile.display_name?.charAt(0).toUpperCase() ||
                            profile.username[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>{profile.display_name || profile.username}</strong>
                      <small>@{profile.username}</small>
                    </div>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setProfileEditOpen(true)}
                    >
                      Edit profile
                    </button>
                  </div>
                  {createPortal(
                    <AnimatePresence>
                      {profileEditOpen ? (
                        <m.div
                          className="profile-edit-backdrop"
                          initial={{ opacity: reducedMotion ? 1 : 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: reducedMotion ? 1 : 0 }}
                          transition={{ duration: reducedMotion ? 0 : 0.2 }}
                          onClick={() => setProfileEditOpen(false)}
                        >
                          <m.section
                            className="profile-edit-sheet"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="profile-edit-title"
                            initial={reducedMotion ? false : { opacity: 0, y: 36 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 36 }}
                            transition={
                              reducedMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 300, damping: 25 }
                            }
                            drag="y"
                            dragControls={profileEditDragControls}
                            dragListener={false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={reducedMotion ? 0 : { top: 0, bottom: 0.25 }}
                            onDragEnd={(_, info) => {
                              if (info.offset.y > 120) setProfileEditOpen(false);
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <header className="profile-edit-sheet-header">
                              <button
                                type="button"
                                className="profile-edit-sheet-handle"
                                aria-label="Drag down to close profile editor"
                                onPointerDown={(event) => profileEditDragControls.start(event)}
                              />
                              <h2 id="profile-edit-title">Edit profile</h2>
                              <button
                                type="button"
                                className="profile-edit-sheet-close"
                                aria-label="Close profile editor"
                                onClick={() => setProfileEditOpen(false)}
                              >
                                <X size={19} />
                              </button>
                            </header>
                            <div className="profile-edit-sheet-content">
                              <div
                                className="profile-edit-tools"
                                id="profile-photo"
                                style={{ scrollMarginTop: 24 }}
                              >
                                <div className="avatar-editor">
                                  <div className="avatar-editor-preview">
                                    {avatarPreview ? (
                                      <img
                                        src={avatarPreview}
                                        alt="Profile photo crop preview"
                                        style={{
                                          transform: `scale(${avatarZoom}) rotate(${avatarRotation}deg)`,
                                        }}
                                      />
                                    ) : profile.avatar_url ? (
                                      <img src={profile.avatar_url} alt="Current profile photo" />
                                    ) : (
                                      <span>
                                        {profile.display_name?.charAt(0).toUpperCase() ||
                                          profile.username[0].toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="avatar-editor-controls">
                                    <label className="button button-outline avatar-file-button">
                                      <Camera size={16} /> Choose photo
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => chooseAvatar(event.target.files?.[0])}
                                        disabled={avatarBusy}
                                      />
                                    </label>
                                    {profile.avatar_url && !avatarPreview && (
                                      <button
                                        type="button"
                                        className="button button-outline"
                                        onClick={() => void removeAvatar()}
                                        disabled={avatarBusy}
                                      >
                                        Remove photo
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {avatarPreview && (
                                  <div className="avatar-crop-controls">
                                    <label>
                                      Crop zoom
                                      <input
                                        type="range"
                                        min="1"
                                        max="2.5"
                                        step="0.05"
                                        value={avatarZoom}
                                        onChange={(event) =>
                                          setAvatarZoom(Number(event.target.value))
                                        }
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="button button-outline"
                                      onClick={() =>
                                        setAvatarRotation((degrees) => (degrees + 90) % 360)
                                      }
                                    >
                                      <RotateCw size={16} /> Rotate
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-primary"
                                      onClick={() => void saveAvatar()}
                                      disabled={avatarBusy}
                                    >
                                      {avatarBusy ? "Saving photo…" : "Save photo"}
                                    </button>
                                    <button
                                      type="button"
                                      className="button button-outline"
                                      onClick={() => {
                                        setAvatarFile(null);
                                        setAvatarPreview("");
                                      }}
                                      disabled={avatarBusy}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                <form
                                  className="stacked-form settings-form"
                                  onSubmit={(event) => void saveProfile(event)}
                                >
                                  <label>
                                    Username
                                    <input
                                      value={username}
                                      minLength={3}
                                      maxLength={24}
                                      autoCapitalize="none"
                                      autoCorrect="off"
                                      onChange={(event) =>
                                        setUsername(event.target.value.toLowerCase())
                                      }
                                      aria-describedby="username-help"
                                    />
                                    <small
                                      id="username-help"
                                      className="username-status"
                                      role="status"
                                    >
                                      {usernameStatus === "checking"
                                        ? "Checking availability…"
                                        : usernameStatus === "available"
                                          ? "Username is available."
                                          : usernameStatus === "taken"
                                            ? "That username is already taken."
                                            : usernameStatus === "invalid"
                                              ? "Use 3–24 lowercase letters, numbers, or underscores."
                                              : "Availability could not be checked. Retry before changing it."}
                                    </small>
                                  </label>
                                  <label>
                                    Display name
                                    <input
                                      value={name}
                                      maxLength={80}
                                      onChange={(event) => setName(event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    Bio
                                    <textarea
                                      value={bio}
                                      maxLength={300}
                                      onChange={(event) => setBio(event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    Website
                                    <input
                                      type="url"
                                      value={website}
                                      maxLength={2048}
                                      onChange={(event) => setWebsite(event.target.value)}
                                      placeholder="https://example.com"
                                    />
                                  </label>
                                  <label>
                                    Link title <span className="optional">optional</span>
                                    <input
                                      value={linkTitle}
                                      maxLength={80}
                                      onChange={(event) => setLinkTitle(event.target.value)}
                                      placeholder="My website"
                                    />
                                  </label>
                                  <label>
                                    Account type
                                    <select
                                      value={accountType}
                                      onChange={(event) =>
                                        setAccountType(event.target.value as typeof accountType)
                                      }
                                    >
                                      <option value="personal">Personal</option>
                                      <option value="creator">Creator</option>
                                      <option value="business">Business</option>
                                    </select>
                                    <small>
                                      Changes your profile label. Creator tools and analytics are
                                      still being built.
                                    </small>
                                  </label>
                                  <button
                                    className="button button-outline"
                                    disabled={busy || usernameStatus === "checking"}
                                  >
                                    Save profile
                                  </button>
                                </form>
                              </div>
                            </div>
                          </m.section>
                        </m.div>
                      ) : null}
                    </AnimatePresence>,
                    document.body,
                  )}
                </>
              ) : (
                <Link className="button button-outline" to="/onboarding">
                  Complete your profile <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
          <div className="settings-section" data-settings-group="content">
            <div className="settings-icon cyan-icon">
              <Bookmark size={22} />
            </div>
            <div className="settings-body">
              <h2>Your content</h2>
              <p>Manage saved work, archived posts, and recently deleted posts.</p>
              <div className="content-library-links">
                <Link className="button button-outline" to="/drafts">
                  Drafts
                </Link>
                <Link className="button button-outline" to="/archive">
                  Archive
                </Link>
                <Link className="button button-outline" to="/trash">
                  Recently deleted
                </Link>
                <Link className="button button-outline" to="/saved">
                  Saved posts
                </Link>
              </div>
            </div>
          </div>
          <div className="settings-section" data-settings-group="privacy">
            <div className="settings-icon cyan-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="settings-body">
              <h2>Privacy</h2>
              <p>
                Set who can discover your profile, see your connections, and interact with your
                content.
              </p>
              <Link className="button button-outline" to="/settings/privacy">
                Privacy settings
              </Link>
              <Link className="button button-outline" to="/settings/follow-requests">
                Follow requests
              </Link>
            </div>
          </div>
          {error && <Problem message={error} />}
          {notice && (
            <p className="success-message" role="status">
              <Check size={17} /> {notice}
            </p>
          )}
        </>
      )}
    </SettingsWorkspace>
  );
}

export function PublicPage({ kind }: { kind: string }) {
  const settings = useSiteSettings();
  const { result, retry } = usePublishedCmsPage(`/${kind}`);
  if (result.status === "loading") return <CmsPageLoading />;
  if (result.status === "error")
    return (
      <PageWorkspace area="information" className="public-page">
        <Problem message={result.message} retry={retry} />
      </PageWorkspace>
    );
  const page =
    result.status === "ready"
      ? (result.page as PublishedCmsPage)
      : informationPages[kind]
        ? buildDocumentationDocument(kind, {
            contactEmail: settings.contact_email,
            contactPhone: settings.contact_phone,
          })
        : null;
  if (!page) return <NotFound />;
  return (
    <div
      className="velori-document-page"
      data-footer={page.footer_enabled === false ? "hidden" : "visible"}
    >
      <CmsPublicPage page={page} embedded />
    </div>
  );
}

type CmsPageHookResult = PublishedCmsPageResult | { status: "loading" };

function usePublishedCmsPage(route: string) {
  const normalizedRoute = normalizeCmsRoute(route);
  const [state, setState] = useState<{
    route: string;
    result: PublishedCmsPageResult;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = (force = false) => {
      void loadPublishedCmsPage(normalizedRoute, { force }).then((result) => {
        if (active) setState({ route: normalizedRoute, result });
      });
    };
    void load();
    const interval = window.setInterval(() => load(), 120_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", refreshOnVisible);
    const channel = supabase
      .channel(`public-cms-${normalizedRoute}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cms_page_publication_events",
          filter: `route=eq.${normalizedRoute}`,
        },
        () => {
          load(true);
        },
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      void supabase.removeChannel(channel);
    };
  }, [normalizedRoute, retryCount]);

  const result: CmsPageHookResult =
    state?.route === normalizedRoute
      ? state.result
      : (cachedPublishedCmsPage(normalizedRoute) ?? { status: "loading" });
  useEffect(() => {
    if (result.status === "ready") {
      document.title = result.page.seo_title || result.page.title || "VELORI";
    } else {
      const fallback = informationPages[normalizedRoute.slice(1)];
      document.title = fallback ? `${fallback.label} · VELORI` : "VELORI";
    }
  }, [result, normalizedRoute]);

  const retry = useCallback(() => setRetryCount((current) => current + 1), []);
  return { result, retry };
}

function CmsPageLoading() {
  return (
    <div className="narrow-page public-page" role="status" aria-live="polite">
      <div className="eyebrow">
        <span className="eyebrow-line" /> VELORI / LOADING
      </div>
      <VeloriLoop />
      <h1>Loading page…</h1>
      <p className="public-lead">Loading the latest published page.</p>
    </div>
  );
}

function FeatureDisabledNotice({ kind }: { kind: string }) {
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}.`;
  return (
    <div className="narrow-page">
      <PageHeading
        eyebrow="FEATURE DISABLED"
        title={title}
        subtitle="This capability is currently turned off by an administrator."
      />
      <EmptyState
        icon={ShieldCheck}
        title="Feature unavailable"
        text="This feature has been disabled by the platform administrator and is not accepting new activity."
        action="Back to the feed"
        to="/home"
      />
    </div>
  );
}

export function AdSpot({ placement = "feed" }: { placement?: string }) {
  const ad = useAdvertisement(placement);
  return ad ? <SponsoredCard ad={ad} reel={placement === "reels"} /> : null;
}

type NotificationFilter =
  | "all"
  | "unread"
  | "likes"
  | "comments"
  | "follows"
  | "mentions"
  | "messages"
  | "groups"
  | "stories"
  | "reels"
  | "system";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string;
  read_at: string | null;
  created_at: string;
  expires_at?: string | null;
};

function missingNotificationExpiryColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = Reflect.get(error, "code");
  const message = Reflect.get(error, "message");
  const details = Reflect.get(error, "details");
  const text = [message, details].filter((value) => typeof value === "string").join(" ");
  return (
    (code === "42703" || code === "PGRST204" || code === "PGRST100") && /expires_at/i.test(text)
  );
}

function isNotificationExpired(item: NotificationItem, now = Date.now()) {
  if (!item.expires_at) return false;
  const expiresAt = Date.parse(item.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

const notificationFilters: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "follows", label: "Follows" },
  { id: "mentions", label: "Mentions" },
  { id: "messages", label: "Messages" },
  { id: "groups", label: "Groups" },
  { id: "stories", label: "Stories" },
  { id: "reels", label: "Reels" },
  { id: "system", label: "System" },
];

function matchesNotificationFilter(item: NotificationItem, filter: NotificationFilter) {
  const kind = item.kind;
  if (filter === "all") return true;
  if (filter === "unread") return !item.read_at;
  if (filter === "mentions") return kind === "mention" || kind === "tag";
  if (filter === "messages") return kind === "message";
  if (filter === "likes")
    return kind === "like" || kind === "reel_interaction" || kind === "story_reaction";
  if (filter === "comments")
    return kind === "comment" || kind === "reply" || kind === "story_reply";
  if (filter === "follows") return kind === "follow" || kind === "follow_request";
  if (filter === "groups")
    return (
      kind === "group" ||
      kind === "group_invite" ||
      kind === "group_join" ||
      kind === "group_request_approved" ||
      kind === "group_request_declined"
    );
  if (filter === "stories") return kind === "story_reaction" || kind === "story_reply";
  if (filter === "reels") return kind === "reel_interaction";
  return kind === "security" || kind === "system";
}

export function NotificationsPage() {
  const enabled = useFeatureFlag("notifications_enabled", true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busyAll, setBusyAll] = useState(false);
  const visibleItems = items.filter((item) => matchesNotificationFilter(item, filter));

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const expiryResult = await supabase
      .from("notifications")
      .select("id,title,body,kind,link,read_at,created_at,expires_at")
      .eq("recipient_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(24);
    let data = expiryResult.data as NotificationItem[] | null;
    let queryError = expiryResult.error;
    // Older connected deployments may not have applied the campaign expiry
    // migration yet. Keep the established personal notification timeline
    // available there; once the column exists, the normal query enforces it.
    if (queryError && missingNotificationExpiryColumn(queryError)) {
      const legacyResult = await supabase
        .from("notifications")
        .select("id,title,body,kind,link,read_at,created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(24);
      data = legacyResult.data as NotificationItem[] | null;
      queryError = legacyResult.error;
    }
    setLoading(false);
    if (queryError) setError(friendlyError(queryError));
    else setItems((data ?? []).filter((item) => !isNotificationExpired(item)));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) setItems((current) => current.filter((item) => item.id !== deletedId));
            return;
          }
          const next = payload.new as NotificationItem;
          if (!next.id) return;
          if (isNotificationExpired(next)) {
            setItems((current) => current.filter((item) => item.id !== next.id));
            return;
          }
          setItems((current) => {
            const exists = current.some((item) => item.id === next.id);
            const updated = exists
              ? current.map((item) => (item.id === next.id ? { ...item, ...next } : item))
              : [next, ...current];
            return updated
              .sort((left, right) =>
                String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
              )
              .slice(0, 24);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  useEffect(() => {
    const expiries = items
      .map((item) => (item.expires_at ? Date.parse(item.expires_at) : Number.NaN))
      .filter((time) => Number.isFinite(time) && time > Date.now());
    if (!expiries.length) return;
    const delay = Math.min(...expiries) - Date.now() + 20;
    const timer = window.setTimeout(
      () => {
        setItems((current) => current.filter((item) => !isNotificationExpired(item)));
      },
      Math.min(delay, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [items]);

  async function markRead(id: string) {
    if (!user) return;
    setBusyId(id);
    setError("");
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id)
      .eq("recipient_id", user.id);
    setBusyId("");
    if (updateError) setError(friendlyError(updateError));
    else
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)),
      );
  }

  async function markAllRead() {
    if (!user || !items.some((item) => !item.read_at)) return;
    setBusyAll(true);
    setError("");
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    setBusyAll(false);
    if (updateError) setError(friendlyError(updateError));
    else
      setItems((current) =>
        current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })),
      );
  }

  async function openNotification(item: NotificationItem) {
    const destination = typeof item.link === "string" ? item.link.trim() : "";
    if (!destination.startsWith("/") || destination.startsWith("//")) return;
    if (!item.read_at) await markRead(item.id);
    navigate(destination);
  }

  if (!enabled) return <FeatureDisabledNotice kind="notifications" />;
  if (!user) {
    return (
      <PageWorkspace area="activity" className="">
        <PageHeading
          eyebrow="NOTIFICATIONS"
          title="Notifications"
          subtitle="Sign in to view your activity feed."
        />
        <EmptyState
          icon={Mail}
          title="Sign in to continue"
          text="Your notifications are personal to your account and only visible after sign-in."
          action="Sign in"
          to="/login"
        />
      </PageWorkspace>
    );
  }

  return (
    <PageWorkspace area="activity" className="notifications-page">
      <PageHeading
        eyebrow="NOTIFICATIONS"
        title="Notifications"
        subtitle="Updates from people and spaces you care about."
      />
      <div className="notification-filter-scroll">
        <div className="filter-pills" role="group" aria-label="Filter notifications">
          {notificationFilters.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              className={filter === option.id ? "filter-pill is-active" : "filter-pill"}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className="button button-outline"
            disabled={busyAll || !items.some((item) => !item.read_at)}
            onClick={() => void markAllRead()}
          >
            {busyAll ? "Saving…" : "Mark all as read"}
          </button>
        </div>
      </div>
      {error ? (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <Button className="button button-outline" onClick={() => void load()} disabled={loading}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="admin-card admin-list">
        {loading ? (
          <p role="status" aria-live="polite">
            Loading notifications…
          </p>
        ) : visibleItems.length ? (
          visibleItems.map((item) => (
            <div key={item.id} className={`notification-card${item.read_at ? "" : " is-unread"}`}>
              <div className="notification-card-copy">
                <button
                  type="button"
                  className="notification-open"
                  onClick={() => void openNotification(item)}
                  disabled={
                    !item.link ||
                    !String(item.link).startsWith("/") ||
                    String(item.link).startsWith("//")
                  }
                >
                  <strong>{item.title || "VELORI"}</strong>
                  <small>{item.body || "No content"}</small>
                  <span>
                    {Number.isFinite(Date.parse(item.created_at))
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.created_at))
                      : ""}
                  </span>
                </button>
              </div>
              <div className="notification-card-tools">
                {!item.read_at && <span className="notification-unread-dot" aria-label="Unread" />}
                {!item.read_at && (
                  <button
                    className="button button-outline"
                    disabled={busyId === item.id}
                    onClick={() => void markRead(item.id)}
                  >
                    {busyId === item.id ? "Saving…" : "Mark read"}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="admin-empty">
            {items.length ? "No notifications in this category yet." : "No notifications yet."}
          </p>
        )}
      </div>
    </PageWorkspace>
  );
}

// Messaging and groups moved to their own module once they became real features
// with database-backed state. They are re-exported here because the router's lazy
// loader resolves every public view name out of this module.
export {
  GroupDetailPage,
  GroupMembersPage,
  GroupRequestsPage,
  GroupsPage,
  MessagesPage,
} from "./social-views";
export {
  ReelStudioPage,
  ReelsPage,
  StoriesArchivePage,
  StoriesPage,
  StoryTray,
} from "./social-media-pages";

export function PendingFeature({ kind }: { kind: string }) {
  const featureMap: Record<string, string> = {
    messages: "messaging_enabled",
    notifications: "notifications_enabled",
    stories: "stories_enabled",
    reels: "reels_enabled",
    groups: "groups_enabled",
  };
  const featureKey = featureMap[kind] ?? "experimental_ui";
  const enabled = useFeatureFlag(featureKey, true);
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}.`;

  if (enabled) {
    return (
      <div className="narrow-page">
        <PageHeading
          eyebrow="MORE TO COME"
          title={title}
          subtitle="This part of VELORI isn't available yet."
        />
        <EmptyState
          icon={kind === "messages" ? MessageCircle : kind === "notifications" ? Mail : Compass}
          title="We're building this carefully"
          text="This feature needs its own secure data model before we can make it available. We won't show made-up conversations or activity in the meantime."
          action="Back to the feed"
          to="/home"
        />
      </div>
    );
  }

  return (
    <div className="narrow-page">
      <PageHeading
        eyebrow="FEATURE DISABLED"
        title={title}
        subtitle="This capability is currently turned off by an administrator."
      />
      <EmptyState
        icon={ShieldCheck}
        title="Feature unavailable"
        text="This feature has been disabled by the platform administrator and is not accepting new activity."
        action="Back to the feed"
        to="/home"
      />
    </div>
  );
}

export function RouteDispatcher() {
  const location = useLocation();
  const { result, retry } = usePublishedCmsPage(location.pathname);

  if (result.status === "loading") return <CmsPageLoading />;
  if (result.status === "error") {
    return (
      <div className="narrow-page public-page">
        <Problem message={result.message} retry={retry} />
      </div>
    );
  }
  if (result.status === "missing") return <NotFound />;
  return <CmsPublicPage page={result.page as PublishedCmsPage} />;
}

export function HelpCenter() {
  return <PublicPage kind="help" />;
}
