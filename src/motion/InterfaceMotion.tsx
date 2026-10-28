import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MOTION_PREFERENCE_KEY,
  normalizeMotionPreference,
  resolveInterfaceMotion,
  type MotionPreference,
  type InterfaceMotion,
} from "./preferences.mjs";

type PreferenceState = {
  preference: MotionPreference;
  mode: InterfaceMotion;
  reduced: boolean;
  setPreference: (value: MotionPreference) => void;
};
const Context = createContext<PreferenceState>({
  preference: "auto",
  mode: "full",
  reduced: false,
  setPreference: () => {},
});

export function InterfaceMotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<MotionPreference>(() => {
    try {
      return normalizeMotionPreference(localStorage.getItem(MOTION_PREFERENCE_KEY));
    } catch {
      return "auto";
    }
  });
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const mode = resolveInterfaceMotion(preference, systemReduced);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === MOTION_PREFERENCE_KEY)
        setPreference(normalizeMotionPreference(event.newValue));
    };
    media.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.uiMotion = mode;
    document.documentElement.dataset.uiMotionPreference = preference;
    try {
      localStorage.setItem(MOTION_PREFERENCE_KEY, preference);
    } catch {
      /* Memory-only preferences still work. */
    }
  }, [mode, preference]);
  const value = useMemo(
    () => ({ preference, mode, reduced: mode !== "full", setPreference }),
    [preference, mode],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useInterfaceMotion = () => useContext(Context);
