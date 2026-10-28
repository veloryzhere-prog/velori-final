/**
 * Connect a signed-in editor to the protected Postgres changes and Presence
 * channel for one draft. Supabase remains the durable source of truth.
 */
export function subscribeToPostDraftCollaboration({
  client,
  draftId,
  user,
  onPresence = () => {},
  onDraftChange = () => {},
  onCommentChange = () => {},
  onSuggestionChange = () => {},
  onActivityChange = () => {},
  onCursor = () => {},
  onChannel = () => {},
  onStatus = () => {},
}) {
  if (!client || !draftId || !user?.id)
    throw new Error("A client, draft ID and signed-in user are required.");
  const channel = client
    .channel(`post-draft:${draftId}`, {
      config: { private: true, presence: { key: user.id }, broadcast: { self: false } },
    })
    .on("presence", { event: "sync" }, () => onPresence(channel.presenceState()))
    .on("broadcast", { event: "cursor" }, ({ payload }) => onCursor(payload))
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "post_drafts", filter: `id=eq.${draftId}` },
      ({ new: draft }) => onDraftChange(draft),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "post_draft_comments",
        filter: `draft_id=eq.${draftId}`,
      },
      (change) => onCommentChange(change),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "post_draft_suggestions",
        filter: `draft_id=eq.${draftId}`,
      },
      (change) => onSuggestionChange(change),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "post_draft_activity",
        filter: `draft_id=eq.${draftId}`,
      },
      (change) => onActivityChange(change),
    )
    .subscribe((status) => {
      onStatus(status);
      if (status === "SUBSCRIBED") {
        onChannel(channel);
        void channel.track({
          user_id: user.id,
          display_name: user.displayName || user.email || "Collaborator",
          color: user.color || "#8b72e8",
          last_seen: new Date().toISOString(),
        });
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}

export function sendPostDraftCursor(channel, cursor) {
  if (!channel || !cursor) return;
  return channel.send({ type: "broadcast", event: "cursor", payload: cursor });
}

export function flattenDraftPresence(state = {}) {
  return Object.values(state)
    .flat()
    .filter((presence) => presence && presence.user_id);
}
