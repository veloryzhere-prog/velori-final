import { supabase } from "./supabase";
import { isNativeAndroid } from "./native-android";

export function authRedirect(path: "/auth/confirm" | "/reset-password") {
  if (isNativeAndroid()) {
    const nativePath = path === "/auth/confirm" ? "/confirm" : path;
    return `online.veloryz.velori://auth${nativePath}`;
  }
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
