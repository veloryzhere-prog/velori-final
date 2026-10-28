import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { LockKeyhole, Video } from "lucide-react";
import { useAuth } from "../../../lib/auth";
import { useFeatureFlag } from "../../../lib/feature-flags";
import { friendlyError, supabase } from "../../../lib/supabase";
import { loadDraftMedia } from "../../../lib/post-media";
import { EmptyState, RuntimeLoading } from "../../../app/shell";
import ReelStudio from "../../../components/reel-editor/ReelStudio";
import { CreatorStudio } from "./CreatorStudio";
import {
  createInitialPost,
  initialReel,
  uid,
  type Layer,
  type PostDraft,
  type PublishingAdapter,
  type ReelDraft,
  type Slide,
  type StudioMode,
} from "../models";
import { readStoredDraft, writeStoredDraft } from "../services/persistence";
import { publishPostDraft, publishReelDraft, type PublishResult } from "../services/publishing";
import "../styles/creator-studios.css";

interface StudioDrafts {
  post: PostDraft;
  reel: ReelDraft;
}

/** Maps an existing `post_drafts` record (plus its media) into studio slides. */
async function restoreServerDraft(draftId: string) {
  const { data, error } = await supabase
    .from("post_drafts")
    .select("id,author_id,body")
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const media = await loadDraftMedia(draftId);
  const imageItems = media.filter((item) => item.media_type === "image");
  const videoCount = media.length - imageItems.length;
  const slides: Slide[] = imageItems.map((item) => {
    const layer: Layer = {
      id: uid(),
      kind: "image",
      name: item.alt_text || "Uploaded image",
      src: item.preview_url,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 1,
    };
    return { id: uid(), background: "#ffffff", layers: [layer] };
  });
  return {
    authorId: data.author_id,
    videoCount,
    draft: {
      slides: slides.length ? slides : [createInitialPost().slides[0]],
      activeSlideId: (slides[0] ?? createInitialPost().slides[0]).id,
      caption: data.body ?? "",
    } satisfies PostDraft,
  };
}

