import type { ChatPreferences } from "./policy.mjs";
export function mergeChatPreferences(
  remote: any,
  local: ChatPreferences,
  pending?: Partial<ChatPreferences>,
): ChatPreferences;
export function syncChatPreferences(
  client: any,
  userId: string,
  conversationId: string,
  local: ChatPreferences,
  pending: Partial<ChatPreferences>,
): Promise<ChatPreferences>;
