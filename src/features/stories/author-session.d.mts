export interface AuthorSession {
  author: string;
  indices: number[];
  position: number;
  authorIndex: number;
  authorCount: number;
  nextAuthor: number | null;
  previousAuthor: number | null;
  nextMoment: number | null;
  previousMoment: number | null;
}
export function authorSession(
  stories: ReadonlyArray<{ author_id: string }>,
  index: number,
): AuthorSession | null;
