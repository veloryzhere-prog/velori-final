import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
type Settings = {
  show_typing_indicator: boolean;
  show_online_indicator: boolean;
  notify_message: boolean;
  message_permission: string;
};
const defaults: Settings = {
  show_typing_indicator: true,
  show_online_indicator: true,
  notify_message: true,
  message_permission: "everyone",
};
export function AccountChatSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<Settings>(defaults),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void supabase
      .from("account_settings")
      .select("show_typing_indicator,show_online_indicator,notify_message,message_permission")
      .eq("profile_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Could not load account messaging settings.");
        else setSettings({ ...defaults, ...data });
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, retry]);
  const pending = useRef(false);
  const update = async (patch: Partial<Settings>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setSaved("");
    setError("");
    try {
      const { error } = await supabase
        .from("account_settings")
        .upsert({ profile_id: userId, ...patch }, { onConflict: "profile_id" });
      if (error) throw error;
      setSettings((current) => ({ ...current, ...patch }));
      setSaved("Account messaging setting saved.");
      window.dispatchEvent(new Event("velori:chat-privacy-updated"));
    } catch {
      setError("Could not save this setting. Your previous preference is still active.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="chat-account-settings">
      <h4>Messages & activity</h4>
      <p className="chat-detail-note">These controls apply to all your VELORI chats.</p>
      {loading ? (
        <p role="status">Loading account settings…</p>
      ) : error && !saved ? (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      ) : null}
      {!loading && (
        <>
          <label className="chat-account-select">
            Who can message you?
            <select
              disabled={busy || Boolean(error)}
              value={settings.message_permission}
              onChange={(event) => void update({ message_permission: event.target.value })}
            >
              {[
                ["everyone", "Everyone"],
                ["followers", "Approved followers"],
                ["following", "People I follow"],
                ["mutuals", "Mutual connections"],
                ["existing", "Existing conversations only"],
                ["nobody", "Nobody"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              [
                "show_typing_indicator",
                "Share typing indicator",
                "Let chat participants see when you are typing.",
              ],
              [
                "show_online_indicator",
                "Share online presence",
                "Show your active presence in conversations.",
              ],
              [
                "notify_message",
                "Message notifications",
                "Receive notifications and inbox alerts for messages.",
              ],
            ] as const
          ).map(([key, label, detail]) => (
            <div className="chat-setting-toggle" key={key}>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-label={label}
                aria-checked={settings[key]}
                disabled={busy || Boolean(error)}
                onClick={() => void update({ [key]: !settings[key] })}
              >
                {settings[key] ? "On" : "Off"}
              </button>
            </div>
          ))}
          <Link to="/settings/privacy">More privacy & safety controls</Link>
        </>
      )}
      {saved ? <p role="status">{saved}</p> : null}
    </section>
  );
}
