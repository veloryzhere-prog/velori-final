import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { chatPreferenceKey, normalizeChatPreferences, type ChatPreferences } from "./policy.mjs";
import { syncChatPreferences } from "./sync.mjs";
const queues = new Map<string, Promise<unknown>>();
const cached = (key: string) => {
  try {
    return normalizeChatPreferences(JSON.parse(localStorage.getItem(key) || "null"));
  } catch {
    return normalizeChatPreferences(null);
  }
};
export function useChatPreferences(userId: string | undefined, conversationId: string | null) {
  const key = userId && conversationId ? chatPreferenceKey(userId, conversationId) : "";
  const [state, setState] = useState(() => ({ key, value: cached(key) }));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Checking account sync…");
  const [revision, setRevision] = useState(0),
    [refresh, setRefresh] = useState(0);
  const currentKey = useRef(key);
  currentKey.current = key;
  const value = state.key === key ? state.value : cached(key);
  useEffect(() => {
    setState({ key, value: cached(key) });
    setError("");
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === key + ":pending") {
        setState({ key, value: cached(key) });
        setRefresh((n) => n + 1);
      }
    };
    const retry = () => setRefresh((n) => n + 1);
    window.addEventListener("storage", sync);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [key]);
  useEffect(() => {
    if (!key || !userId || !conversationId) return;
    let active = true;
    if (!navigator.onLine) {
      setStatus("Offline · saved on this browser; sync resumes when connected.");
      return;
    }
    setStatus("Syncing your personal chat settings…");
    const timer = window.setTimeout(
      () => {
        const previous = queues.get(key) || Promise.resolve();
        const task = previous
          .catch(() => {})
          .then(async () => {
            if (!active) return;
            let pending: Partial<ChatPreferences> = {};
            try {
              pending = JSON.parse(localStorage.getItem(key + ":pending") || "{}");
            } catch {
              /* keep cached settings */
            }
            const fingerprint = JSON.stringify(pending);
            const next = await syncChatPreferences(
              supabase,
              userId,
              conversationId,
              cached(key),
              pending,
            );
            // Never acknowledge a newer edit that arrived while this request was in flight.
            if (
              JSON.stringify(JSON.parse(localStorage.getItem(key + ":pending") || "{}")) !==
              fingerprint
            )
              return;
            localStorage.setItem(key, JSON.stringify(next));
            localStorage.removeItem(key + ":pending");
            if (active && currentKey.current === key) {
              setState({ key, value: next });
              setError("");
              setStatus("Personal settings synced to your account.");
            }
          });
        queues.set(key, task);
        task
          .catch((cause) => {
            if (!active) return;
            const unavailable = ["42P01", "PGRST205", "PGRST200", "PGRST202"].includes(cause?.code);
            setStatus(
              unavailable
                ? "Saved on this browser · account sync needs the Supabase migration."
                : "Saved on this browser · account sync failed. Retry when connected.",
            );
          })
          .finally(() => {
            if (queues.get(key) === task) queues.delete(key);
          });
      },
      revision ? 350 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [key, userId, conversationId, revision, refresh]);
  const update = (patch: Partial<ChatPreferences>) => {
    if (!key) return false;
    const next = normalizeChatPreferences({ ...cached(key), ...patch });
    try {
      const pending = JSON.parse(localStorage.getItem(key + ":pending") || "{}");
      localStorage.setItem(key + ":pending", JSON.stringify({ ...pending, ...patch }));
      localStorage.setItem(key, JSON.stringify(next));
      setState({ key, value: next });
      setError("");
      setStatus("Saved on this browser · syncing…");
      setRevision((n) => n + 1);
      return true;
    } catch {
      setError("Browser storage is unavailable. This setting could not be saved.");
      return false;
    }
  };
  return {
    preferences: value,
    updatePreferences: update,
    preferenceError: error,
    syncStatus: status,
    retrySync: () => setRefresh((n) => n + 1),
  };
}
