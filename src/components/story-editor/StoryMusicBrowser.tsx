/* Copyright © 2026 VELORYZ. All rights reserved. */
import type { StudioMusicTrack } from "../../lib/studio-catalog";
import { MusicPicker } from "../studio/MusicPicker";
export function StoryMusicBrowser({
  selected,
  onSelect,
}: {
  selected: StudioMusicTrack | null;
  onSelect: (track: StudioMusicTrack | null) => void;
}) {
  return <MusicPicker studio="story" selected={selected} onSelect={onSelect} />;
}
