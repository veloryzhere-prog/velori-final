import { supabase } from "./supabase";

export function authRedirect(path: "/auth/confirm" | "/reset-password") {
  return new URL(path, window.location.origin).toString();
}

export async function accountDestination() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email_confirmed_at) return "/login";

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return "/login";
    return data ? "/home" : "/onboarding";
  } catch {
    return "/login";
  }
}
