import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { syncOneSignalWebUser } from "./onesignal-web";

type AuthState = {
  user: User | null;
  loading: boolean;
  recovery: boolean;
  oneSignalIdentityError: boolean;
  endRecovery: () => void;
};
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  recovery: false,
  oneSignalIdentityError: false,
  endRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [oneSignalIdentityError, setOneSignalIdentityError] = useState(false);
  const currentUserId = useRef<string | null>(null);

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

  useEffect(() => {
    if (loading) return;
    const profileId = user?.id ?? null;
    currentUserId.current = profileId;
    let active = true;
    void syncOneSignalWebUser(profileId, () => currentUserId.current === profileId)
      .then(() => {
        if (active) setOneSignalIdentityError(false);
      })
      .catch(() => {
        if (active) setOneSignalIdentityError(true);
      });
    return () => {
      active = false;
    };
  }, [loading, user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        recovery,
        oneSignalIdentityError,
        endRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
