import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Film, FileText, Image, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { signMessageAttachments } from "../../lib/message-media";
import { containsBlockedLanguage } from "./policy.mjs";
type SharedRow = {
  id: string;
  body: string;
  created_at: string;
  shared_content_type: string | null;
  shared_content_id: string | null;
  message_attachments: {
    id: string;
    object_path: string;
    media_type: string;
    alt_text: string;
    signed_url?: string;
  }[];
};
export function SharedChatContent({
  conversationId,
  tab,
  hiddenIds,
  childMode,
}: {
  conversationId: string;
  tab: "media" | "reels" | "files";
  hiddenIds: string[];
  childMode: boolean;
}) {
  const [rows, setRows] = useState<SharedRow[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    if (!offset) setRows([]);
    void (async () => {
      try {
        let query = supabase
          .from("messages")
          .select(
            "id,body,created_at,shared_content_type,shared_content_id,message_attachments(id,object_path,media_type,alt_text)",
          )
          .eq("conversation_id", conversationId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + 29);
        if (tab === "reels") query = query.eq("shared_content_type", "reel");
        const result = await query;
        if (result.error) throw result.error;
        const loaded = (result.data || []) as unknown as SharedRow[];
        const signed = await signMessageAttachments(
          loaded.flatMap((row) => row.message_attachments?.map((a) => a.object_path) || []),
        );
        if (!active) return;
        setRows((current) => [
          ...new Map(
            [
              ...(offset ? current : []),
              ...loaded.map((row) => ({
                ...row,
                message_attachments: (row.message_attachments || []).map((a) => ({
                  ...a,
                  signed_url: signed.get(a.object_path),
                })),
              })),
            ].map((row) => [row.id, row]),
          ).values(),
        ]);
        setMore(loaded.length === 30);
      } catch {
        if (active) setError("Shared content couldn’t load. Try again.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [conversationId, tab, offset, retry]);
  const visible = rows.filter(
    (row) => !hiddenIds.includes(row.id) && (!childMode || !containsBlockedLanguage(row.body)),
  );
  const items = visible.flatMap((row) =>
    tab === "reels" && row.shared_content_id
      ? [
          <Link
            key={row.id}
            className="chat-shared-reel"
            to={"/reels?reel=" + encodeURIComponent(row.shared_content_id)}
          >
            <Film size={28} />
            <strong>Shared reel</strong>
            <span>{new Date(row.created_at).toLocaleDateString()}</span>
            <small>Open reel →</small>
          </Link>,
        ]
      : row.message_attachments
          .filter((a) =>
            tab === "files"
              ? !["image", "video"].includes(a.media_type)
              : tab === "media" && ["image", "video"].includes(a.media_type),
          )
          .map((a) =>
            a.signed_url ? (
              <a
                key={a.id}
                href={a.signed_url}
                target="_blank"
                rel="noreferrer"
                className="chat-shared-item"
              >
                {a.media_type === "image" ? (
                  <img
                    src={a.signed_url}
                    alt={childMode ? "Shared image" : a.alt_text || "Shared image"}
                    loading="lazy"
                  />
                ) : a.media_type === "video" ? (
                  <>
                    <Film size={30} />
                    <span>Video</span>
                  </>
                ) : (
                  <>
                    <FileText size={24} />
                    <span>{childMode ? "Shared file" : a.alt_text || "File"}</span>
                  </>
                )}
              </a>
            ) : (
              <span key={a.id} className="chat-shared-item">
                <Image size={22} />
                Preview unavailable
              </span>
            ),
          ),
  );
  return (
    <div>
      <p className="chat-detail-note">
        Private to conversation members. Shared media is not inspected by Child Mode.
      </p>
      <div className="chat-shared-grid">{items}</div>
      {!items.length && !busy && !error ? (
        <p className="chat-panel-empty">No {tab} in the messages scanned so far.</p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {busy ? <p role="status">Loading shared content…</p> : null}
      {!busy && (more || error) ? (
        <button
          type="button"
          className="button button-outline"
          onClick={() => (error ? setRetry((r) => r + 1) : setOffset((o) => o + 30))}
        >
          <RefreshCw size={15} />
          {error ? "Try again" : "Load more messages"}
        </button>
      ) : null}
      <p className="chat-detail-note">
        Media links can expire. Close and reopen this panel to refresh them.
      </p>
    </div>
  );
}
