export type ImportedMusicLinkMetadata = {
  provider: string;
  sourceUrl: string;
  title: string;
  artistName: string;
  album: string;
  genre: string;
  durationSeconds: number | null;
  artworkUrl: string | null;
  note: string;
};
export function identifyMusicLink(input: string): {
  provider: string;
  sourceUrl: string;
  lookupUrl: string;
};
export function fetchMusicLinkMetadata(
  input: string,
  fetchImpl?: typeof fetch,
): Promise<ImportedMusicLinkMetadata>;