export function CreatorStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const { user, loading } = useAuth();
  const reelsEnabled = useFeatureFlag("reels_enabled", true);
  const mode: StudioMode = location.pathname.startsWith("/reels/create") ? "reel" : "post";

  const [loaded, setLoaded] = useState<StudioDrafts | null>(null);
  const [linkedDraftId, setLinkedDraftId] = useState<string | null>(null);
  const [loadNotice, setLoadNotice] = useState<string>();
  const [publishStatus, setPublishStatus] = useState<string>();
  const [studioDark, setStudioDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  const latestRef = useRef<StudioDrafts | null>(null);
  const userIdRef = useRef<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setStudioDark(root.dataset.theme === "dark"));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    userIdRef.current = user.id;
    void (async () => {
      let post = createInitialPost();
      let reel = initialReel;
      try {
        const stored = await readStoredDraft(user.id);
        if (stored) {
          post = stored.post;
          reel = stored.reel;
        }
        if (requestedDraftId) {
          const restored = await restoreServerDraft(requestedDraftId);
          if (!restored) setLoadNotice("That draft does not exist or belongs to another account.");
          else if (restored.authorId === user.id) {
            post = restored.draft;
            setLinkedDraftId(requestedDraftId);
            if (restored.videoCount)
              setLoadNotice(
                `${restored.videoCount} video item(s) from the earlier editor cannot be edited here and were not restored.`,
              );
          } else {
            // Readable through collaboration but owned by someone else: open an
            // editable copy that never links back to (or overwrites) the original.
            post = restored.draft;
            setLoadNotice(
              "This draft belongs to another creator, so it opened as your own copy. Publishing will not modify the original draft.",
            );
          }
        }
      } catch (cause) {
        if (!active) return;
        setLoadNotice(
          `Your previous draft could not be restored (${friendlyError(
            cause as { code?: string; message?: string },
          )}). Starting from a fresh draft.`,
        );
      }
      if (!active) return;
      latestRef.current = { post, reel };
      setLoaded({ post, reel });
    })();
    return () => {
      active = false;
    };
    // Depend on the user id, not the user object, so a token refresh can never
    // re-hydrate storage over edits already made in this session.
  }, [loading, user?.id, requestedDraftId]);

  const saveDrafts = useCallback(async (post: PostDraft, reel: ReelDraft) => {
    const current = userRef.current;
    if (!current) return;
    latestRef.current = { post, reel };
    await writeStoredDraft(current.id, post, reel);
  }, []);

  useEffect(() => {
    // Flush the latest drafts when the studio unmounts (tab switch or route
    // change) so the final keystrokes are never lost.
    return () => {
      const latest = latestRef.current;
      const userId = userIdRef.current;
      if (latest && userId) {
        void writeStoredDraft(userId, latest.post, latest.reel).catch(() => undefined);
      }
    };
  }, []);

  const publishingAdapter = useMemo<PublishingAdapter | undefined>(() => {
    if (!user) return undefined;
    return {
      id: "velori-supabase",
      label: "VELORI",
      isConfigured: () => true,
      publish: async ({ kind, draft, acknowledgeUnrendered }): Promise<PublishResult> => {
        if (kind === "post") {
          const result = await publishPostDraft({
            user,
            draft: draft as PostDraft,
            linkedDraftId,
            onStatus: setPublishStatus,
          });
          const latest = latestRef.current;
          await writeStoredDraft(user.id, createInitialPost(), latest?.reel ?? initialReel).catch(
            () => undefined,
          );
          navigate(result.url ?? `/post/${result.id}`);
          return result;
        }
        const result = await publishReelDraft({
          user,
          draft: draft as ReelDraft,
          acknowledgeUnrendered,
          onStatus: setPublishStatus,
        });
        const latest = latestRef.current;
        await writeStoredDraft(user.id, latest?.post ?? createInitialPost(), initialReel).catch(
          () => undefined,
        );
        navigate(result.url ?? "/reels");
        return result;
      },
    };
  }, [user, linkedDraftId, navigate]);

  if (mode === "reel" && !reelsEnabled)
    return (
      <div className="velori-creator-root" data-studio-theme={studioDark ? "dark" : "light"}>
        <EmptyState
          icon={Video}
          title="Reels are turned off"
          text="Reel creation is currently unavailable on VELORI."
        />
      </div>
    );
  if (loading) return <RuntimeLoading label="Checking your session…" />;
  if (!user)
    return (
      <div className="velori-creator-root" data-studio-theme={studioDark ? "dark" : "light"}>
        <EmptyState
          icon={mode === "reel" ? Video : LockKeyhole}
          title={mode === "reel" ? "Sign in to create a reel" : "Your voice belongs here"}
          text={
            mode === "reel"
              ? "Sign in to open the reel studio."
              : "Sign in to share something with the VELORI community."
          }
          action="Sign in"
          to="/login"
        />
      </div>
    );
  // Reels run on the dedicated Reel Studio 2.0 editor. The Post Studio keeps
  // the shared creator studio shell so its existing flows are untouched.
  if (mode === "reel")
    return (
      <div className="velori-creator-root" data-studio-theme={studioDark ? "dark" : "light"}>
        {loadNotice ? (
          <div className="studio-route-notice" role="status">
            {loadNotice}
          </div>
        ) : null}
        <ReelStudio
          userId={user.id}
          onClose={() => navigate("/reels")}
          onPublished={(reelId) => navigate(`/reels?reel=${encodeURIComponent(reelId)}`)}
        />
      </div>
    );
  if (!loaded) return <RuntimeLoading label="Loading your creative workspace…" />;

  return (
    <div className="velori-creator-root" data-studio-theme={studioDark ? "dark" : "light"}>
      {publishStatus ? (
        <div className="studio-route-status" role="status">
          {publishStatus}
        </div>
      ) : null}
      {loadNotice ? (
        <div className="studio-route-notice" role="status">
          {loadNotice}
        </div>
      ) : null}
      <CreatorStudio
        initialPost={loaded.post}
        initialReelDraft={loaded.reel}
        onDraftChange={saveDrafts}
        publishingAdapter={publishingAdapter}
        mode={mode}
        onModeChange={(next) => navigate(next === "post" ? "/create" : "/reels/create")}
      />
    </div>
  );
}
