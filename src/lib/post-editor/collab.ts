import type { SupabaseClient } from "@supabase/supabase-js";
import {
  flattenDraftPresence as flatten,
  sendPostDraftCursor as send,
  subscribeToPostDraftCollaboration as subscribe,
} from "./collab.mjs";

export type CollaborativeDraft = {
  id: string;
  author_id: string;
  body: string;
  collaboration_status: string;
  version_number: number;
  updated_at: string;
};

export type PostDraftChannel = {
  send: (payload: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }) => Promise<"ok" | "timed out" | "error">;
};

type PresenceUser = { user_id: string; display_name?: string; color?: string; last_seen?: string };
type CollaborationConfig = {
  client: SupabaseClient;
  draftId: string;
  user: { id: string; displayName?: string; email?: string; color?: string };
  onPresence?: (state: Record<string, PresenceUser[]>) => void;
  onDraftChange?: (draft: CollaborativeDraft) => void;
  onCommentChange?: (change: unknown) => void;
  onSuggestionChange?: (change: unknown) => void;
  onActivityChange?: (change: unknown) => void;
  onCursor?: (cursor: {
    user_id: string;
    display_name: string;
    color: string;
    x: number;
    y: number;
  }) => void;
  onChannel?: (channel: PostDraftChannel) => void;
  onStatus?: (status: string) => void;
};

export function subscribeToPostDraftCollaboration(config: CollaborationConfig) {
  return subscribe(config);
}

export function flattenDraftPresence(state: Record<string, PresenceUser[]>) {
  return flatten(state) as PresenceUser[];
}

export function sendPostDraftCursor(
  channel: PostDraftChannel | null,
  cursor: { user_id: string; display_name: string; color: string; x: number; y: number },
) {
  return send(channel, cursor);
}
