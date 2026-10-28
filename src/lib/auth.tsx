import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthState = {
  user: User | null;
  loading: boolean;
  recovery: boolean;
  endRecovery: () => void;
};
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  recovery: false,
  endRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        authEventReceived = true;
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
      }
    });
    // Restore a persisted session even if the initial auth event is delayed.
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;
        if (!error) setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active && !authEventReceived) setLoading(false);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, recovery, endRecovery: () => setRecovery(false) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
