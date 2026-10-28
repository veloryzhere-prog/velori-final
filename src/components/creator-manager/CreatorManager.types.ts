export type CreatorSection =
  | "overview"
  | "music"
  | "stickers"
  | "templates"
  | "brand-kit"
  | "story"
  | "reel"
  | "post"
  | "design"
  | "source"
  | "tools"
  | "versions";

export type StudioTarget = "story" | "reel" | "post";

export const STUDIO_TARGETS: Array<{ id: StudioTarget; label: string }> = [
  { id: "story", label: "Story" },
  { id: "reel", label: "Reel" },
  { id: "post", label: "Post" },
];
