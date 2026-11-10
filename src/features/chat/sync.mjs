import { normalizeChatPreferences } from "./policy.mjs";
export function mergeChatPreferences(remote, local, pending = {}) {
  const base = remote
    ? normalizeChatPreferences({
        theme: remote.theme,
        nicknames: remote.nicknames,
        childMode: remote.child_mode,
        hiddenIds: remote.hiddenIds,
      })
    : normalizeChatPreferences(local);
  return normalizeChatPreferences({
    ...base,
    ...pending,
    hiddenIds: [
      ...new Set([...base.hiddenIds, ...(pending.hiddenIds || (!remote ? local.hiddenIds : []))]),
    ],
  });
}
export async function syncChatPreferences(client, userId, conversationId, local, pending) {
  const [settings, hides] = await Promise.all([
    client
      .from("conversation_preferences")
      .select("theme,nicknames,child_mode")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .maybeSingle(),
    client
      .from("message_hides")
      .select("message_id,messages!inner(conversation_id)")
      .eq("user_id", userId)
      .eq("messages.conversation_id", conversationId)
      .limit(5000),
  ]);
  if (settings.error) throw settings.error;
  if (hides.error) throw hides.error;
  const remote = settings.data
    ? { ...settings.data, hiddenIds: hides.data.map((row) => row.message_id) }
    : null;
  const next = mergeChatPreferences(remote, local, pending);
  if (!remote || Object.keys(pending).length) {
    const saved = await client.from("conversation_preferences").upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
        theme: next.theme,
        nicknames: next.nicknames,
        child_mode: next.childMode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,conversation_id" },
    );
    if (saved.error) throw saved.error;
    const known = new Set(hides.data.map((row) => row.message_id));
    const fresh = next.hiddenIds.filter((id) => !known.has(id));
    for (let at = 0; at < fresh.length; at += 100) {
      const result = await client.from("message_hides").upsert(
        fresh.slice(at, at + 100).map((message_id) => ({ user_id: userId, message_id })),
        { onConflict: "user_id,message_id", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
    }
  }
  return next;
}
