import { supabase } from "./supabase";
import { supabasePublishableKey, supabaseUrl } from "../../utils/supabase/info";

export type ChatPushStatus = {
  status: "accepted" | "partial" | "failed" | "no_recipients" | "already_processed";
  targetCount?: number;
  providerRecipientCount?: number | null;
};

export async function requestChatPushNotification(messageId: string): Promise<ChatPushStatus> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("session-expired");

  const response = await fetch(`${supabaseUrl}/functions/v1/server/notifications/onesignal/chat`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message_id: messageId }),
  });
  if (!response.ok) throw new Error(response.status === 503 ? "not-configured" : "push-failed");
  return (await response.json()) as ChatPushStatus;
}
