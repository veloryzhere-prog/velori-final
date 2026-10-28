import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";

// This key is the public browser key. Authorization is enforced by database RLS.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  is_private: boolean;
  website_url?: string | null;
  link_title?: string | null;
  account_type?: "personal" | "creator" | "business";
};

export type Post = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  visibility?: "public" | "followers" | "private";
  allow_comments?: boolean;
  allow_likes?: boolean;
  hide_like_count?: boolean;
  allow_sharing?: boolean;
  is_published?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  delete_expires_at?: string | null;
  post_media?: PostMedia[];
  like_count?: number | null;
  comment_count?: number;
  profiles: Profile;
  likes?: { user_id: string }[];
  saves?: { user_id: string }[];
  liked_by_me?: boolean;
  saved_by_me?: boolean;
};

export type PostMedia = {
  id: string;
  object_path: string;
  media_type: "image" | "video";
  position: number;
  alt_text: string;
};

export const postSelection =
  "id,author_id,body,created_at,visibility,allow_comments,allow_likes,hide_like_count,allow_sharing,is_published,archived_at,deleted_at,delete_expires_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url,is_private),post_media(id,object_path,media_type,position,alt_text)";

export function friendlyError(error: { code?: string; message?: string } | null): string {
  if (!error) return "Something went wrong. Please try again.";
  if (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.message?.includes("schema cache") ||
    error.message?.includes("does not exist") ||
    error.message?.includes('relation "')
  ) {
    return "This Supabase project is missing part of VELORI's current database schema. Apply all pending migrations in timestamp order, then reload the app.";
  }
  if (error.message?.includes("Failed to fetch") || error.message?.includes("network")) {
    return "We couldn't connect. Check your connection and try again.";
  }
  if (error.code === "invalid_credentials")
    return "The email or password is incorrect. Please try again.";
  if (error.code === "otp_expired")
    return "This verification link has expired or has already been used. Request a new link.";
  if (error.code === "otp_disabled" || error.code === "email_address_not_authorized")
    return "This email service is currently restricted. Please contact the administrator to configure production email delivery.";
  if (error.code === "email_not_confirmed")
    return "Please verify your email before signing in. Check your inbox or request another link.";
  if (error.code === "user_already_exists" || error.code === "email_exists")
    return "We couldn't create an account with those details. Try signing in or resetting your password.";
  if (error.code === "weak_password") return "Choose a stronger password and try again.";
  if (error.code === "validation_failed") return "Please check the email and password you entered.";
  // Verified live on 2026-10-02: /auth/v1/signup returns HTTP 429 with
  // x-sb-error-code: over_email_send_rate_limit because the project is still on
  // Supabase's rate-limited built-in SMTP. No account is created at all, so the
  // generic "please wait" message left users with no way to tell that signup is
  // switched off for everyone rather than busy for them.
  if (error.code === "over_email_send_rate_limit")
    return "New accounts cannot be created right now because the email service is rate limited. This affects everyone, not just you. An administrator must configure a custom SMTP provider in Supabase before signup works again.";
  if (error.code === "over_request_rate_limit" || error.code === "over_sms_send_rate_limit")
    return "Please wait before trying again.";
  if (error.code === "unexpected_failure" || error.code === "email_provider_disabled")
    return "Authentication is temporarily unavailable. Please try again later.";
  if (error.code?.includes("rate_limit") || error.code?.includes("rate_over"))
    return "Too many requests. Please wait a little before trying again.";
  if (error.code === "23505") return "That name is already taken. Please choose another.";
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code?.startsWith("PGRST") || /^\d{5}$/.test(error.code || ""))
    return "We couldn't complete that request. Please try again or contact support.";
  return "We couldn't complete that request. Please try again or contact support.";
}
