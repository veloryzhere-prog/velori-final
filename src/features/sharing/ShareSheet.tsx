import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Copy, LoaderCircle, Search, Send, Share2 } from "lucide-react";
import { Dialog } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { friendlyError, supabase } from "../../lib/supabase";
import { studioId } from "../artifacts/identity";
import "./sharing.css";

type Person = { id: string; username: string; display_name: string };
export function ShareToMessageDialog({
  contentType,
  contentId,
  onClose,
}: {
  contentType: "post" | "reel" | "story";
  contentId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const nonces = useRef(new Map<string, string>());
  const route =
    contentType === "post"
      ? `/post/${encodeURIComponent(contentId)}`
      : contentType === "reel"
        ? `/reels?reel=${encodeURIComponent(contentId)}`
        : `/stories?story=${encodeURIComponent(contentId)}`;
  const url = `${window.location.origin}${route}`;
  const handle = username.trim().replace(/^@/, "").toLowerCase();
  useEffect(() => {
    let active = true;
    setPeople([]);
    setSearching(false);
    if (!user || !/^[a-z0-9_]{2,24}$/.test(handle)) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id,username,display_name")
          .ilike("username", `${handle.replace(/_/g, "\\_")}%`)
          .neq("id", user.id)
          .order("username")
          .limit(6);
        if (!active) return;
        if (searchError) setError(friendlyError(searchError));
        else setPeople((data ?? []) as Person[]);
      } catch {
        if (active) setError("Search is unavailable. Enter an exact username to try sending.");
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [handle, user?.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied.");
      setError("");
    } catch {
      setError("Copy the link from the field below; clipboard access is unavailable.");
    }
  }
  async function deviceShare() {
    try {
      await navigator.share({ title: `A VELORI ${contentType}`, url });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      await copyLink();
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!user || pending.current) return;
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
      setError("Enter a valid username.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data: recipient, error: recipientError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", handle)
        .maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient) throw new Error("We couldn't find that profile.");
      if (recipient.id === user.id) throw new Error("Choose another profile to message.");
      const { data: conversationId, error: conversationError } = await supabase.rpc(
        "open_direct_conversation",
        { p_other_user_id: recipient.id },
      );
      if (conversationError) throw conversationError;
      if (!conversationId) throw new Error("The conversation could not be opened.");
      const key = `${recipient.id}:${contentType}:${contentId}`;
      const nonce = nonces.current.get(key) ?? studioId();
      nonces.current.set(key, nonce);
      const { data: sent, error: sendError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          kind: "text",
          body: `Shared a ${contentType} with you.`,
          client_nonce: nonce,
          shared_content_type: contentType,
          shared_content_id: contentId,
        })
        .select("id")
        .single();
      let message = sent;
      if (sendError?.code === "23505") {
        const recovered = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("sender_id", user.id)
          .eq("client_nonce", nonce)
          .maybeSingle();
        if (recovered.error) throw recovered.error;
        message = recovered.data;
      } else if (sendError) throw sendError;
      if (!message) throw new Error("Delivery could not be confirmed. Try again.");
      navigate(
        `/messages?conversation=${encodeURIComponent(conversationId)}&message=${encodeURIComponent(message.id)}`,
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : friendlyError(e as { code?: string; message?: string } | null),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      title={`Share this ${contentType}`}
      className="velori-share-sheet"
      description="Send a little inspiration. Existing content privacy still applies."
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <div className="vshare-actions">
        <button onClick={() => void copyLink()}>
          <Copy size={20} />
          <span>Copy link</span>
        </button>
        {typeof navigator.share === "function" && (
          <button onClick={() => void deviceShare()}>
            <Share2 size={20} />
            <span>Share to apps</span>
          </button>
        )}
      </div>
      <label className="vshare-link">
        Content link
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Content link"
        />
      </label>
      {user ? (
        <form className="vshare-form" onSubmit={(e) => void send(e)}>
          <label htmlFor="vshare-person">Send in a message</label>
          <div className="vshare-search">
            <Search size={18} />
            <input
              id="vshare-person"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              disabled={busy}
              placeholder="Search by username"
              maxLength={25}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="vshare-results" aria-live="polite">
            {searching ? (
              <p>
                <LoaderCircle className="vshare-spin" size={16} /> Finding people…
              </p>
            ) : (
              people.map((person) => (
                <button
                  type="button"
                  key={person.id}
                  disabled={busy}
                  onClick={() => setUsername(person.username)}
                >
                  <i aria-hidden="true">
                    {(person.display_name || person.username).slice(0, 1).toUpperCase()}
                  </i>
                  <span>
                    <strong>{person.display_name || person.username}</strong>
                    <small>@{person.username}</small>
                  </span>
                  {handle === person.username && <Check size={18} />}
                </button>
              ))
            )}
            {!searching && handle.length >= 2 && !people.length && (
              <p>Enter an exact username to send.</p>
            )}
          </div>
          <button
            className="button button-primary vshare-send"
            type="submit"
            disabled={busy || handle.length < 3}
          >
            {busy ? <LoaderCircle className="vshare-spin" size={18} /> : <Send size={18} />}
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      ) : (
        <div className="vshare-signin">
          <p>Sign in to send directly to someone on VELORI.</p>
          <Link to="/login" state={{ from: route }} className="button button-primary">
            Sign in to message
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="vshare-notice">
          <Check size={16} />
          {notice}
        </p>
      )}
    </Dialog>
  );
}
