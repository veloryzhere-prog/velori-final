export const CHAT_THEMES = ["rose", "sunshine", "lavender", "ocean", "paper"];
export const DEFAULT_CHAT_PREFERENCES = {
  theme: "rose",
  nicknames: {},
  childMode: false,
  hiddenIds: [],
};
const WORDS = [
  "lund",
  "chut",
  "madherchod",
  "madarchod",
  "maderchod",
  "motherchod",
  "chod",
  "bhosdike",
  "bhosdi",
  "behenchod",
  "bhenchod",
  "randi",
  "fuck",
  "fucking",
  "motherfucker",
  "bitch",
  "asshole",
  "cunt",
  "लंड",
  "लौड़ा",
  "चूत",
  "मादरचोद",
  "भोसड़ीके",
  "बहनचोद",
  "रंडी",
];
const asciiWords = WORDS.filter((word) => /^[a-z]+$/.test(word));
const wordSet = new Set(WORDS);
const patterns = asciiWords.map(
  (word) =>
    new RegExp(
      "(?:^|[^a-z0-9])" + [...word].join("[\\s._*!,?:;/'\\\\|~^+=(){}<>-]{0,3}") + "(?![a-z0-9])",
    ),
);
export function containsBlockedLanguage(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(
      /[013457@$]/g,
      (character) =>
        ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" })[character],
    );
  if ((normalized.match(/[\p{L}\p{M}\p{N}]+/gu) || []).some((word) => wordSet.has(word)))
    return true;
  return patterns.some((pattern) => pattern.test(normalized));
}
export function normalizeChatPreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    theme: CHAT_THEMES.includes(source.theme) ? source.theme : "rose",
    childMode: source.childMode === true,
    nicknames: Object.fromEntries(
      Object.entries(
        source.nicknames && typeof source.nicknames === "object" ? source.nicknames : {},
      )
        .filter(([key, name]) => typeof name === "string" && key.length <= 80)
        .map(([key, name]) => [key, name.slice(0, 32)]),
    ),
    hiddenIds: Array.isArray(source.hiddenIds)
      ? [
          ...new Set(source.hiddenIds.filter((id) => typeof id === "string" && id.length <= 80)),
        ].slice(-5000)
      : [],
  };
}
export function chatPreferenceKey(userId, conversationId) {
  return "velori-chat-v1:" + userId + ":" + conversationId;
}
export function safeChatAttachmentName(value) {
  return String(value || "Attachment").slice(0, 240);
}
