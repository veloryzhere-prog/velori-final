export type ReelSelection =
  | { kind: "clip"; id: string }
  | { kind: "text"; id: string }
  | { kind: "sticker"; id: string }
  | { kind: "caption"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "project"; id: null };
