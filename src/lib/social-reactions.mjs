/** These tables allow insert/delete, not update. Duplicate inserts are harmless. */
export function setSocialReaction(client, table, identity, active) {
  const key = table === "likes" || table === "saves" ? "post_id" : "reel_id";
  if (!["likes", "saves", "reel_likes", "reel_saves"].includes(table))
    throw new Error("Unsupported reaction.");
  if (!identity.user_id || !identity[key]) throw new Error("Reaction identity is required.");
  const row = { [key]: identity[key], user_id: identity.user_id };
  return active
    ? client.from(table).delete().eq(key, row[key]).eq("user_id", row.user_id)
    : client.from(table).upsert(row, { onConflict: `${key},user_id`, ignoreDuplicates: true });
}
