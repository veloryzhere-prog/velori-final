export type ForgeLandingMode = "build" | "ask";

export type ForgeLandingDraft = {
  prompt: string;
  mode: ForgeLandingMode;
  createdAt: number;
};

export const FORGE_LANDING_DRAFT_KEY = "velori.forge.landing-draft.v1";
export const FORGE_LANDING_DRAFT_MAX_AGE = 30 * 60 * 1000;
export const FORGE_LANDING_PROMPT_LIMIT = 4000;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveForgeLandingDraft(
  storage: DraftStorage,
  input: { prompt: string; mode: ForgeLandingMode },
  now = Date.now(),
) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Describe what you want to create first.");
  if (prompt.length > FORGE_LANDING_PROMPT_LIMIT)
    throw new Error("Keep the prompt under 4,000 characters.");
  if (input.mode !== "build" && input.mode !== "ask")
    throw new Error("Choose Build or Ask before continuing.");
  storage.setItem(
    FORGE_LANDING_DRAFT_KEY,
    JSON.stringify({ version: 1, prompt, mode: input.mode, createdAt: now }),
  );
}

export function parseForgeLandingDraft(value: unknown, now = Date.now()): ForgeLandingDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  const prompt = draft.prompt;
  const mode = draft.mode;
  const createdAt = draft.createdAt;
  if (
    draft.version !== 1 ||
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > FORGE_LANDING_PROMPT_LIMIT ||
    (mode !== "build" && mode !== "ask") ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt) ||
    createdAt > now ||
    now - createdAt > FORGE_LANDING_DRAFT_MAX_AGE
  )
    return null;
  return { prompt, mode, createdAt };
}

export function readForgeLandingDraft(storage: DraftStorage, now = Date.now()) {
  let value: unknown;
  try {
    value = JSON.parse(storage.getItem(FORGE_LANDING_DRAFT_KEY) ?? "null");
  } catch {
    storage.removeItem(FORGE_LANDING_DRAFT_KEY);
    return null;
  }
  const draft = parseForgeLandingDraft(value, now);
  if (!draft) storage.removeItem(FORGE_LANDING_DRAFT_KEY);
  return draft;
}

export function clearForgeLandingDraft(storage: DraftStorage) {
  storage.removeItem(FORGE_LANDING_DRAFT_KEY);
}

export function consumeForgeLandingDraft(storage: DraftStorage, now = Date.now()) {
  const draft = readForgeLandingDraft(storage, now);
  if (draft) clearForgeLandingDraft(storage);
  return draft;
}

export function parseForgeLandingHandoff(
  value: unknown,
): Pick<ForgeLandingDraft, "prompt" | "mode"> | null {
  if (!value || typeof value !== "object") return null;
  const handoff = value as Record<string, unknown>;
  if (
    typeof handoff.prompt !== "string" ||
    !handoff.prompt.trim() ||
    handoff.prompt.length > FORGE_LANDING_PROMPT_LIMIT ||
    (handoff.mode !== "build" && handoff.mode !== "ask")
  )
    return null;
  return { prompt: handoff.prompt.trim(), mode: handoff.mode };
}
