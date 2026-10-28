import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import {
  AdminApiError,
  adminLogout,
  adminMe,
  adminReauthenticate,
  type AdminMe,
} from "../../lib/admin-api";

type AdminSessionState = {
  me: AdminMe | null;
  loading: boolean;
  /** Set when the console could not load the signed-in administrator at all. */
  error: string | null;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionState>({
  me: null,
  loading: true,
  error: null,
  reload: async () => {},
  signOut: async () => {},
});

/** Codes the server uses to mean "this browser must sign in again". They all mean
 * the same thing to the console: drop the local session pointer and go to login. */
const RESIGN_IN_CODES = new Set([
  "session_missing",
  "session_unknown",
  "session_expired",
  "session_revoked",
]);

export function needsResignIn(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    error.status === 401 &&
    (RESIGN_IN_CODES.has(error.code ?? "") || !error.code)
  );
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminMe();
      if (!mounted.current) return;
      setMe(result);
    } catch (caught) {
      if (!mounted.current) return;
      setMe(null);
      if (needsResignIn(caught)) {
        navigate("/admin/login", { replace: true });
        return;
      }
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The administrator service could not be reached. Configure and deploy the administrator Edge Function to the active Supabase project before attempting sign-in.",
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await adminLogout();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The administrator session could not be revoked. Try signing out again.",
      );
      return;
    }
    setMe(null);
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const value = useMemo<AdminSessionState>(
    () => ({ me, loading, error, reload, signOut }),
    [me, loading, error, reload, signOut],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

export function usePermissions(): Set<string> {
  const { me } = useAdminSession();
  return useMemo(() => new Set<string>(me?.permissions ?? []), [me]);
}

export function usePermission(permission: string): boolean {
  return usePermissions().has(permission);
}

/** True when the caller holds at least one of the listed permissions. Used for nav
 * items that sit above several screens rather than one. */
export function useAnyPermission(...permissions: string[]): boolean {
  const granted = usePermissions();
  return permissions.some((permission) => granted.has(permission));
}

export function hasPermission(granted: Set<string>, permission: string) {
  return granted.has(permission);
}

/**
 * Guarantees a recent password confirmation before a high-risk action.
 *
 * The server answers 428 `reauth_required` when the stamp is stale. A screen calls
 * `ensureReauth()` inside its submit handler: it prompts once, and returns true
 * only if the password was confirmed, so the caller can retry the action.
 */
export type ReauthHandle = {
  prompting: boolean;
  ensureReauth: () => Promise<boolean>;
  resolve: (value: boolean) => void;
};

export function useReauth(): ReauthHandle {
  const [prompting, setPrompting] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const resolve = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setPrompting(false);
  }, []);

  const ensureReauth = useCallback(async () => {
    if (prompting) return false;
    setPrompting(true);
    return new Promise<boolean>((settle) => {
      resolver.current = settle;
    });
  }, [prompting]);

  return { prompting, ensureReauth, resolve };
}

export async function submitPassword(password: string) {
  return adminReauthenticate(password);
}

export type { AdminMe };
