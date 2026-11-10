/** Author-scoped story playback, stable even when source rows interleave creators. */
export function authorSession(stories, index) {
  if (!Array.isArray(stories) || !Number.isInteger(index) || index < 0 || index >= stories.length)
    return null;
  const author = stories[index]?.author_id;
  if (!author) return null;
  const authors = [...new Set(stories.map((story) => story?.author_id).filter(Boolean))];
  const authorIndex = authors.indexOf(author);
  const indices = stories.flatMap((story, i) => (story?.author_id === author ? [i] : []));
  const position = indices.indexOf(index);
  const findAuthor = (id) => stories.findIndex((story) => story?.author_id === id);
  const lastOfAuthor = (id) => {
    for (let i = stories.length - 1; i >= 0; i--) if (stories[i]?.author_id === id) return i;
    return -1;
  };
  return {
    author,
    indices,
    position,
    authorIndex,
    authorCount: authors.length,
    nextAuthor: authorIndex + 1 < authors.length ? findAuthor(authors[authorIndex + 1]) : null,
    previousAuthor: authorIndex > 0 ? findAuthor(authors[authorIndex - 1]) : null,
    nextMoment:
      position + 1 < indices.length
        ? indices[position + 1]
        : authorIndex + 1 < authors.length
          ? findAuthor(authors[authorIndex + 1])
          : null,
    previousMoment:
      position > 0
        ? indices[position - 1]
        : authorIndex > 0
          ? lastOfAuthor(authors[authorIndex - 1])
          : null,
  };
}
