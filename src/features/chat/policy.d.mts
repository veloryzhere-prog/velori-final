export type ChatPreferences = {
  theme: string;
  nicknames: Record<string, string>;
  childMode: boolean;
  hiddenIds: string[];
};
export const CHAT_THEMES: string[];
export const DEFAULT_CHAT_PREFERENCES: ChatPreferences;
export function containsBlockedLanguage(value: unknown): boolean;
export function normalizeChatPreferences(value: unknown): ChatPreferences;
export function chatPreferenceKey(userId: string, conversationId: string): string;
export function safeChatAttachmentName(value: unknown): string;
