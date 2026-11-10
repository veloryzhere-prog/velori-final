import { useEffect, useState } from "react";
import { useAdminSession } from "./session";
import { normalizePins } from "./tools.mjs";
const CHANGE = "velori-admin-preferences";
type Preferences = { compact: boolean; pins: string[] };
const memoryPreferences = new Map<string, Preferences>();
export function useAdminPreferences(allowedPaths: string[]) {
  const { me } = useAdminSession();
  const key = "velori.admin.workspace." + (me?.userId ?? "session");
  const read = (): Preferences => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "{}");
      return { compact: value?.compact === true, pins: normalizePins(value?.pins, allowedPaths) };
    } catch {
      return memoryPreferences.get(key) ?? { compact: false, pins: [] };
    }
  };
  const [preferences, setPreferences] = useState(read);
  useEffect(() => {
    setPreferences(read());
    const sync = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.key === key)
        setPreferences(event.detail.value);
      else if (!(event instanceof CustomEvent)) setPreferences(read());
    };
    window.addEventListener(CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);
  const update = (next: Partial<Preferences>) => {
    const value = { ...read(), ...next };
    setPreferences(value);
    memoryPreferences.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Preferences are optional. */
    }
    window.dispatchEvent(new CustomEvent(CHANGE, { detail: { key, value } }));
  };
  return { ...preferences, update };
}
