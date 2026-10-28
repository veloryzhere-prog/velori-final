import { formatTime, type ReelDraft } from "../models";

/**
 * Rendering boundary for reel edits that must be baked into the uploaded video
 * file (trim, split segments, overlays, timed captions, audio changes).
 *
 * The production renderer is the `supabase/functions/reel-export` Edge
 * Function backed by an external FFmpeg service (`VELORI_FFMPEG_RENDERER_URL`).
 * It is not available in this build, so the studio never pretends these edits
 * were applied: publishing with such edits requires an explicit confirmation.
 */
const RENDERER_LIMITATION =
  "Rendering trim points, split segments, text overlays, timed captions or volume changes into a video file requires the VELORI FFmpeg renderer service, which is not available in this build.";

export interface ReelRenderRequest {
  source: File;
  trimStart: number;
  trimEnd: number;
  overlayText: string;
  overlayX: number;
  overlayY: number;
  captions: ReelDraft["captions"];
  volume: number;
  muted: boolean;
  splits: number[];
}

export interface ReelRenderAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  limitation: string;
  render(request: ReelRenderRequest): Promise<File>;
}

export const ffmpegReelRenderAdapter: ReelRenderAdapter = {
  id: "velori-ffmpeg-renderer",
  label: "VELORI FFmpeg renderer",
  isConfigured: () => false,
  limitation: RENDERER_LIMITATION,
  render: async () => {
    throw new Error(RENDERER_LIMITATION);
  },
};

const TRIM_EPSILON_SECONDS = 0.05;

/**
 * Lists the edits in a reel draft that the current pipeline cannot bake into
 * the published video file. An empty list means the uploaded file already
 * equals what the editor preview shows.
 */
export function collectUnrenderedReelEdits(draft: ReelDraft): string[] {
  const edits: string[] = [];
  const trimmed =
    draft.duration > 0 &&
    (draft.trimStart > TRIM_EPSILON_SECONDS ||
      draft.trimEnd < draft.duration - TRIM_EPSILON_SECONDS);
  if (trimmed)
    edits.push(
      `trim points (${formatTime(draft.trimStart)}–${formatTime(draft.trimEnd)} of ${formatTime(draft.duration)})`,
    );
  if (draft.splits.length) edits.push(`${draft.splits.length} split marker(s)`);
  if (draft.overlayText.trim()) edits.push("text overlay");
  if (draft.captions.length) edits.push(`${draft.captions.length} timed caption(s)`);
  if (draft.muted || draft.volume !== 1) edits.push("volume changes");
  return edits;
}

export class UnrenderedReelEditsError extends Error {
  readonly edits: string[];

  constructor(edits: string[]) {
    super(`These reel edits cannot be rendered into the uploaded video: ${edits.join(", ")}.`);
    this.name = "UnrenderedReelEditsError";
    this.edits = edits;
  }
}
