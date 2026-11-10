export type CollaborativeDraft = {
  id: string;
  author_id: string;
  body: string;
  collaboration_status: string;
  version_number: number;
  updated_at: string;
};

export type PresenceUser = {
  user_id: string;
  display_name?: string;
  color?: string;
  last_seen?: string;
};
export type DraftCursor = {
  user_id: string;
  display_name: string;
  color: string;
  x: number;
  y: number;
};
export type DraftChannel = {
  send: (payload: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }) => Promise<"ok" | "timed out" | "error">;
};

export function subscribeToPostDraftCollaboration(config: {
  client: import("@supabase/supabase-js").SupabaseClient;
  draftId: string;
  user: { id: string; displayName?: string; email?: string; color?: string };
  onPresence?: (state: Record<string, PresenceUser[]>) => void;
  onDraftChange?: (draft: CollaborativeDraft) => void;
  onCommentChange?: (change: unknown) => void;
  onSuggestionChange?: (change: unknown) => void;
  onActivityChange?: (change: unknown) => void;
  onCursor?: (cursor: DraftCursor) => void;
  onChannel?: (channel: DraftChannel) => void;
  onStatus?: (status: string) => void;
}): () => void;

export function flattenDraftPresence(state: Record<string, PresenceUser[]>): PresenceUser[];
export function sendPostDraftCursor(
  channel: DraftChannel | null,
  cursor: DraftCursor,
): Promise<"ok" | "timed out" | "error"> | undefined;
