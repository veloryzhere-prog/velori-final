import "../design-system/tokens.css";
import "../index.css";
import "../styles/reference-ui.css";
import "../styles/motion-experience.css";
import "../styles/polished-experience.css";
import "../styles/clean-product.css";
import "../styles/page-workspaces.css";
import "../product/product.css";
import "../styles/spatial-motion.css";
import "../styles/studio-completion.css";
import "../styles/admin-workspace.css";
import "../styles/responsive-refinement.css";
import "../components/status-surfaces.css";
import "../components/messaging-refinements.css";
import "../features/chat/chat.css";
import "../styles/motion-finish.css";
import "../styles/inbox-finish.css";
import "../styles/social-app-finish.css";
import "../features/creator-studios/styles/creator-studios.css";
/* Copyright © 2026 VELORYZ. All rights reserved. Development-only inspection harness; not a production entry. */
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { MotionProvider } from "../motion/MotionProvider";
import { AuthProvider } from "../lib/auth";
import { ProductFrame } from "../product/ProductFrame";
import { Feed, Explore, ProfilePage } from "../app/views";
import { CreatorStudio } from "../features/creator-studios/components/CreatorStudio";
import ReelStudio from "../components/reel-editor/ReelStudio";
import { createInitialPost, initialReel } from "../features/creator-studios/models";
import { FeedVideo } from "../components/social/PostMediaGallery";
import { MusicPicker } from "../components/studio/MusicPicker";
import {
  drawStoryExportFrame,
  prepareStoryExportAssets,
} from "../lib/story-editor/export-renderer";
import { DEFAULT_STORY_MEDIA_SETTINGS } from "../lib/story-editor/media-tools.mjs";
import type { StudioMusicTrack } from "../lib/studio-catalog";

function PlaybackAudit() {
  const [url, setUrl] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <section>
      <h1>Post playback · local test media only</h1>
      <input
        aria-label="Choose playback test video"
        type="file"
        accept="video/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setUrl(URL.createObjectURL(file));
        }}
      />
      {url && (
        <>
          <FeedVideo src={url} alt="First playback test" />
          <div style={{ height: "110vh" }}>Scroll to the next post</div>
          <FeedVideo src={url} alt="Second playback test" />
        </>
      )}
    </section>
  );
}
function RendererCheck() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Not run");
  async function run() {
    const source = document.createElement("canvas");
    source.width = 100;
    source.height = 200;
    const paint = source.getContext("2d")!;
    paint.fillStyle = "#00cc88";
    paint.fillRect(0, 0, 100, 200);
    paint.fillStyle = "#cc2233";
    paint.fillRect(40, 80, 20, 40);
    const now = new Date().toISOString();
    const frame = {
      slide: {
        id: "precision",
        storyId: "precision",
        order: 0,
        mediaType: "image" as const,
        mediaUrl: source.toDataURL(),
        duration: 2,
        backgroundType: "solid" as const,
        background: "#110022",
        stickers: [],
        createdAt: now,
        updatedAt: now,
      },
      textOverlays: [],
      shapes: [],
      mediaSettings: { ...DEFAULT_STORY_MEDIA_SETTINGS },
      brand: {
        logoUrl: null,
        logoX: 0,
        logoY: 0,
        logoScale: 1,
        logoOpacity: 1,
        watermarkText: "",
        watermarkOpacity: 0,
      },
    };
    const assets = await prepareStoryExportAssets([frame], null);
    const target = canvas.current!;
    drawStoryExportFrame(target, frame, assets);
    const center = [...target.getContext("2d")!.getImageData(50, 100, 1, 1).data];
    const corner = [...target.getContext("2d")!.getImageData(5, 5, 1, 1).data];
    const passed = center[0] === 204 && center[1] === 34 && corner[1] === 204;
    target.dataset.result = passed ? "PASS" : "FAIL";
    setStatus(JSON.stringify({ passed, center, corner }));
  }
  return (
    <section style={{ padding: 20 }}>
      <h1>Story publish renderer</h1>
      <p>Precision fixture: green media, red center, plum background.</p>
      <button onClick={() => void run()}>Run actual canvas renderer</button>
      <p role="status">{status}</p>
      <canvas ref={canvas} width={100} height={200} />
    </section>
  );
}
const screen = new URLSearchParams(location.search).get("screen") || "home";
const profileUsername = new URLSearchParams(location.search).get("username") || "";
function Content() {
  const [selected, setSelected] = useState<StudioMusicTrack | null>(null);
  const content =
    screen === "playback" ? (
      <PlaybackAudit />
    ) : screen === "render" ? (
      <RendererCheck />
    ) : screen === "reel" ? (
      <ReelStudio userId="00000000-0000-4000-8000-000000000032" onClose={() => {}} />
    ) : screen === "post" ? (
      <CreatorStudio
        initialPost={createInitialPost()}
        initialReelDraft={initialReel}
        mode="post"
        onModeChange={() => {}}
        onDraftChange={async () => {}}
        publishingAdapter={{
          id: "qa-readonly",
          label: "QA: publishing disabled",
          isConfigured: () => false,
          publish: async () => {
            throw new Error("Publishing is disabled in component QA");
          },
        }}
      />
    ) : screen === "music" ? (
      <MusicPicker studio="story" selected={selected} onSelect={setSelected} />
    ) : screen === "profile" ? (
      <ProfilePage />
    ) : screen === "explore" ? (
      <Explore />
    ) : (
      <Feed />
    );
  return (
    <ProductFrame
      items={["home", "explore", "reels", "messages", "notifications", "saved", "profile"].map(
        (name) => ({ route: "/" + name, label: name }),
      )}
      profile={null}
      messages={0}
      notifications={0}
      onSignOut={() => {}}
      signOutError=""
      theme={
        <button
          onClick={() => {
            document.documentElement.dataset.theme =
              document.documentElement.dataset.theme === "dark" ? "light" : "dark";
          }}
        >
          Theme
        </button>
      }
      stories
      reels
      online
      messagingEnabled
      notificationsEnabled
    >
      {content}
    </ProductFrame>
  );
}
if (import.meta.env.DEV)
  createRoot(document.getElementById("root")!).render(
    <MotionProvider>
      <AuthProvider>
        <RouterProvider
          router={createMemoryRouter(
            [
              { path: "/profile/:username", element: <Content /> },
              { path: "*", element: <Content /> },
            ],
            {
              initialEntries: [
                screen === "profile"
                  ? `/profile/${encodeURIComponent(profileUsername)}`
                  : screen === "reel"
                    ? "/reels/create"
                    : screen === "post"
                      ? "/create"
                      : "/" + screen,
              ],
            },
          )}
        />
      </AuthProvider>
    </MotionProvider>,
  );
