import { createUuid } from "../lib/uuid.mjs";
import { ChatExpressionPicker, AttachmentPreview } from "../features/chat/ChatExpressionPicker";
import { VeloriLoop } from "../components/VeloriLoop";
import { ChatDetails } from "../features/chat/ChatDetails";
import { ChatDeleteDialog, ChildModeNotice } from "../features/chat/ChatDialogs";
import { AvatarPreview } from "../components/AvatarPreview";
import { Dialog as ChatDialog } from "../components/ui";
import { useChatPreferences } from "../features/chat/useChatPreferences";
import {
  containsBlockedLanguage,
  chatPreferenceKey,
  normalizeChatPreferences,
} from "../features/chat/policy.mjs";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { PageWorkspace } from "../components/PageWorkspace";
import { SceneHeading } from "../components/SceneHeading";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  MessageCircle,
  Info,
  Bell,
  ShieldCheck,
  Flag,
  ChevronRight,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
  Archive,
  Pin,
  Smile,
  Trash2,
  Pencil,
  Reply,
  VolumeX,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFeatureFlag } from "../lib/feature-flags";
import { PROFILE_CHANGED_EVENT, type ProfileSnapshot } from "../lib/profile-events";
import { friendlyError, supabase } from "../lib/supabase";
import {
  messageAttachmentPath,
  removeMessageAttachments,
  signMessageAttachments,
  uploadMessageAttachment,
  validateMessageAttachment,
} from "../lib/message-media";
import { removeGroupImage, signGroupImage, uploadGroupImage } from "../lib/group-media";
import { EmptyState, Problem, RuntimeLoading } from "./shell";
import { Button, Input, Textarea } from "./admin-primitives";

const THREAD_PAGE = 40;
const GROUP_PAGE = 24;
const MAX_AUDIO_RECORDING_SECONDS = 5 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

function createMessageClientNonce() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  // randomUUID is restricted to secure contexts in some browsers. Messages
  // also run from plain-HTTP LAN previews, so keep the idempotency key working
  // there without relying on that API being present.
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function makeGroupSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44)
    .replace(/-+$/g, "");
  return `${base || "group"}-${createUuid().slice(0, 8)}`;
}

function messageFailure(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    return friendlyError(error as { code?: string; message?: string });
  }
  return "We couldn't complete this message action.";
}

type Conversation = {
  id: string;
  kind: string;
  title: string;
  last_message_at: string | null;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  unread_count?: number;
  archived_at?: string | null;
  muted_until?: string | null;
  pinned?: boolean;
  pinned_message_id?: string | null;
  mark_unread_at?: string | null;
  conversation_participants: {
    user_id: string;
    last_read_at: string | null;
    archived_at?: string | null;
    muted_until?: string | null;
    pinned?: boolean;
    pinned_message_id?: string | null;
    mark_unread_at?: string | null;
    profiles?: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
  }[];
  profiles: { id: string; username: string; display_name: string; avatar_url: string | null }[];
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  kind: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id?: string | null;
  shared_content_type?: "post" | "reel" | "story" | null;
  shared_content_id?: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  message_attachments?: {
    id: string;
    object_path: string;
    media_type: "image" | "video" | "file" | "audio";
    mime_type: string;
    byte_size: number;
    alt_text: string;
    signed_url?: string;
  }[];
};

type Group = {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  avatar_url: string | null;
  privacy: "public" | "private" | "hidden";
  member_count: number;
  created_at: string;
};

type MessageUserResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

/** Shared shell so both features read the same way and share the same states. */
function FeatureFrame({
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
  className?: string;
}) {
  const heading = <SceneHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />;
  if (className === "messages-page")
    return (
      <div className="messages-page conversation-page-recreated">
        {heading}
        <div className="conversation-page-body">{children}</div>
      </div>
    );
  return (
    <PageWorkspace area="community" className={className}>
      {heading}
      <div className="community-page-body">{children}</div>
    </PageWorkspace>
  );
}

function SignInPrompt() {
  return (
    <EmptyState
      icon={MessageCircle}
      title="Sign in to continue"
      text="Your conversations belong to your account, so you need to sign in before you can read or send them."
      action="Sign in"
      to="/login"
    />
  );
}

function DisabledNotice({ name }: { name: string }) {
  return (
    <EmptyState
      icon={Users}
      title="Feature unavailable"
      text={`${name} has been turned off by the platform administrator and is not accepting new activity.`}
      action="Back to the feed"
      to="/home"
    />
  );
}

/* ------------------------------------------------------------------------- */
/* Messages                                                                  */
/* ------------------------------------------------------------------------- */

export function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const enabled = useFeatureFlag("messaging_enabled", true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [conversationLimit, setConversationLimit] = useState(50);
  const [moreConversations, setMoreConversations] = useState(false);
  const inboxRequest = useRef(0);
  const activeConversationId = useRef(activeId);
  activeConversationId.current = activeId;
  const selectConversation = (id: string) => {
    if (sendPending.current) return;
    activeConversationId.current = id;
    setMessages([]);
    setMessageReactions({});
    setThreadLoading(true);
    setActiveId(id);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("conversation", id);
        next.delete("message");
        return next;
      },
      { replace: true },
    );
  };
  const closeConversation = () => {
    if (sendPending.current) return;
    activeConversationId.current = null;
    setActiveId(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("conversation");
        next.delete("message");
        return next;
      },
      { replace: true },
    );
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const { preferences, updatePreferences, preferenceError, syncStatus, retrySync } =
    useChatPreferences(user?.id, activeId);
  const [privacyRevision, setPrivacyRevision] = useState(0);
  const alertsAllowed = useRef(true);
  useEffect(() => {
    const update = () => setPrivacyRevision((n) => n + 1);
    window.addEventListener("velori:chat-privacy-updated", update);
    return () => window.removeEventListener("velori:chat-privacy-updated", update);
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("account_settings")
      .select("notify_message")
      .eq("profile_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active && !error) alertsAllowed.current = data?.notify_message ?? true;
      });
    return () => {
      active = false;
    };
  }, [user?.id, privacyRevision]);
  const reducedMotion = useInterfaceMotion().reduced;
  const [detailsOpen, setDetailsOpen] = useState(false),
    [detailsTab, setDetailsTab] = useState("details");
  const [avatarPreview, setAvatarPreview] = useState<{ src: string | null; name: string } | null>(
    null,
  );
  const [childNotice, setChildNotice] = useState(false),
    [chatNotice, setChatNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const [vanishingId, setVanishingId] = useState<string | null>(null),
    [chatSearch, setChatSearch] = useState(""),
    [showChatSearch, setShowChatSearch] = useState(false);
  const [blockTarget, setBlockTarget] = useState<MessageUserResult | null>(null),
    [safetyBusy, setSafetyBusy] = useState(false),
    [safetyError, setSafetyError] = useState("");
  const [reportOpen, setReportOpen] = useState(false),
    [reportId, setReportId] = useState(""),
    [reportReason, setReportReason] = useState(""),
    [reportCategory, setReportCategory] = useState("harassment");
  const [inboxAlert, setInboxAlert] = useState<{ id: string; name: string } | null>(null);
  const sendPending = useRef(false),
    deletePending = useRef(false),
    actionPending = useRef(false);
  const threadBody = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const inboxConversations = useRef(conversations);
  inboxConversations.current = conversations;
  useEffect(() => {
    setDetailsOpen(false);
    setChildNotice(false);
    setShowChatSearch(false);
    setChatSearch("");
    setChatNotice("");
    nearBottom.current = true;
  }, [activeId]);
  useEffect(() => {
    if (nearBottom.current && threadBody.current)
      threadBody.current.scrollTop = threadBody.current.scrollHeight;
  }, [messages, activeId]);
  const localPreferencesFor = (id: string) => {
    try {
      return normalizeChatPreferences(
        JSON.parse(localStorage.getItem(chatPreferenceKey(user?.id || "", id)) || "null"),
      );
    } catch {
      return normalizeChatPreferences(null);
    }
  };

  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [messageReactions, setMessageReactions] = useState<
    Record<string, { reaction: string; user_id: string }[]>
  >({});
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [conversationSearch, setConversationSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "groups" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [startWith, setStartWith] = useState("");
  const [startError, setStartError] = useState("");
  const [userResults, setUserResults] = useState<MessageUserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const nonce = useRef(createMessageClientNonce());
  const activeLoadToken = useRef(0);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingBroadcastAt = useRef(0);
  const canBroadcastTyping = useRef(false);
  const canSharePresence = useRef(false);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.onerror = null;
        if (recorderRef.current.state === "recording") recorderRef.current.stop();
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (
      recording &&
      recordingSeconds >= MAX_AUDIO_RECORDING_SECONDS &&
      recorderRef.current?.state === "recording"
    ) {
      recorderRef.current.stop();
    }
  }, [recording, recordingSeconds]);

  async function startAudioRecording() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSendError("Voice recording is not supported in this browser.");
      return;
    }
    setSendError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const supportedTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setSendError("The voice recording stopped unexpectedly. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setRecordingSeconds(0);
        if (chunks.length === 0) {
          setSendError("No audio was captured. Check microphone permission and try again.");
          return;
        }
        const audioType = recorder.mimeType || "audio/webm";
        const extension = audioType.includes("mp4")
          ? "m4a"
          : audioType.includes("ogg")
            ? "ogg"
            : "webm";
        setAttachment(
          new File(chunks, `voice-note-${Date.now()}.${extension}`, {
            type: audioType.split(";")[0],
          }),
        );
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingSeconds(0);
      setRecording(true);
    } catch (cause) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setSendError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Allow microphone access in your browser to record a voice note."
          : messageFailure(cause),
      );
    }
  }

  function stopAudioRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  useEffect(() => {
    const recipient = searchParams.get("to")?.trim().replace(/^@/, "") ?? "";
    if (usernamePattern.test(recipient)) setStartWith(recipient);
  }, [searchParams]);

  useEffect(() => {
    const query = startWith.trim().replace(/^@/, "");
    if (!user || query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return;
    }
    let active = true;
    setSearchingUsers(true);
    const timer = window.setTimeout(() => {
      void Promise.all([
        supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .ilike("username", `${query}%`)
          .neq("id", user.id)
          .limit(5),
        supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .ilike("display_name", `%${query}%`)
          .neq("id", user.id)
          .limit(5),
      ]).then(([usernames, names]) => {
        if (!active) return;
        const found = new Map<string, MessageUserResult>();
        for (const result of [usernames, names]) {
          if (result.error) continue;
          for (const profile of (result.data ?? []) as MessageUserResult[]) {
            found.set(profile.id, profile);
          }
        }
        setUserResults([...found.values()].slice(0, 7));
        setSearchingUsers(false);
      });
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [startWith, user]);

  useEffect(() => {
    const requestedConversation = searchParams.get("conversation");
    if (
      requestedConversation &&
      requestedConversation !== activeConversationId.current &&
      conversations.some((item) => item.id === requestedConversation)
    ) {
      activeConversationId.current = requestedConversation;
      setMessages([]);
      setMessageReactions({});
      setThreadLoading(true);
      setActiveId(requestedConversation);
    }
  }, [conversations, searchParams]);

  useEffect(() => {
    const messageId = searchParams.get("message");
    if (!messageId || !messages.some((message) => message.id === messageId)) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`message-${messageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [messages, searchParams]);

  useEffect(() => {
    if (!user || !activeId) return;
    const storageKey = `velori-message-draft:${user.id}:${activeId}`;
    try {
      setDraft(window.localStorage.getItem(storageKey) ?? "");
    } catch {
      setDraft("");
    }
    setAttachment(null);
    setReplyTo(null);
    setEditingMessage(null);
    setSendError("");
  }, [activeId, user]);

  const loadConversations = useCallback(async () => {
    const request = ++inboxRequest.current;
    try {
      const { data, error: failure } = await supabase
        .from("conversations")
        .select(
          "id,kind,title,last_message_at,last_message_id,conversation_participants(user_id,last_read_at,archived_at,muted_until,pinned,pinned_message_id,mark_unread_at,profiles!conversation_participants_user_id_fkey(id,username,display_name,avatar_url))",
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(conversationLimit + 1);
      if (request !== inboxRequest.current) return;
      if (failure) {
        setError(friendlyError(failure));
        return;
      }
      setMoreConversations((data?.length || 0) > conversationLimit);
      const rows = ((data ?? []) as unknown as Conversation[])
        .slice(0, conversationLimit)
        .map((row) => ({
          ...row,
          profiles: row.conversation_participants.flatMap((participant) =>
            participant.profiles ? [participant.profiles] : [],
          ),
        }));
      const { data: unreadRows, error: unreadFailure } = await supabase.rpc(
        "conversation_unread_counts",
      );
      if (request !== inboxRequest.current) return;
      if (unreadFailure && unreadFailure.code !== "PGRST202") {
        setError(friendlyError(unreadFailure));
        return;
      }
      const unreadCounts = new Map<string, number>(
        ((unreadRows ?? []) as { conversation_id: string; unread_count: number }[]).map((row) => [
          row.conversation_id,
          row.unread_count,
        ]),
      );
      const withUnreadCounts = rows.map((row) => ({
        ...row,
        unread_count: unreadFailure
          ? undefined
          : (unreadCounts.get(row.id) ??
            (row.conversation_participants.find((participant) => participant.user_id === user?.id)
              ?.mark_unread_at
              ? 1
              : 0)),
      }));
      const lastMessageIds = [
        ...new Set(withUnreadCounts.map((row) => row.last_message_id).filter(Boolean)),
      ];
      if (lastMessageIds.length) {
        const { data: lastMessages, error: previewFailure } = await supabase
          .from("messages")
          .select("id,body,kind,deleted_at,sender_id")
          .in("id", lastMessageIds);
        if (request !== inboxRequest.current) return;
        if (previewFailure) {
          setError(friendlyError(previewFailure));
          return;
        }
        const previews = new Map(
          (lastMessages ?? []).map((message) => [
            message.id,
            {
              preview: message.deleted_at
                ? "Message deleted"
                : message.body ||
                  (message.kind === "audio"
                    ? "Voice message"
                    : message.kind === "image"
                      ? "Photo"
                      : message.kind === "video"
                        ? "Video"
                        : message.kind === "file"
                          ? "File"
                          : ""),
              senderId: message.sender_id,
            },
          ]),
        );
        setConversations(
          withUnreadCounts.map((row) => ({
            ...row,
            last_message_preview: row.last_message_id
              ? (previews.get(row.last_message_id)?.preview ?? null)
              : null,
            last_message_sender_id: row.last_message_id
              ? (previews.get(row.last_message_id)?.senderId ?? null)
              : null,
          })),
        );
      } else {
        setConversations(
          withUnreadCounts.map((row) => ({
            ...row,
            last_message_preview: null,
            last_message_sender_id: null,
          })),
        );
      }
      setError("");
    } catch (cause) {
      if (request === inboxRequest.current) setError(messageFailure(cause));
    }
  }, [user?.id, conversationLimit]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("velori-inbox:" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (event) => {
        const row = event.new as { conversation_id?: string; sender_id?: string };
        void loadConversations();
        if (
          row.conversation_id &&
          row.conversation_id !== activeConversationId.current &&
          row.sender_id !== user.id &&
          alertsAllowed.current &&
          document.visibilityState === "visible"
        ) {
          const conversation = inboxConversations.current.find(
            (item) => item.id === row.conversation_id,
          );
          const mine = conversation?.conversation_participants.find(
            (item) => item.user_id === user.id,
          );
          if (!mine?.muted_until || Date.parse(mine.muted_until) < Date.now())
            setInboxAlert({
              id: row.conversation_id,
              name:
                conversation?.title ||
                conversation?.profiles.find((p) => p.id !== user.id)?.display_name ||
                "New conversation",
            });
        }
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: "user_id=eq." + user.id,
        },
        () => void loadConversations(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations]);
  useEffect(() => {
    if (!inboxAlert) return;
    const timer = window.setTimeout(() => setInboxAlert(null), 6000);
    return () => window.clearTimeout(timer);
  }, [inboxAlert]);
  useEffect(() => {
    const updateParticipantProfile = (event: Event) => {
      const changed = (event as CustomEvent<ProfileSnapshot>).detail;
      if (!changed) return;
      setConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          profiles: conversation.profiles.map((profile) =>
            profile.id === changed.id
              ? {
                  ...profile,
                  username: changed.username,
                  display_name: changed.display_name || "",
                  avatar_url: changed.avatar_url,
                }
              : profile,
          ),
        })),
      );
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, updateParticipantProfile);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, updateParticipantProfile);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(inboxConversations.current.length === 0);
    void loadConversations().finally(() => setLoading(false));
  }, [authLoading, user, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (activeConversationId.current !== conversationId) return;
      const requestToken = ++activeLoadToken.current;
      try {
        const { data, error: failure } = await supabase
          .from("messages")
          .select(
            "id,conversation_id,sender_id,body,kind,created_at,edited_at,deleted_at,reply_to_id,shared_content_type,shared_content_id,profiles!messages_sender_id_fkey(username,display_name),message_attachments(id,object_path,media_type,mime_type,byte_size,alt_text)",
          )
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(THREAD_PAGE);
        if (failure) {
          if (requestToken !== activeLoadToken.current) return;
          setThreadLoading(false);
          setError(friendlyError(failure));
          return;
        }
        if (requestToken !== activeLoadToken.current) return;
        const rows = ((data ?? []) as unknown as Message[]).reverse();
        setHasOlderMessages(rows.length === THREAD_PAGE);
        try {
          const signed = await signMessageAttachments(
            rows.flatMap(
              (message) => message.message_attachments?.map((item) => item.object_path) ?? [],
            ),
          );
          if (
            requestToken !== activeLoadToken.current ||
            activeConversationId.current !== conversationId
          )
            return;
          setThreadLoading(false);
          setMessages(
            rows.map((message) => ({
              ...message,
              message_attachments: message.message_attachments?.map((item) => ({
                ...item,
                signed_url: signed.get(item.object_path),
              })),
            })),
          );
        } catch (cause) {
          if (requestToken !== activeLoadToken.current) return;
          setThreadLoading(false);
          setMessages(rows);
          setError(messageFailure(cause));
          return;
        }
        setError("");
        const { data: reactions } = await supabase
          .from("message_reactions")
          .select("message_id,user_id,reaction")
          .in(
            "message_id",
            rows.map((message) => message.id),
          );
        if (
          requestToken !== activeLoadToken.current ||
          activeConversationId.current !== conversationId
        )
          return;
        const grouped: Record<string, { reaction: string; user_id: string }[]> = {};
        for (const reaction of reactions ?? []) {
          const row = reaction as { message_id: string; user_id: string; reaction: string };
          (grouped[row.message_id] ??= []).push({ reaction: row.reaction, user_id: row.user_id });
        }
        setMessageReactions(grouped);
        const { error: readFailure } = await supabase.rpc("mark_conversation_read", {
          p_conversation_id: conversationId,
        });
        if (!readFailure) {
          window.dispatchEvent(new Event("velori:messaging-unread-refresh"));
          await loadConversations();
        }
      } catch (cause) {
        if (
          requestToken === activeLoadToken.current &&
          activeConversationId.current === conversationId
        ) {
          setThreadLoading(false);
          setError(messageFailure(cause));
        }
      }
    },
    [loadConversations],
  );

  async function loadOlderMessages() {
    const first = messages[0];
    const requestConversation = activeId;
    if (!activeId || !first || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error: failure } = await supabase
      .from("messages")
      .select(
        "id,conversation_id,sender_id,body,kind,created_at,edited_at,deleted_at,reply_to_id,shared_content_type,shared_content_id,profiles!messages_sender_id_fkey(username,display_name),message_attachments(id,object_path,media_type,mime_type,byte_size,alt_text)",
      )
      .eq("conversation_id", activeId)
      .lt("created_at", first.created_at)
      .order("created_at", { ascending: false })
      .limit(THREAD_PAGE);
    if (activeConversationId.current !== requestConversation) {
      setLoadingOlder(false);
      return;
    }
    if (failure) {
      setError(friendlyError(failure));
      setLoadingOlder(false);
      return;
    }
    if (activeConversationId.current !== requestConversation) {
      setLoadingOlder(false);
      return;
    }
    const older = ((data ?? []) as unknown as Message[]).reverse();
    setHasOlderMessages(older.length === THREAD_PAGE);
    try {
      const signed = await signMessageAttachments(
        older.flatMap(
          (message) => message.message_attachments?.map((item) => item.object_path) ?? [],
        ),
      );
      if (activeConversationId.current !== requestConversation) {
        setLoadingOlder(false);
        return;
      }
      const body = threadBody.current;
      const oldHeight = body?.scrollHeight || 0,
        oldTop = body?.scrollTop || 0;
      setMessages((current) => [
        ...older.map((message) => ({
          ...message,
          message_attachments: message.message_attachments?.map((item) => ({
            ...item,
            signed_url: signed.get(item.object_path),
          })),
        })),
        ...current,
      ]);
      requestAnimationFrame(() => {
        if (body && activeConversationId.current === requestConversation)
          body.scrollTop = oldTop + body.scrollHeight - oldHeight;
      });
      if (older.length) {
        const { data: olderReactions } = await supabase
          .from("message_reactions")
          .select("message_id,user_id,reaction")
          .in(
            "message_id",
            older.map((message) => message.id),
          );
        if (activeConversationId.current !== requestConversation) {
          setLoadingOlder(false);
          return;
        }
        if (olderReactions?.length) {
          setMessageReactions((current) => {
            const next = { ...current };
            for (const item of olderReactions as {
              message_id: string;
              user_id: string;
              reaction: string;
            }[]) {
              (next[item.message_id] ??= []).push({
                reaction: item.reaction,
                user_id: item.user_id,
              });
            }
            return next;
          });
        }
      }
    } catch (cause) {
      setError(messageFailure(cause));
    }
    setLoadingOlder(false);
  }

  useEffect(() => {
    if (!activeId) {
      activeLoadToken.current += 1;
      setMessages([]);
      setHasOlderMessages(false);
      return;
    }
    setMessages([]);
    setMessageReactions({});
    setHasOlderMessages(false);
    setLoadingOlder(false);
    setThreadLoading(true);
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (!activeId || !user) return;
    const channel = supabase
      .channel(`conversation:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (event) => {
          const senderId = (event.new as { sender_id?: string } | undefined)?.sender_id;
          if (senderId === user.id) return;
          void loadMessages(activeId);
          void loadConversations();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => void loadMessages(activeId),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, loadConversations, loadMessages, user]);

  useEffect(() => {
    if (!activeId || !user) {
      typingChannelRef.current = null;
      canBroadcastTyping.current = false;
      canSharePresence.current = false;
      setTypingUserId(null);
      setOnlineUserIds([]);
      return;
    }
    let cancelled = false;
    canBroadcastTyping.current = false;
    canSharePresence.current = false;
    const channel = supabase.channel(`velori:conversation:${activeId}`, {
      config: { private: true, broadcast: { ack: true }, presence: { key: user.id } },
    });
    typingChannelRef.current = channel;
    void supabase
      .from("account_settings")
      .select("show_typing_indicator,show_online_indicator,show_activity_status")
      .eq("profile_id", user.id)
      .maybeSingle()
      .then(({ data, error: preferenceError }) => {
        if (cancelled || preferenceError) return;
        canBroadcastTyping.current = data?.show_typing_indicator ?? true;
        canSharePresence.current =
          (data?.show_online_indicator ?? true) && (data?.show_activity_status ?? true);
        if (canSharePresence.current) void channel.track({ user_id: user.id });
      });
    channel
      .on("broadcast", { event: "typing" }, (event) => {
        const payload = event as { payload?: { user_id?: string } };
        const typingId = payload.payload?.user_id;
        if (!typingId || typingId === user.id) return;
        setTypingUserId(typingId);
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setTypingUserId(null), 2600);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id?: string }>();
        const ids = Object.values(state)
          .flat()
          .map((presence) => presence.user_id)
          .filter((id): id is string => Boolean(id) && id !== user.id);
        setOnlineUserIds([...new Set(ids)]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && canSharePresence.current) {
          void channel.track({ user_id: user.id });
        }
      });
    return () => {
      cancelled = true;
      typingChannelRef.current = null;
      canBroadcastTyping.current = false;
      canSharePresence.current = false;
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      setTypingUserId(null);
      setOnlineUserIds([]);
      void supabase.removeChannel(channel);
    };
  }, [activeId, user, privacyRevision]);

  function broadcastTyping() {
    const channel = typingChannelRef.current;
    const now = Date.now();
    if (!channel || !canBroadcastTyping.current || now - lastTypingBroadcastAt.current < 1200)
      return;
    lastTypingBroadcastAt.current = now;
    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user?.id },
    });
  }

  async function openDirectConversation(otherUserId: string) {
    setStartError("");
    setSending(true);
    const { data: conversationId, error: openFailure } = await supabase.rpc(
      "open_direct_conversation",
      { p_other_user_id: otherUserId },
    );
    setSending(false);
    if (openFailure || !conversationId) {
      setStartError(
        openFailure ? friendlyError(openFailure) : "That conversation could not be opened.",
      );
      return;
    }
    setStartWith("");
    setUserResults([]);
    await loadConversations();
    selectConversation(conversationId as string);
  }

  async function startConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = startWith.trim().replace(/^@/, "");
    if (!usernamePattern.test(handle)) {
      setStartError("Enter a username, for example @velori.");
      return;
    }
    setStartError("");
    const { data: profile, error: lookupFailure } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", handle.toLowerCase())
      .maybeSingle();
    if (lookupFailure || !profile) {
      setStartError(lookupFailure ? friendlyError(lookupFailure) : `We couldn't find @${handle}.`);
      setSending(false);
      return;
    }
    await openDirectConversation(profile.id);
  }

  async function updateActiveParticipant(values: Record<string, unknown>) {
    if (!activeId || !user) return false;
    const { error: failure } = await supabase
      .from("conversation_participants")
      .update(values)
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);
    if (failure) {
      setSendError(friendlyError(failure));
      return false;
    }
    await loadConversations();
    window.dispatchEvent(new Event("velori:messaging-unread-refresh"));
    return true;
  }

  async function toggleReaction(message: Message, reaction: string) {
    if (!user || message.deleted_at) return;
    const current = messageReactions[message.id]?.find((item) => item.user_id === user.id);
    const result =
      current?.reaction === reaction
        ? await supabase
            .from("message_reactions")
            .delete()
            .eq("message_id", message.id)
            .eq("user_id", user.id)
        : await supabase
            .from("message_reactions")
            .upsert(
              { message_id: message.id, user_id: user.id, reaction },
              { onConflict: "message_id,user_id" },
            );
    if (result.error) setSendError(friendlyError(result.error));
    else if (activeId) await loadMessages(activeId);
  }

  async function confirmDelete(scope: "me" | "everyone") {
    const target = deleteTarget;
    if (!target || !user || deletePending.current) return;
    deletePending.current = true;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      if (scope === "everyone") {
        if (target.sender_id !== user.id)
          throw new Error("You can only delete your own messages for everyone.");
        const result = await supabase
          .from("messages")
          .update({ body: "", deleted_at: new Date().toISOString() })
          .eq("id", target.id)
          .eq("sender_id", user.id)
          .select("id")
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error("The server did not confirm this deletion.");
      } else if (!updatePreferences({ hiddenIds: [...preferences.hiddenIds, target.id] })) {
        throw new Error("Browser storage is unavailable; the message was not hidden.");
      }
      setDeleteTarget(null);
      setVanishingId(target.id);
      setChatNotice(
        scope === "everyone" ? "Message deleted for everyone." : "Message hidden on this device.",
      );
      if (editingMessage?.id === target.id) {
        setEditingMessage(null);
        setDraft("");
      }
      if (replyTo?.id === target.id) setReplyTo(null);
      window.setTimeout(
        () => {
          setVanishingId(null);
          if (scope === "everyone" && activeId === target.conversation_id) {
            void loadMessages(target.conversation_id);
            void loadConversations();
          }
        },
        reducedMotion ? 0 : 650,
      );
    } catch (cause) {
      setDeleteError(messageFailure(cause));
    } finally {
      deletePending.current = false;
      setDeleteBusy(false);
    }
  }
  async function chatAction(action: "mute" | "pin" | "archive" | "unread") {
    if (actionPending.current) return;
    actionPending.current = true;
    setSafetyBusy(true);
    try {
      const mine = conversations
        .find((c) => c.id === activeId)
        ?.conversation_participants.find((p) => p.user_id === user?.id);
      const muted = Boolean(mine?.muted_until && Date.parse(mine.muted_until) > Date.now());
      const values =
        action === "mute"
          ? { muted_until: muted ? null : new Date(Date.now() + 8 * 3600000).toISOString() }
          : action === "pin"
            ? { pinned: !mine?.pinned }
            : action === "archive"
              ? { archived_at: new Date().toISOString() }
              : { mark_unread_at: new Date().toISOString() };
      if (await updateActiveParticipant(values)) {
        setChatNotice(
          action === "mute"
            ? muted
              ? "Notifications turned on."
              : "Notifications muted for 8 hours."
            : action === "pin"
              ? "Chat pin updated."
              : action === "archive"
                ? "Chat archived."
                : "Marked unread.",
        );
        if (action === "archive" || action === "unread") {
          setDetailsOpen(false);
          closeConversation();
        }
      }
    } finally {
      actionPending.current = false;
      setSafetyBusy(false);
    }
  }
  async function blockPerson() {
    if (!blockTarget || !user || safetyBusy) return;
    setSafetyBusy(true);
    setSafetyError("");
    try {
      const result = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: blockTarget.id });
      if (result.error) throw result.error;
      setBlockTarget(null);
      setDetailsOpen(false);
      setActiveId(null);
      setChatNotice("Account blocked. Manage blocked accounts in Privacy settings.");
      await loadConversations();
    } catch (cause) {
      setSafetyError(messageFailure(cause));
    } finally {
      setSafetyBusy(false);
    }
  }
  async function reportMessage() {
    if (!user || !reportId || safetyBusy) return;
    setSafetyBusy(true);
    setSafetyError("");
    try {
      const result = await supabase.rpc("report_chat_message", {
        p_message_id: reportId,
        p_category: reportCategory,
        p_reason: reportReason,
      });
      if (result.error) {
        if (result.error.code === "PGRST202")
          throw new Error(
            "Private chat reporting needs the pending server update. No report has been submitted.",
          );
        throw result.error;
      }
      setReportOpen(false);
      setChatNotice("Report submitted for review. Thank you for helping keep VELORI safe.");
    } catch (cause) {
      setSafetyError(messageFailure(cause));
    } finally {
      setSafetyBusy(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!activeId || (!editingMessage && !body && !attachment) || sending || sendPending.current)
      return;
    if (preferences.childMode && containsBlockedLanguage(body)) {
      setChildNotice(true);
      return;
    }
    sendPending.current = true;
    setSending(true);
    if (editingMessage) {
      try {
        const result = await supabase
          .from("messages")
          .update({ body, edited_at: new Date().toISOString() })
          .eq("id", editingMessage.id)
          .eq("sender_id", user!.id)
          .select("id")
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error("The server did not confirm the edit.");
        setDraft("");
        setEditingMessage(null);
        try {
          window.localStorage.removeItem("velori-message-draft:" + user!.id + ":" + activeId);
        } catch {}
        await loadMessages(activeId);
        setSendError("");
      } catch (cause) {
        setSendError(messageFailure(cause));
      } finally {
        setSending(false);
        sendPending.current = false;
      }
      return;
    }
    let uploadedPath = "";
    let createdMessageId = "";
    try {
      let attachmentInfo: Awaited<ReturnType<typeof validateMessageAttachment>> | null = null;
      if (attachment) {
        attachmentInfo = await validateMessageAttachment(attachment);
        uploadedPath = messageAttachmentPath(user!.id, attachmentInfo.extension);
        await uploadMessageAttachment(uploadedPath, attachment);
      }

      // The unique client_nonce index makes a repeated submit idempotent.
      const { data: inserted, error: insertFailure } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeId,
          sender_id: user!.id,
          kind: attachmentInfo?.kind ?? "text",
          body,
          client_nonce: nonce.current,
          reply_to_id: replyTo?.id ?? null,
        })
        .select("id")
        .single();
      if (insertFailure) throw insertFailure;
      createdMessageId = inserted.id;

      if (attachment && attachmentInfo) {
        const { error: metadataFailure } = await supabase.from("message_attachments").insert({
          message_id: inserted.id,
          object_path: uploadedPath,
          media_type: attachmentInfo.kind,
          mime_type: attachment.type.split(";")[0].trim().toLowerCase(),
          byte_size: attachment.size,
          alt_text: attachment.name.slice(0, 240),
        });
        if (metadataFailure) throw metadataFailure;
      }

      nonce.current = createMessageClientNonce();
      setDraft("");
      setReplyTo(null);
      try {
        if (user) window.localStorage.removeItem(`velori-message-draft:${user.id}:${activeId}`);
      } catch {
        /* A cache failure must not roll back a sent message. */
      }
      setAttachment(null);
      if (attachmentInput.current) attachmentInput.current.value = "";
      setError("");
      setSendError("");
      await loadMessages(activeId);
      await loadConversations();
    } catch (cause) {
      if (createdMessageId) {
        await supabase.from("messages").delete().eq("id", createdMessageId);
      }
      if (uploadedPath) {
        try {
          await removeMessageAttachments([uploadedPath]);
        } catch {
          // Preserve the original send failure; the private object can be retried or cleaned up.
        }
      }
      setSendError(messageFailure(cause));
    } finally {
      setSending(false);
      sendPending.current = false;
    }
  }

  if (authLoading)
    return (
      <FeatureFrame eyebrow="MESSAGES" title="A little closer." subtitle="Checking your session…" />
    );
  if (!user)
    return (
      <FeatureFrame eyebrow="MESSAGES" title="Messages." subtitle="Private to your account.">
        <SignInPrompt />
      </FeatureFrame>
    );
  if (!enabled)
    return (
      <FeatureFrame eyebrow="MESSAGES" title="Messages." subtitle="Currently turned off.">
        <DisabledNotice name="Messaging" />
      </FeatureFrame>
    );

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeOther =
    active?.profiles.find((profile) => profile.id !== user.id) ?? active?.profiles[0];
  const visibleMessages = messages.filter(
    (message) =>
      (!preferences.hiddenIds.includes(message.id) || vanishingId === message.id) &&
      (!chatSearch ||
        ((!preferences.childMode || !containsBlockedLanguage(message.body)) &&
          message.body.toLowerCase().includes(chatSearch.toLowerCase()))),
  );
  const activeParticipant = active?.conversation_participants.find(
    (participant) => participant.user_id === user.id,
  );

  return (
    <FeatureFrame
      className="messages-page"
      eyebrow="MESSAGES"
      title="Messages."
      subtitle="Your people. Your conversations. Your own little corner."
    >
      {error ? (
        <Problem
          message={error}
          retry={() => {
            setError("");
            void loadConversations();
          }}
        />
      ) : null}

      {loading ? (
        <RuntimeLoading label="Loading your conversations…" />
      ) : (
        <section
          className="messages-workspace"
          aria-label="Messages"
          data-chat-theme={preferences.theme}
        >
          <aside className={`messages-inbox${active ? " messages-inbox-hidden-mobile" : ""}`}>
            <div className="messages-inbox-heading">
              <div>
                <span className="messages-kicker">YOUR INBOX</span>
                <h2>Conversations</h2>
              </div>
              <div className="messages-inbox-actions">
                <span className="messages-count">{conversations.length}</span>
                <Link
                  className="v-icon"
                  to="/settings/notifications"
                  aria-label="Message notification settings"
                >
                  <Bell size={20} />
                </Link>
              </div>
            </div>
            <label className="messages-search">
              <Search aria-hidden="true" size={17} />
              <Input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
              {conversationSearch ? (
                <button
                  type="button"
                  aria-label="Clear conversation search"
                  onClick={() => setConversationSearch("")}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              ) : null}
            </label>
            <div className="messages-filter-row" role="group" aria-label="Filter conversations">
              {(
                [
                  ["all", "All"],
                  ["unread", "Unread"],
                  ["groups", "Groups"],
                  ["archived", "Archived"],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  className={inboxFilter === filter ? "is-selected" : ""}
                  aria-pressed={inboxFilter === filter}
                  onClick={() => setInboxFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="chat-start-workspace">
              <summary>
                <MessageCircle size={16} /> Start a conversation <span>+</span>
              </summary>
              <form className="messages-new-chat" onSubmit={startConversation}>
                <label className="sr-only" htmlFor="new-message-username">
                  Username to message
                </label>
                <Input
                  id="new-message-username"
                  value={startWith}
                  onChange={(event) => setStartWith(event.target.value)}
                  placeholder="Start with a username"
                  autoComplete="off"
                />
                <Button type="submit" aria-label="Start conversation" disabled={sending}>
                  <span className="messages-new-chat-label">
                    {sending ? "Opening…" : "New chat"}
                  </span>
                  <span className="messages-new-chat-icon" aria-hidden="true">
                    <MessageCircle size={16} />
                  </span>
                </Button>
              </form>
            </details>
            <div className="chat-inbox-links">
              <Link to="/groups/create">New group</Link>
              <Link to="/settings/notifications">Notification settings</Link>
            </div>
            {searchingUsers ? (
              <p className="messages-user-search-status" role="status">
                Searching people…
              </p>
            ) : null}
            {userResults.length ? (
              <div className="messages-user-results" aria-label="People to message">
                {userResults.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={sending}
                    onClick={() => void openDirectConversation(profile.id)}
                  >
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" width={34} height={34} />
                    ) : (
                      <span className="messages-user-search-fallback" aria-hidden="true">
                        {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <strong>{profile.display_name || `@${profile.username}`}</strong>
                      <small>@{profile.username}</small>
                    </span>
                    <MessageCircle size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}
            {startError ? (
              <p role="alert" className="form-error messages-start-error">
                {startError}
              </p>
            ) : null}
            <div className="messages-conversation-list" aria-label="Conversations">
              {conversations.length === 0 ? (
                <div className="messages-inbox-empty">
                  <MessageCircle aria-hidden="true" size={23} />
                  <strong>No conversations yet</strong>
                  <span>Start a chat by entering someone’s username above.</span>
                </div>
              ) : (
                (() => {
                  const search = conversationSearch.trim().toLowerCase();
                  const filtered = conversations
                    .filter((conversation) => {
                      const mine = conversation.conversation_participants.find(
                        (participant) => participant.user_id === user.id,
                      );
                      const unread =
                        conversation.unread_count !== undefined
                          ? conversation.unread_count > 0
                          : Boolean(mine?.mark_unread_at) ||
                            (Boolean(conversation.last_message_id) &&
                              conversation.last_message_sender_id !== user.id &&
                              (!mine?.last_read_at ||
                                (conversation.last_message_at ?? "") > mine.last_read_at));
                      const archived = Boolean(mine?.archived_at);
                      const matchesFilter =
                        inboxFilter === "archived"
                          ? archived
                          : !archived &&
                            (inboxFilter === "all" ||
                              (inboxFilter === "unread" && unread) ||
                              (inboxFilter === "groups" && conversation.kind === "group"));
                      const others = (conversation.profiles ?? []).filter(
                        (profile) => profile.id !== user.id,
                      );
                      const label =
                        conversation.kind === "group"
                          ? conversation.title || "Group conversation"
                          : others.length === 1
                            ? localPreferencesFor(conversation.id).nicknames[others[0].id] ||
                              `@${others[0].username}`
                            : "Direct conversation";
                      return (
                        matchesFilter &&
                        (!search ||
                          label.toLowerCase().includes(search) ||
                          others.some((profile) =>
                            `${profile.display_name} ${profile.username}`
                              .toLowerCase()
                              .includes(search),
                          ) ||
                          (!localPreferencesFor(conversation.id).hiddenIds.includes(
                            conversation.last_message_id || "",
                          ) &&
                            (!localPreferencesFor(conversation.id).childMode ||
                              !containsBlockedLanguage(conversation.last_message_preview)) &&
                            (conversation.last_message_preview ?? "")
                              .toLowerCase()
                              .includes(search)))
                      );
                    })
                    .sort(
                      (a, b) =>
                        Number(
                          Boolean(
                            b.conversation_participants.find((p) => p.user_id === user.id)?.pinned,
                          ),
                        ) -
                        Number(
                          Boolean(
                            a.conversation_participants.find((p) => p.user_id === user.id)?.pinned,
                          ),
                        ),
                    );
                  return filtered.length ? (
                    filtered.map((conversation) => {
                      const others = (conversation.profiles ?? []).filter(
                        (profile) => profile.id !== user.id,
                      );
                      const label =
                        conversation.kind === "group"
                          ? conversation.title || "Group conversation"
                          : others.length === 1
                            ? localPreferencesFor(conversation.id).nicknames[others[0].id] ||
                              `@${others[0].username}`
                            : "Direct conversation";
                      const myReadAt = conversation.conversation_participants.find(
                        (participant) => participant.user_id === user.id,
                      )?.last_read_at;
                      const unread =
                        conversation.unread_count !== undefined
                          ? conversation.unread_count > 0
                          : Boolean(
                              conversation.conversation_participants.find(
                                (participant) => participant.user_id === user.id,
                              )?.mark_unread_at,
                            ) ||
                            (Boolean(conversation.last_message_id) &&
                              conversation.last_message_sender_id !== user.id &&
                              (!myReadAt || (conversation.last_message_at ?? "") > myReadAt));
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          className={`messages-conversation${conversation.id === activeId ? " is-active" : ""}${unread ? " is-unread" : ""}`}
                          aria-current={conversation.id === activeId ? "true" : undefined}
                          disabled={sending}
                          onClick={() => selectConversation(conversation.id)}
                        >
                          {others[0]?.avatar_url ? (
                            <img
                              className="messages-avatar"
                              src={others[0].avatar_url}
                              alt=""
                              width={46}
                              height={46}
                            />
                          ) : (
                            <span
                              className="messages-avatar messages-avatar-fallback"
                              aria-hidden="true"
                            >
                              {(others[0]?.display_name || others[0]?.username || label)
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          )}
                          <span className="messages-conversation-copy">
                            <span className="messages-conversation-topline">
                              <strong>{label}</strong>
                              {conversation.last_message_at ? (
                                <time dateTime={conversation.last_message_at}>
                                  {new Date(conversation.last_message_at).toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" },
                                  )}
                                </time>
                              ) : null}
                            </span>
                            <span className="messages-conversation-preview">
                              {localPreferencesFor(conversation.id).hiddenIds.includes(
                                conversation.last_message_id || "",
                              )
                                ? "Message hidden on this device"
                                : localPreferencesFor(conversation.id).childMode &&
                                    containsBlockedLanguage(conversation.last_message_preview)
                                  ? "Text hidden by Child Mode"
                                  : conversation.last_message_preview || "Start a conversation"}
                            </span>
                          </span>
                          {conversation.conversation_participants.find(
                            (participant) => participant.user_id === user.id,
                          )?.pinned ? (
                            <Pin
                              aria-label="Pinned conversation"
                              size={14}
                              className="messages-pinned-indicator"
                            />
                          ) : null}
                          {conversation.unread_count ? (
                            <span
                              className="messages-unread-count"
                              aria-label={`${conversation.unread_count} unread messages`}
                            >
                              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                            </span>
                          ) : unread ? (
                            <span className="messages-unread-dot" aria-label="Unread" />
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="messages-search-empty" role="status" aria-live="polite">
                      {conversationSearch.trim()
                        ? `No conversations match “${conversationSearch.trim()}”.`
                        : inboxFilter === "unread"
                          ? "No unread conversations."
                          : inboxFilter === "groups"
                            ? "No group conversations yet."
                            : inboxFilter === "archived"
                              ? "No archived conversations."
                              : "No conversations match the current filters."}
                    </div>
                  );
                })()
              )}
              {moreConversations ? (
                <Button
                  className="button button-quiet"
                  onClick={() => setConversationLimit((n) => n + 50)}
                >
                  Load more conversations
                </Button>
              ) : null}
            </div>
          </aside>

          <section
            className={`messages-thread${active ? " messages-thread-visible-mobile" : ""}`}
            aria-label={active ? "Conversation" : "Selected conversation"}
          >
            {active ? (
              <>
                <header className="messages-thread-header">
                  <button
                    type="button"
                    className="messages-back-button"
                    disabled={sending}
                    onClick={closeConversation}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    className="chat-header-avatar"
                    aria-label="Preview profile picture"
                    onClick={() =>
                      setAvatarPreview({
                        src: activeOther?.avatar_url || null,
                        name: activeOther?.display_name || "Conversation",
                      })
                    }
                  >
                    {activeOther?.avatar_url ? (
                      <img src={activeOther.avatar_url} alt="" />
                    ) : (
                      <Users size={23} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="messages-thread-person chat-header-name"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setDetailsTab("details");
                      setDetailsOpen(true);
                    }}
                  >
                    <strong>
                      {preferences.nicknames[activeOther?.id || ""] ||
                        (active.kind === "group"
                          ? active.title || "Group conversation"
                          : activeOther?.display_name || "@" + activeOther?.username)}
                    </strong>
                    <span>
                      {preferences.childMode ? (
                        <>
                          <ShieldCheck size={11} /> Child Mode ·{" "}
                        </>
                      ) : null}
                      {active.kind === "group"
                        ? active.profiles.length + " people"
                        : activeOther && onlineUserIds.includes(activeOther.id)
                          ? "Online"
                          : "Conversation details"}
                      <ChevronRight size={12} />
                    </span>
                  </button>
                  <div className="messages-thread-actions" aria-label="Conversation controls">
                    <button
                      type="button"
                      aria-label="Conversation details"
                      onClick={() => {
                        setDetailsTab("details");
                        setDetailsOpen(true);
                      }}
                    >
                      <Info size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        activeParticipant?.pinned ? "Unpin conversation" : "Pin conversation"
                      }
                      title={activeParticipant?.pinned ? "Unpin" : "Pin"}
                      onClick={() =>
                        void updateActiveParticipant({ pinned: !activeParticipant?.pinned })
                      }
                    >
                      <Pin size={16} aria-hidden="true" />
                    </button>
                    <details className="messages-mute-menu">
                      <summary
                        aria-label={
                          activeParticipant?.muted_until
                            ? "Conversation mute options"
                            : "Mute conversation"
                        }
                        title={activeParticipant?.muted_until ? "Mute options" : "Mute"}
                      >
                        <VolumeX size={16} aria-hidden="true" />
                      </summary>
                      <div
                        className="messages-mute-options"
                        role="group"
                        aria-label="Mute duration"
                      >
                        {activeParticipant?.muted_until ? (
                          <button
                            type="button"
                            onClick={() => void updateActiveParticipant({ muted_until: null })}
                          >
                            Unmute
                          </button>
                        ) : (
                          (
                            [
                              ["1 hour", 60 * 60 * 1000],
                              ["8 hours", 8 * 60 * 60 * 1000],
                              ["24 hours", 24 * 60 * 60 * 1000],
                            ] as const
                          ).map(([label, duration]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() =>
                                void updateActiveParticipant({
                                  muted_until: new Date(Date.now() + duration).toISOString(),
                                })
                              }
                            >
                              {label}
                            </button>
                          ))
                        )}
                      </div>
                    </details>
                    <button
                      type="button"
                      aria-label={
                        activeParticipant?.archived_at
                          ? "Restore conversation"
                          : "Archive conversation"
                      }
                      title={activeParticipant?.archived_at ? "Restore" : "Archive"}
                      onClick={async () => {
                        const updated = await updateActiveParticipant({
                          archived_at: activeParticipant?.archived_at
                            ? null
                            : new Date().toISOString(),
                        });
                        if (updated && activeParticipant?.archived_at) setInboxFilter("all");
                        if (updated) closeConversation();
                      }}
                    >
                      <Archive size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mark conversation unread"
                      title="Mark unread"
                      onClick={async () => {
                        await updateActiveParticipant({ mark_unread_at: new Date().toISOString() });
                        closeConversation();
                      }}
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                    </button>
                  </div>
                </header>
                {showChatSearch ? (
                  <div className="chat-thread-search">
                    <Search size={16} />
                    <input
                      aria-label="Search loaded messages"
                      placeholder="Search loaded messages"
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                    />
                    <button
                      aria-label="Close chat search"
                      onClick={() => {
                        setShowChatSearch(false);
                        setChatSearch("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : null}
                <div
                  className="messages-thread-body"
                  ref={threadBody}
                  onScroll={() => {
                    const e = threadBody.current;
                    if (e) nearBottom.current = e.scrollHeight - e.scrollTop - e.clientHeight < 80;
                  }}
                >
                  {threadLoading ? (
                    <div className="chat-thread-loading" role="status">
                      <VeloriLoop />
                      <span>Opening your conversation…</span>
                    </div>
                  ) : null}
                  {hasOlderMessages ? (
                    <button
                      type="button"
                      className="messages-load-older"
                      disabled={loadingOlder}
                      onClick={() => void loadOlderMessages()}
                    >
                      {loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}
                    </button>
                  ) : null}
                  {!threadLoading && messages.length === 0 ? (
                    <div className="messages-thread-empty">
                      <span className="messages-empty-icon">
                        <MessageCircle aria-hidden="true" size={24} />
                      </span>
                      <strong>Your conversation starts here</strong>
                      <span>Send a message to get things going.</span>
                    </div>
                  ) : (
                    <ul className="messages-message-list" aria-label="Messages" aria-live="polite">
                      {visibleMessages.map((message, messageIndex) => {
                        const ownMessage = message.sender_id === user.id;
                        const filteredByChildMode =
                          preferences.childMode && containsBlockedLanguage(message.body);
                        const day = new Date(message.created_at).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        });
                        const previousDay =
                          messageIndex > 0
                            ? new Date(
                                visibleMessages[messageIndex - 1].created_at,
                              ).toLocaleDateString(undefined, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : null;
                        return (
                          <Fragment key={message.id}>
                            {day !== previousDay ? (
                              <li className="messages-day-divider">
                                <time dateTime={message.created_at}>{day}</time>
                              </li>
                            ) : null}
                            <li
                              id={`message-${message.id}`}
                              key={message.id}
                              className={`messages-message-row${ownMessage ? " is-own-message" : ""}${vanishingId === message.id ? " is-vanishing" : ""}`}
                            >
                              <div className="messages-message-bubble">
                                {!ownMessage && active.kind === "group" ? (
                                  <span className="messages-message-author">
                                    @{message.profiles?.username ?? "unknown"}
                                  </span>
                                ) : null}
                                {vanishingId === message.id ? (
                                  <span className="velori-delete-magic" aria-hidden="true">
                                    velori<span>✦</span>
                                  </span>
                                ) : null}
                                {message.deleted_at ? (
                                  <p className="messages-deleted">Message deleted</p>
                                ) : filteredByChildMode ? (
                                  <p className="chat-filtered-message">
                                    <ShieldCheck size={16} />
                                    Text hidden by Child Mode
                                  </p>
                                ) : (
                                  <>
                                    {message.reply_to_id ? (
                                      <p className="messages-reply-reference">
                                        Replying to{" "}
                                        {preferences.childMode
                                          ? "an earlier message"
                                          : messages.find((item) => item.id === message.reply_to_id)
                                              ?.body || "an earlier message"}
                                      </p>
                                    ) : null}
                                    {message.body ? <p>{message.body}</p> : null}
                                    {message.shared_content_type && message.shared_content_id ? (
                                      <Link
                                        className="message-content-reference"
                                        to={
                                          message.shared_content_type === "post"
                                            ? `/post/${message.shared_content_id}`
                                            : message.shared_content_type === "reel"
                                              ? `/reels?reel=${encodeURIComponent(message.shared_content_id)}`
                                              : `/stories?story=${encodeURIComponent(message.shared_content_id)}`
                                        }
                                      >
                                        <strong>
                                          {message.shared_content_type === "story"
                                            ? "Story reply"
                                            : message.shared_content_type === "reel"
                                              ? "Shared reel"
                                              : "Shared post"}
                                        </strong>
                                        <span>Open the original content</span>
                                      </Link>
                                    ) : null}
                                    {message.message_attachments?.map((item) =>
                                      item.signed_url ? (
                                        <div key={item.id} className="message-attachment">
                                          {item.media_type === "image" ? (
                                            <img
                                              src={item.signed_url}
                                              alt={
                                                preferences.childMode
                                                  ? "Message attachment"
                                                  : item.alt_text || "Message attachment"
                                              }
                                              loading="lazy"
                                            />
                                          ) : item.media_type === "video" ? (
                                            <video
                                              src={item.signed_url}
                                              controls
                                              playsInline
                                              preload="metadata"
                                            />
                                          ) : item.media_type === "audio" ? (
                                            <audio
                                              src={item.signed_url}
                                              controls
                                              preload="metadata"
                                            />
                                          ) : (
                                            <a
                                              href={item.signed_url}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {preferences.childMode
                                                ? "Open attached file"
                                                : item.alt_text || "Open attached file"}
                                            </a>
                                          )}
                                        </div>
                                      ) : null,
                                    )}
                                  </>
                                )}
                                <time dateTime={message.created_at}>
                                  {new Date(message.created_at).toLocaleTimeString(undefined, {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </time>
                                {message.edited_at ? (
                                  <span className="messages-edited-label">Edited</span>
                                ) : null}
                              </div>
                              <div className="messages-message-actions">
                                {!message.deleted_at && !filteredByChildMode ? (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Reply to message"
                                      title="Reply"
                                      onClick={() => setReplyTo(message)}
                                    >
                                      <Reply size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="React with a heart"
                                      title="React with a heart"
                                      onClick={() => void toggleReaction(message, "❤️")}
                                    >
                                      <Smile size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={
                                        activeParticipant?.pinned_message_id === message.id
                                          ? "Unpin message"
                                          : "Pin message"
                                      }
                                      title={
                                        activeParticipant?.pinned_message_id === message.id
                                          ? "Unpin message"
                                          : "Pin message"
                                      }
                                      onClick={() =>
                                        void updateActiveParticipant({
                                          pinned_message_id:
                                            activeParticipant?.pinned_message_id === message.id
                                              ? null
                                              : message.id,
                                        })
                                      }
                                    >
                                      <Pin size={14} />
                                    </button>
                                    {ownMessage ? (
                                      <>
                                        <button
                                          type="button"
                                          aria-label="Edit message"
                                          title="Edit"
                                          onClick={() => {
                                            setEditingMessage(message);
                                            setReplyTo(null);
                                            setDraft(message.body);
                                          }}
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          aria-label="Delete message"
                                          title="Delete"
                                          onClick={() => {
                                            setDeleteError("");
                                            setDeleteTarget(message);
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    ) : null}
                                  </>
                                ) : null}
                                {!ownMessage ? (
                                  <button
                                    type="button"
                                    aria-label="Delete message for me"
                                    title="Delete for me"
                                    onClick={() => {
                                      setDeleteError("");
                                      setDeleteTarget(message);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : null}
                                {!ownMessage ? (
                                  <button
                                    type="button"
                                    aria-label="Report message"
                                    title="Report"
                                    onClick={() => {
                                      setReportId(message.id);
                                      setSafetyError("");
                                      setReportOpen(true);
                                    }}
                                  >
                                    <Flag size={14} />
                                  </button>
                                ) : null}
                                {messageReactions[message.id]?.map((item) => (
                                  <button
                                    key={`${item.user_id}-${item.reaction}`}
                                    type="button"
                                    className={item.user_id === user.id ? "is-own-reaction" : ""}
                                    aria-label={`Reacted ${item.reaction}`}
                                    onClick={() => void toggleReaction(message, item.reaction)}
                                  >
                                    {item.reaction}
                                  </button>
                                ))}
                              </div>
                            </li>
                          </Fragment>
                        );
                      })}
                    </ul>
                  )}
                  {typingUserId ? (
                    <div className="messages-typing-indicator" role="status" aria-live="polite">
                      <span className="messages-typing-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      {active.profiles.find((profile) => profile.id === typingUserId)
                        ?.display_name || "Someone"}{" "}
                      is typing
                    </div>
                  ) : null}
                </div>
                <form className="messages-composer" onSubmit={send}>
                  {replyTo || editingMessage ? (
                    <div className="messages-compose-context">
                      <span>
                        {editingMessage
                          ? "Editing message"
                          : `Replying to ${replyTo?.profiles?.display_name || `@${replyTo?.profiles?.username ?? "member"}`}`}
                      </span>
                      {!editingMessage && replyTo?.body ? (
                        <span className="messages-compose-context-preview">
                          {replyTo.body.slice(0, 90)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Cancel reply or edit"
                        onClick={() => {
                          setReplyTo(null);
                          setEditingMessage(null);
                          setDraft("");
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : null}
                  {attachment ? (
                    <div className="messages-attachment-chip" role="status">
                      <Paperclip aria-hidden="true" size={15} />
                      <AttachmentPreview file={attachment} />
                      <span>{attachment.name}</span>
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() => {
                          setAttachment(null);
                          if (attachmentInput.current) attachmentInput.current.value = "";
                        }}
                        disabled={sending}
                      >
                        <X aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ) : null}
                  {sendError ? (
                    <p role="alert" className="messages-send-error">
                      {sendError}
                    </p>
                  ) : null}
                  {recording ? (
                    <span className="messages-recording-status" role="status">
                      <span className="messages-recording-dot" />
                      Recording voice note · {Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                  <div className="messages-composer-controls">
                    <ChatExpressionPicker
                      disabled={sending || recording}
                      onGif={(file) => {
                        void validateMessageAttachment(file)
                          .then(() => {
                            setAttachment(file);
                            setSendError("");
                          })
                          .catch((error) =>
                            setSendError(
                              error instanceof Error ? error.message : "Choose another GIF.",
                            ),
                          );
                      }}
                      onEmoji={(emoji) => {
                        const start = composerInput.current?.selectionStart ?? draft.length;
                        const end = composerInput.current?.selectionEnd ?? start;
                        const nextDraft = draft.slice(0, start) + emoji + draft.slice(end);
                        if (nextDraft.length > 5000) return;
                        requestAnimationFrame(() => {
                          composerInput.current?.focus();
                          composerInput.current?.setSelectionRange(
                            start + emoji.length,
                            start + emoji.length,
                          );
                        });
                        setDraft(nextDraft);
                        if (!editingMessage) broadcastTyping();
                        if (user && activeId) {
                          try {
                            localStorage.setItem(
                              `velori-message-draft:${user.id}:${activeId}`,
                              nextDraft,
                            );
                          } catch {}
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={`messages-attach-button messages-record-button${recording ? " is-recording" : ""}`}
                      aria-label={recording ? "Stop voice recording" : "Record voice note"}
                      onClick={recording ? stopAudioRecording : () => void startAudioRecording()}
                      disabled={sending || Boolean(attachment)}
                      title={recording ? "Stop recording" : "Record a voice note"}
                    >
                      {recording ? (
                        <Square aria-hidden="true" size={16} />
                      ) : (
                        <Mic aria-hidden="true" size={18} />
                      )}
                    </button>
                    <label
                      className="messages-attach-button"
                      aria-label="Attach an image, video, PDF, or audio file"
                    >
                      <Paperclip aria-hidden="true" size={18} />
                      <input
                        ref={attachmentInput}
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,application/pdf,audio/mp4,audio/webm,audio/ogg"
                        onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                        disabled={sending || recording}
                      />
                    </label>
                    <Textarea
                      ref={composerInput}
                      value={draft}
                      maxLength={5000}
                      onChange={(event) => {
                        const nextDraft = event.target.value;
                        setDraft(nextDraft);
                        if (preferences.childMode && containsBlockedLanguage(nextDraft))
                          setChildNotice(true);
                        else setChildNotice(false);
                        if (!editingMessage) broadcastTyping();
                        if (user && activeId) {
                          const key = `velori-message-draft:${user.id}:${activeId}`;
                          try {
                            if (nextDraft) window.localStorage.setItem(key, nextDraft);
                            else window.localStorage.removeItem(key);
                          } catch {
                            /* The visible draft remains available. */
                          }
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      rows={1}
                      placeholder="Write a message…"
                      aria-label="Your message"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      aria-label={
                        sending
                          ? "Sending message"
                          : editingMessage
                            ? "Save message"
                            : "Send message"
                      }
                      disabled={
                        sending ||
                        recording ||
                        (editingMessage ? !draft.trim() : !draft.trim() && !attachment)
                      }
                    >
                      <Send aria-hidden="true" size={17} />
                    </Button>
                  </div>
                  <span className="messages-composer-hint">
                    Press Enter to send · Shift + Enter for a new line · 25 MB max per attachment ·
                    5 min max voice note
                  </span>
                </form>
              </>
            ) : (
              <div className="messages-select-prompt">
                <div className="chat-welcome-art" aria-hidden="true">
                  <span>
                    <MessageCircle size={40} />
                  </span>
                  <i />
                  <b>hello.</b>
                </div>
                <span className="chat-welcome-kicker">MADE FOR REAL CONNECTION</span>
                <strong>
                  Good conversations.
                  <br />
                  Great company.
                </strong>
                <span>Select a chat or start a new conversation.</span>
              </div>
            )}
          </section>
        </section>
      )}
      {preferences.childMode ? (
        <div className="chat-mode-indicator">
          <ShieldCheck size={13} />
          Child Mode · text filter on this device
        </div>
      ) : null}
      {childNotice ? (
        <ChildModeNotice
          onClose={() => setChildNotice(false)}
          onDisable={() => {
            if (updatePreferences({ childMode: false })) setChildNotice(false);
          }}
          onSettings={() => {
            setDetailsTab("settings");
            setDetailsOpen(true);
            setChildNotice(false);
          }}
        />
      ) : null}
      {inboxAlert ? (
        <div className="chat-inbox-alert" role="status">
          <Bell size={20} />
          <button
            onClick={() => {
              selectConversation(inboxAlert.id);
              setInboxAlert(null);
            }}
          >
            <strong>{inboxAlert.name}</strong>
            <span>New message · Open chat</span>
          </button>
          <button aria-label="Dismiss new message" onClick={() => setInboxAlert(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}
      {chatNotice || preferenceError ? (
        <p role="status" className="chat-operation-feedback">
          {preferenceError || chatNotice}
        </p>
      ) : null}
      {detailsOpen && active ? (
        <ChatDetails
          key={active.id}
          initialTab={detailsTab}
          conversationId={active.id}
          title={
            active.kind === "group"
              ? active.title || "Group conversation"
              : preferences.nicknames[activeOther?.id || ""] ||
                activeOther?.display_name ||
                activeOther?.username ||
                "Conversation"
          }
          kind={active.kind}
          people={active.profiles}
          userId={user.id}
          preferences={preferences}
          update={updatePreferences}
          syncStatus={syncStatus}
          onRetrySync={retrySync}
          muted={Boolean(
            activeParticipant?.muted_until &&
            Date.parse(activeParticipant.muted_until) > Date.now(),
          )}
          pinned={Boolean(activeParticipant?.pinned)}
          busy={safetyBusy || sending}
          notice={chatNotice || preferenceError}
          onAction={(action) => void chatAction(action)}
          onBlock={(person) => {
            setDetailsOpen(false);
            setSafetyError("");
            setBlockTarget(person);
          }}
          onReport={() => {
            setDetailsOpen(false);
            setSafetyError("");
            setReportOpen(true);
          }}
          onAvatar={(person) => {
            setDetailsOpen(false);
            setAvatarPreview({
              src: person.avatar_url,
              name: person.display_name || person.username,
            });
          }}
          onSearch={() => {
            setDetailsOpen(false);
            setShowChatSearch(true);
          }}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
      {avatarPreview ? (
        <AvatarPreview {...avatarPreview} onClose={() => setAvatarPreview(null)} />
      ) : null}
      {deleteTarget ? (
        <ChatDeleteDialog
          own={deleteTarget.sender_id === user.id}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onDelete={(scope) => void confirmDelete(scope)}
        />
      ) : null}
      {blockTarget ? (
        <ChatDialog
          open
          title={"Block @" + blockTarget.username + "?"}
          description="Blocking prevents new direct messages and removes follow relationships. Unblocking does not restore them."
          onClose={() => {
            if (!safetyBusy) setBlockTarget(null);
          }}
        >
          <button
            className="button button-primary"
            disabled={safetyBusy}
            onClick={() => void blockPerson()}
          >
            {safetyBusy ? "Blocking…" : "Block account"}
          </button>
          <Link className="button button-outline" to="/settings/privacy">
            Privacy settings
          </Link>
          {safetyError ? <p role="alert">{safetyError}</p> : null}
        </ChatDialog>
      ) : null}
      {reportOpen ? (
        <ChatDialog
          open
          title="Report a message"
          description="Choose a message and tell the moderation team what happened. A report is submitted only after the server confirms it."
          onClose={() => {
            if (!safetyBusy) setReportOpen(false);
          }}
        >
          <label className="chat-report-field">
            Message
            <select value={reportId} onChange={(e) => setReportId(e.target.value)}>
              <option value="">Choose a message</option>
              {messages
                .filter((m) => m.sender_id !== user.id && !preferences.hiddenIds.includes(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {new Date(m.created_at).toLocaleString()} ·{" "}
                    {preferences.childMode ? "Message" : m.body.slice(0, 55) || "Attachment"}
                  </option>
                ))}
            </select>
          </label>
          <label className="chat-report-field">
            Reason
            <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
              {["harassment", "spam", "hate", "dangerous", "privacy", "scam", "other"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label className="chat-report-field">
            Details
            <textarea
              maxLength={2000}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What would you like us to review?"
            />
          </label>
          <button
            className="button button-primary"
            disabled={safetyBusy || !reportId}
            onClick={() => void reportMessage()}
          >
            {safetyBusy ? "Submitting…" : "Submit report"}
          </button>
          {safetyError ? <p role="alert">{safetyError}</p> : null}
        </ChatDialog>
      ) : null}
    </FeatureFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Groups                                                                    */
/* ------------------------------------------------------------------------- */

export function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const enabled = useFeatureFlag("groups_enabled", true);
  const isCreateRoute = location.pathname === "/groups/create";
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [membership, setMembership] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrivacy, setNewPrivacy] = useState<Group["privacy"]>("public");
  const [createStep, setCreateStep] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    let request = supabase
      .from("groups")
      .select("id,slug,name,description,owner_id,avatar_url,privacy,member_count,created_at")
      .order("created_at", { ascending: false });
    if (query) request = request.ilike("name", `%${query}%`);
    const { data, error: failure } = await request.range(
      page * GROUP_PAGE,
      (page + 1) * GROUP_PAGE - 1,
    );
    if (failure) {
      setError(friendlyError(failure));
      return;
    }
    const nextGroups = (data ?? []) as Group[];
    setGroups((current) => (page === 0 ? nextGroups : [...current, ...nextGroups]));
    setHasMore(nextGroups.length === GROUP_PAGE);
    if (user && nextGroups.length) {
      const groupIds = nextGroups.map((group) => group.id);
      const { data: relationships, error: relationshipsFailure } = await supabase
        .from("group_members")
        .select("group_id,status")
        .eq("user_id", user.id)
        .in("group_id", groupIds);
      if (relationshipsFailure) {
        setError(friendlyError(relationshipsFailure));
        return;
      }
      setMembership((current) => {
        const next = { ...current };
        for (const groupId of groupIds) delete next[groupId];
        for (const row of relationships ?? []) next[row.group_id] = row.status;
        return next;
      });
    } else if (!user) {
      setMembership({});
    }
    setError("");
  }, [page, query, user]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function join(group: Group) {
    setBusy(group.id);
    const { error: failure } = await supabase.rpc("join_group", { p_group_id: group.id });
    setBusy(null);
    if (failure) {
      setError(friendlyError(failure));
      return;
    }
    setError("");
    await load();
  }

  async function leave(group: Group) {
    setBusy(group.id);
    const { error: failure } = await supabase.rpc("leave_group", { p_group_id: group.id });
    setBusy(null);
    if (failure) {
      setError(friendlyError(failure));
      return;
    }
    setError("");
    await load();
  }

  async function acceptInvite(group: Group) {
    setBusy(group.id);
    const { error: acceptFailure } = await supabase.rpc("accept_group_invite", {
      p_group_id: group.id,
    });
    setBusy(null);
    if (acceptFailure) {
      setError(friendlyError(acceptFailure));
      return;
    }
    setError("");
    await load();
  }

  async function withdraw(group: Group) {
    if (!user) return;
    setBusy(group.id);
    const { error: withdrawFailure } = await supabase.rpc("leave_group", {
      p_group_id: group.id,
    });
    setBusy(null);
    if (withdrawFailure) {
      setError(friendlyError(withdrawFailure));
      return;
    }
    setError("");
    await load();
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const name = newName.trim();
    if (!name || name.length > 80 || newDescription.length > 2000) {
      setError("Group names must be 1–80 characters and descriptions 2000 characters or fewer.");
      return;
    }
    setBusy("create");
    const { data: groupId, error: createFailure } = await supabase.rpc("create_group", {
      p_name: name,
      p_slug: makeGroupSlug(name),
      p_description: newDescription.trim(),
      p_privacy: newPrivacy,
    });
    if (createFailure || !groupId) {
      setBusy(null);
      setError(createFailure ? friendlyError(createFailure) : "The group could not be created.");
      return;
    }
    const { data: created, error: lookupFailure } = await supabase
      .from("groups")
      .select("slug")
      .eq("id", groupId)
      .single();
    setBusy(null);
    if (lookupFailure || !created) {
      setError(lookupFailure ? friendlyError(lookupFailure) : "The new group could not be opened.");
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewPrivacy("public");
    await load();
    navigate(`/groups/${created.slug}`);
  }

  if (authLoading)
    return <FeatureFrame eyebrow="GROUPS" title="Groups." subtitle="Checking your session…" />;
  if (!enabled)
    return (
      <FeatureFrame eyebrow="GROUPS" title="Groups." subtitle="Currently turned off.">
        <DisabledNotice name="Groups" />
      </FeatureFrame>
    );

  const privacyLabel = {
    public: "Public",
    private: "Approval required",
    hidden: "Members only",
  } as const;

  return (
    <FeatureFrame
      eyebrow="GROUPS"
      title={isCreateRoute ? "Create a group." : "Groups."}
      subtitle={
        isCreateRoute
          ? "Start a community around something you care about."
          : user
            ? "Discover public groups and private communities you can request to join, alongside groups you belong to."
            : "Sign in to join or start a conversation inside a group."
      }
      className="group-discovery-page"
    >
      {error ? (
        <Problem
          message={error}
          retry={() => {
            setError("");
            void load();
          }}
        />
      ) : null}

      {user && isCreateRoute ? (
        <form className="stack card group-creation-form" onSubmit={createGroup}>
          <div className="group-create-progress" aria-label={`Step ${createStep} of 3`}>
            {["Identity", "Privacy", "Preview"].map((step, index) => (
              <span className={createStep >= index + 1 ? "is-current" : ""} key={step}>
                <strong>{index + 1}</strong> {step}
              </span>
            ))}
          </div>
          {createStep === 1 ? (
            <>
              <h2>Give your group an identity</h2>
              <label className="field">
                <span>Group name</span>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={80}
                  required
                />
                <small>{newName.trim().length}/80 characters</small>
              </label>
              <label className="field">
                <span>
                  Description <span className="optional">optional</span>
                </span>
                <Textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  maxLength={2000}
                  rows={4}
                />
                <small>{newDescription.length}/2000 characters</small>
              </label>
              <Button
                type="button"
                disabled={!newName.trim() || newName.trim().length > 80}
                onClick={() => setCreateStep(2)}
              >
                Continue to privacy
              </Button>
            </>
          ) : createStep === 2 ? (
            <>
              <h2>Choose who can find and join</h2>
              <div className="group-privacy-choices">
                {(
                  [
                    ["public", "Public", "Anyone can discover this group and join right away."],
                    ["private", "Private", "People can find the group and request to join."],
                    ["hidden", "Hidden", "Only invited people can find and join this group."],
                  ] as const
                ).map(([value, title, description]) => (
                  <label
                    className={`group-privacy-choice ${newPrivacy === value ? "is-selected" : ""}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="group-privacy"
                      value={value}
                      checked={newPrivacy === value}
                      onChange={() => setNewPrivacy(value)}
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="group-create-actions">
                <Button type="button" onClick={() => setCreateStep(1)}>
                  Back
                </Button>
                <Button type="button" className="button-primary" onClick={() => setCreateStep(3)}>
                  Review group
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2>Review your group</h2>
              <div className="group-create-preview">
                <span className="group-card-avatar" aria-hidden="true">
                  {newName.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{newName.trim()}</strong>
                  <small>{privacyLabel[newPrivacy]} · You’ll be the first member</small>
                  <p>{newDescription.trim() || "A new community is taking shape."}</p>
                </div>
              </div>
              <div className="group-create-actions">
                <Button type="button" disabled={busy !== null} onClick={() => setCreateStep(2)}>
                  Back
                </Button>
                <Button type="submit" className="button-primary" disabled={busy !== null}>
                  {busy === "create" ? "Creating…" : "Create group"}
                </Button>
              </div>
              <p className="muted">
                Group identity, owner membership, and group chat are created together on the server.
              </p>
            </>
          )}
        </form>
      ) : null}
      {!user && isCreateRoute ? (
        <EmptyState
          icon={Users}
          title="Sign in to create a group"
          text="Your new community will be connected to your VELORI account."
          action="Sign in"
          to="/login"
        />
      ) : null}

      {!isCreateRoute ? (
        <div className="group-discovery-actions">
          <div>
            <h2>Find your community</h2>
            <p>Explore groups created by VELORI members.</p>
          </div>
          <label className="group-search-field">
            <span>Search groups</span>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search by group name"
            />
          </label>
          {user ? (
            <Link className="button button-primary" to="/groups/create">
              Create a group
            </Link>
          ) : (
            <Link className="button button-primary" to="/login">
              Sign in to create a group
            </Link>
          )}
        </div>
      ) : null}

      {!isCreateRoute && loading ? (
        <RuntimeLoading label="Loading groups…" />
      ) : !isCreateRoute && groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "No matching groups" : "No groups to show yet"}
          text={
            query
              ? "Try another group name."
              : "When members create discoverable groups, they’ll appear here."
          }
        />
      ) : !isCreateRoute ? (
        <ul className="group-discovery-list" aria-label="Groups">
          {groups.map((group) => {
            const status = membership[group.id];
            const joined = status === "active";
            return (
              <li key={group.id} className="card group-discovery-card">
                <div className="group-discovery-card-heading">
                  <span className="group-card-avatar" aria-hidden="true">
                    {group.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h2>
                      <Link to={`/groups/${group.slug}`}>{group.name}</Link>
                    </h2>
                    <p className="muted">
                      {privacyLabel[group.privacy]} · {group.member_count}{" "}
                      {group.member_count === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                {group.description ? (
                  <p className="group-card-description">{group.description}</p>
                ) : null}
                {user ? (
                  joined ? (
                    <p className="muted" role="status">
                      You are a member.{" "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void leave(group)}
                        disabled={busy === group.id}
                      >
                        Leave
                      </button>
                    </p>
                  ) : status === "requested" ? (
                    <p className="muted" role="status">
                      Your request is waiting for an admin.{" "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void withdraw(group)}
                        disabled={busy === group.id}
                      >
                        Cancel request
                      </button>
                    </p>
                  ) : status === "invited" ? (
                    <div className="cluster">
                      <Button
                        type="button"
                        onClick={() => void acceptInvite(group)}
                        disabled={busy === group.id}
                      >
                        {busy === group.id ? "Working…" : "Accept invitation"}
                      </Button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void withdraw(group)}
                        disabled={busy === group.id}
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void join(group)}
                      disabled={busy === group.id}
                    >
                      {busy === group.id
                        ? "Working…"
                        : group.privacy === "public"
                          ? "Join group"
                          : "Request to join"}
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!isCreateRoute && hasMore && !loading ? (
        <Button type="button" disabled={loading} onClick={() => setPage((current) => current + 1)}>
          Load more groups
        </Button>
      ) : null}
    </FeatureFrame>
  );
}

type GroupRosterEntry = {
  user_id: string;
  role: "owner" | "admin" | "moderator" | "member";
  status: "requested" | "invited" | "active" | "banned";
  joined_at: string | null;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

export function GroupDetailPage() {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const enabled = useFeatureFlag("groups_enabled", true);
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<{ role: string; status: string } | null>(null);
  const [members, setMembers] = useState<GroupRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSrc, setAvatarSrc] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval" | "invite_only">("open");

  const load = useCallback(async () => {
    if (!slug) {
      setGroup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: groupFailure } = await supabase
      .from("groups")
      .select("id,slug,name,description,owner_id,avatar_url,privacy,member_count,created_at")
      .eq("slug", slug)
      .maybeSingle();
    if (groupFailure || !data) {
      setGroup(null);
      setMembership(null);
      setMembers([]);
      setError(
        groupFailure ? friendlyError(groupFailure) : "This group was not found or is private.",
      );
      setLoading(false);
      return;
    }
    const nextGroup = data as Group;
    setGroup(nextGroup);
    setJoinPolicy(
      nextGroup.privacy === "public"
        ? "open"
        : nextGroup.privacy === "hidden"
          ? "invite_only"
          : "approval",
    );
    setNameDraft(nextGroup.name);
    setDescriptionDraft(nextGroup.description);
    setAvatarSrc("");
    if (nextGroup.avatar_url) {
      if (/^https?:\/\//i.test(nextGroup.avatar_url)) {
        setAvatarSrc(nextGroup.avatar_url);
      } else {
        try {
          setAvatarSrc(await signGroupImage(nextGroup.avatar_url));
        } catch {
          setAvatarSrc("");
        }
      }
    }
    if (!user) {
      setMembership(null);
      setMembers([]);
      setError("");
      setLoading(false);
      return;
    }
    const { data: ownMembership, error: membershipFailure } = await supabase
      .from("group_members")
      .select("role,status")
      .eq("group_id", nextGroup.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipFailure) {
      setError(friendlyError(membershipFailure));
      setLoading(false);
      return;
    }
    setMembership(ownMembership);
    if (ownMembership?.status === "active") {
      const { data: settings, error: settingsFailure } = await supabase
        .from("group_settings")
        .select("join_policy")
        .eq("group_id", nextGroup.id)
        .maybeSingle();
      if (settingsFailure) {
        setError(friendlyError(settingsFailure));
        setLoading(false);
        return;
      }
      if (
        settings?.join_policy === "open" ||
        settings?.join_policy === "approval" ||
        settings?.join_policy === "invite_only"
      ) {
        setJoinPolicy(settings.join_policy);
      }
      const { data: roster, error: rosterFailure } = await supabase
        .from("group_members")
        .select(
          "user_id,role,status,joined_at,profiles!group_members_user_id_fkey(username,display_name,avatar_url)",
        )
        .eq("group_id", nextGroup.id)
        .in("status", ["active", "requested"])
        .order("joined_at", { ascending: true })
        .limit(200);
      if (rosterFailure) {
        setError(friendlyError(rosterFailure));
        setLoading(false);
        return;
      }
      setMembers((roster ?? []) as unknown as GroupRosterEntry[]);
    } else {
      setMembers([]);
    }
    setError("");
    setLoading(false);
  }, [slug, user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  async function runGroupAction(
    action: () => PromiseLike<{ error: { code?: string; message?: string } | null }>,
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error));
      return false;
    }
    setError("");
    await load();
    return true;
  }

  async function joinGroup() {
    if (!group) return;
    setBusy(true);
    const { error: joinFailure } = await supabase.rpc("join_group", { p_group_id: group.id });
    setBusy(false);
    if (joinFailure) setError(friendlyError(joinFailure));
    else await load();
  }

  async function acceptInvite() {
    if (!group) return;
    setBusy(true);
    const { error: acceptFailure } = await supabase.rpc("accept_group_invite", {
      p_group_id: group.id,
    });
    setBusy(false);
    if (acceptFailure) setError(friendlyError(acceptFailure));
    else await load();
  }

  async function withdrawMembership() {
    if (!group || !user) return;
    setBusy(true);
    const { error: withdrawFailure } = await supabase.rpc("leave_group", {
      p_group_id: group.id,
    });
    setBusy(false);
    if (withdrawFailure) setError(friendlyError(withdrawFailure));
    else await load();
  }

  async function leaveGroup() {
    if (!group) return;
    setBusy(true);
    const { error: leaveFailure } = await supabase.rpc("leave_group", { p_group_id: group.id });
    setBusy(false);
    if (leaveFailure) setError(friendlyError(leaveFailure));
    else if (role === "owner") navigate("/groups");
    else await load();
  }

  async function saveGroup(event: React.FormEvent) {
    event.preventDefault();
    if (
      !group ||
      nameDraft.trim().length < 1 ||
      nameDraft.trim().length > 80 ||
      descriptionDraft.length > 2000
    ) {
      setError(
        "Use a group name from 1 to 80 characters and a description of 2000 characters or fewer.",
      );
      return;
    }
    setBusy(true);
    let newAvatarPath = "";
    try {
      if (avatarFile && user) {
        newAvatarPath = await uploadGroupImage(user.id, group.id, avatarFile);
      }
      const updates: { name: string; description: string; avatar_url?: string } = {
        name: nameDraft.trim(),
        description: descriptionDraft,
      };
      if (newAvatarPath) updates.avatar_url = newAvatarPath;
      const { error: saveFailure } = await supabase
        .from("groups")
        .update(updates)
        .eq("id", group.id);
      if (saveFailure) throw saveFailure;
      setAvatarFile(null);
      if (avatarInput.current) avatarInput.current.value = "";
      await load();
      setError("Group details saved.");
      if (newAvatarPath && user && group.avatar_url?.startsWith(`${user.id}/${group.id}/`)) {
        try {
          await removeGroupImage(group.avatar_url);
        } catch {
          // The saved avatar remains valid; an old private object can be removed later.
        }
      }
    } catch (cause) {
      if (newAvatarPath) {
        try {
          await removeGroupImage(newAvatarPath);
        } catch {
          // Keep the original save error; the unreferenced private upload is not publicly readable.
        }
      }
      setError(messageFailure(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reviewMember(userId: string, approve: boolean) {
    if (!group) return;
    setBusy(true);
    const { error: reviewFailure } = await supabase.rpc("review_group_member", {
      p_group_id: group.id,
      p_user_id: userId,
      p_approve: approve,
    });
    setBusy(false);
    if (reviewFailure) setError(friendlyError(reviewFailure));
    else await load();
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!group) return;
    const username = inviteUsername.trim().replace(/^@/, "").toLowerCase();
    if (!usernamePattern.test(username)) {
      setError("Enter a valid username to invite.");
      return;
    }
    setBusy(true);
    const { data: target, error: lookupFailure } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (lookupFailure || !target) {
      setBusy(false);
      setError(lookupFailure ? friendlyError(lookupFailure) : `We couldn't find @${username}.`);
      return;
    }
    const { error: inviteFailure } = await supabase.rpc("invite_group_member", {
      p_group_id: group.id,
      p_user_id: target.id,
    });
    setBusy(false);
    if (inviteFailure) setError(friendlyError(inviteFailure));
    else {
      setInviteUsername("");
      await load();
      setError(`Invitation sent to @${username}.`);
    }
  }

  async function updateMemberRole(member: GroupRosterEntry, role: GroupRosterEntry["role"]) {
    if (!group) return;
    setBusy(true);
    const { error: roleFailure } = await supabase.rpc("set_group_member_role", {
      p_group_id: group.id,
      p_user_id: member.user_id,
      p_role: role,
    });
    setBusy(false);
    if (roleFailure) setError(friendlyError(roleFailure));
    else await load();
  }

  async function removeMember(member: GroupRosterEntry) {
    if (!group) return;
    setBusy(true);
    const { error: removeFailure } = await supabase.rpc("remove_group_member", {
      p_group_id: group.id,
      p_user_id: member.user_id,
    });
    setBusy(false);
    if (removeFailure) setError(friendlyError(removeFailure));
    else await load();
  }

  async function changeJoinPolicy(policy: "open" | "approval" | "invite_only") {
    if (!group) return;
    await runGroupAction(() =>
      supabase.from("group_settings").update({ join_policy: policy }).eq("group_id", group.id),
    );
  }

  async function deleteGroup() {
    if (!group || !user || !window.confirm("Delete this group and its group chat?")) return;
    setBusy(true);
    const { error: deleteFailure } = await supabase
      .from("groups")
      .delete()
      .eq("id", group.id)
      .eq("owner_id", user.id);
    setBusy(false);
    if (deleteFailure) setError(friendlyError(deleteFailure));
    else navigate("/groups");
  }

  if (authLoading || loading)
    return <FeatureFrame eyebrow="GROUPS" title="Group." subtitle="Loading group details…" />;
  if (!enabled)
    return (
      <FeatureFrame eyebrow="GROUPS" title="Group." subtitle="Currently turned off.">
        <DisabledNotice name="Groups" />
      </FeatureFrame>
    );
  if (!group)
    return (
      <FeatureFrame eyebrow="GROUPS" title="Group not found." subtitle="This group is unavailable.">
        <Problem
          message={error || "This group was not found or is private."}
          retry={() => void load()}
        />
        <Link to="/groups">Browse groups</Link>
      </FeatureFrame>
    );

  const role = membership?.role;
  const status = membership?.status;
  const active = status === "active";
  const canModerate = role === "owner" || role === "admin" || role === "moderator";
  const isOwner = role === "owner" && group.owner_id === user?.id;

  return (
    <FeatureFrame
      eyebrow="GROUP"
      title={group.name}
      subtitle={`${group.privacy} group · ${group.member_count} members`}
      className="group-detail-page"
    >
      {avatarSrc ? (
        <img
          className="h-24 w-24 rounded-full object-cover group-profile-avatar"
          src={avatarSrc}
          alt={`${group.name} group image`}
        />
      ) : null}
      {group.description ? <p>{group.description}</p> : null}
      {error ? (
        <p role="status" className="form-error">
          {error}
        </p>
      ) : null}
      {!user ? (
        <p>
          <Link to="/login">Sign in</Link> to join this group.
        </p>
      ) : active ? (
        <div className="stack">
          <p>You are a {role} of this group.</p>
          <Link to="/messages">Open group chat</Link>
          <Button type="button" disabled={busy} onClick={() => void leaveGroup()}>
            Leave group
          </Button>
        </div>
      ) : status === "requested" ? (
        <p role="status">
          Your request is waiting for approval.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => void withdrawMembership()}
            disabled={busy}
          >
            Cancel request
          </button>
        </p>
      ) : status === "invited" ? (
        <div className="cluster">
          <p role="status">You have an invitation to this group.</p>
          <Button type="button" disabled={busy} onClick={() => void acceptInvite()}>
            Accept invitation
          </Button>
          <button
            type="button"
            className="link-button"
            onClick={() => void withdrawMembership()}
            disabled={busy}
          >
            Decline
          </button>
        </div>
      ) : (
        <Button type="button" disabled={busy} onClick={() => void joinGroup()}>
          {busy ? "Working…" : group.privacy === "public" ? "Join group" : "Request to join"}
        </Button>
      )}

      {active && members.length > 0 ? (
        <section className="stack" aria-label="Group members">
          <h2>Members</h2>
          <Link to={`/groups/${group.slug}/members`}>View all members</Link>
          {canModerate ? (
            <Link to={`/groups/${group.slug}/requests`}>Manage join requests</Link>
          ) : null}
          {members.map((member) => (
            <div className="card" key={member.user_id}>
              <strong>
                {member.profiles?.display_name || `@${member.profiles?.username || "member"}`}
              </strong>
              <span className="muted">
                {" "}
                @{member.profiles?.username} · {member.role}
              </span>
              {canModerate && member.status !== "active" ? (
                <div className="cluster">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void reviewMember(member.user_id, true)}
                  >
                    Approve request
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void reviewMember(member.user_id, false)}
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
              {isOwner && member.role !== "owner" && member.status === "active" ? (
                <div className="cluster">
                  <label>
                    <span className="sr-only">Role for @{member.profiles?.username}</span>
                    <select
                      value={member.role}
                      onChange={(event) =>
                        void updateMemberRole(
                          member,
                          event.target.value as GroupRosterEntry["role"],
                        )
                      }
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <Button type="button" disabled={busy} onClick={() => void removeMember(member)}>
                    Remove
                  </Button>
                </div>
              ) : canModerate && member.role === "member" && member.status === "active" ? (
                <Button type="button" disabled={busy} onClick={() => void removeMember(member)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {active && (role === "owner" || role === "admin") ? (
        <form className="stack card" onSubmit={inviteMember}>
          <h2>Invite a member</h2>
          <label className="field">
            <span>Username</span>
            <Input
              value={inviteUsername}
              onChange={(event) => setInviteUsername(event.target.value)}
              placeholder="username"
              autoComplete="off"
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send invitation"}
          </Button>
        </form>
      ) : null}

      {isOwner ? (
        <div className="stack">
          <form className="stack card" onSubmit={saveGroup}>
            <h2>Group settings</h2>
            <label className="field">
              <span>Name</span>
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={80}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <Textarea
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
            <label className="field">
              <span>Group image (JPEG, PNG, or WebP; 5 MB max)</span>
              <input
                ref={avatarInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Save group details
            </Button>
          </form>
          <label className="field">
            <span>Join policy</span>
            <select
              value={joinPolicy}
              onChange={(event) =>
                void changeJoinPolicy(event.target.value as "open" | "approval" | "invite_only")
              }
            >
              <option value="open">Open</option>
              <option value="approval">Approval required</option>
              <option value="invite_only">Invite only</option>
            </select>
          </label>
          <Button type="button" disabled={busy} onClick={() => void deleteGroup()}>
            Delete group
          </Button>
        </div>
      ) : null}
      <Link to="/groups">Back to groups</Link>
    </FeatureFrame>
  );
}

type GroupDirectoryRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "moderator" | "member";
  status: "requested" | "active";
  joined_at: string | null;
};

function GroupDirectoryPage({ requestsOnly = false }: { requestsOnly?: boolean }) {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const enabled = useFeatureFlag("groups_enabled", true);
  const [group, setGroup] = useState<Pick<Group, "id" | "slug" | "name" | "member_count"> | null>(
    null,
  );
  const [viewerRole, setViewerRole] = useState<GroupDirectoryRow["role"] | null>(null);
  const [members, setMembers] = useState<GroupDirectoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(requestsOnly ? "requests" : "all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const pageSize = 30;

  useEffect(() => {
    setFilter(requestsOnly ? "requests" : "all");
    setOffset(0);
    setMembers([]);
  }, [requestsOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!slug || !user) {
      setLoading(false);
      setGroup(null);
      setMembers([]);
      return;
    }
    setLoading(true);
    const { data: groupRow, error: groupError } = await supabase
      .from("groups")
      .select("id,slug,name,member_count")
      .eq("slug", slug)
      .maybeSingle();
    if (groupError || !groupRow) {
      setGroup(null);
      setMembers([]);
      setError(groupError ? friendlyError(groupError) : "This group is unavailable.");
      setLoading(false);
      return;
    }
    setGroup(groupRow);
    const { data: ownRow, error: ownError } = await supabase
      .from("group_members")
      .select("role,status")
      .eq("group_id", groupRow.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownError) {
      setError(friendlyError(ownError));
      setLoading(false);
      return;
    }
    setViewerRole(ownRow?.status === "active" ? (ownRow.role as GroupDirectoryRow["role"]) : null);

    const { data, error: listError } = await supabase.rpc("group_member_directory", {
      p_group_id: groupRow.id,
      p_query: query,
      p_filter: filter,
      p_limit: pageSize,
      p_offset: offset,
    });
    if (listError) {
      setError(friendlyError(listError));
      if (offset === 0) setMembers([]);
      setLoading(false);
      return;
    }
    const nextRows = (data ?? []) as GroupDirectoryRow[];
    setMembers((current) => (offset === 0 ? nextRows : [...current, ...nextRows]));
    setHasMore(nextRows.length === pageSize);
    setError("");
    setLoading(false);
  }, [filter, offset, pageSize, query, slug, user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  async function reviewRequest(member: GroupDirectoryRow, approve: boolean) {
    if (!group || busyId) return;
    setBusyId(member.user_id);
    const { error: actionError } = await supabase.rpc("review_group_member", {
      p_group_id: group.id,
      p_user_id: member.user_id,
      p_approve: approve,
    });
    setBusyId("");
    if (actionError) {
      setError(friendlyError(actionError));
      return;
    }
    await load();
  }

  async function changeRole(member: GroupDirectoryRow, role: "member" | "moderator" | "admin") {
    if (!group || busyId) return;
    setBusyId(member.user_id);
    const { error: actionError } = await supabase.rpc("set_group_member_role", {
      p_group_id: group.id,
      p_user_id: member.user_id,
      p_role: role,
    });
    setBusyId("");
    if (actionError) {
      setError(friendlyError(actionError));
      return;
    }
    setMembers((current) =>
      current.map((row) => (row.user_id === member.user_id ? { ...row, role } : row)),
    );
  }

  async function removeMember(member: GroupDirectoryRow) {
    if (!group || busyId) return;
    setBusyId(member.user_id);
    const { error: actionError } = await supabase.rpc("remove_group_member", {
      p_group_id: group.id,
      p_user_id: member.user_id,
    });
    setBusyId("");
    if (actionError) {
      setError(friendlyError(actionError));
      return;
    }
    setMembers((current) => current.filter((row) => row.user_id !== member.user_id));
    setGroup((current) =>
      current ? { ...current, member_count: Math.max(0, current.member_count - 1) } : current,
    );
  }

  if (authLoading || (loading && !group)) {
    return (
      <FeatureFrame
        eyebrow="GROUPS"
        title={requestsOnly ? "Join requests." : "Members."}
        subtitle="Loading the group directory…"
      >
        <RuntimeLoading label="Loading group members…" />
      </FeatureFrame>
    );
  }
  if (!enabled)
    return (
      <FeatureFrame
        eyebrow="GROUPS"
        title="Group members."
        subtitle="Groups are currently turned off."
      >
        <DisabledNotice name="Groups" />
      </FeatureFrame>
    );
  if (!user)
    return (
      <FeatureFrame
        eyebrow="GROUPS"
        title="Sign in to continue."
        subtitle="Group members are available to members."
      >
        <Link to="/login">Sign in</Link>
      </FeatureFrame>
    );
  if (!group)
    return (
      <FeatureFrame
        eyebrow="GROUPS"
        title="Group unavailable."
        subtitle="This group or directory is not available."
      >
        <Problem message={error || "This group is unavailable."} retry={() => void load()} />
        <Link to="/groups">Browse groups</Link>
      </FeatureFrame>
    );

  const canManageRoles = viewerRole === "owner" || viewerRole === "admin";
  const canModerate = canManageRoles || viewerRole === "moderator";
  const roleRank = { owner: 4, admin: 3, moderator: 2, member: 1 } as const;
  const title = requestsOnly ? "Join requests." : "Members.";
  const visibleMembers = requestsOnly
    ? members.filter((member) => member.status === "requested")
    : members;

  return (
    <FeatureFrame
      eyebrow={group.name}
      title={title}
      subtitle={
        requestsOnly
          ? "Review people who have asked to join."
          : `${group.member_count.toLocaleString()} members in this community.`
      }
      className="group-directory-page"
    >
      <div className="group-directory-toolbar">
        <label className="field">
          <span>{requestsOnly ? "Search requests" : "Search members"}</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or username"
          />
        </label>
        {!requestsOnly ? (
          <label className="field">
            <span>Show</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setOffset(0);
                setMembers([]);
              }}
            >
              <option value="all">Everyone</option>
              <option value="admins">Admins</option>
              <option value="moderators">Moderators</option>
              <option value="recent">Recently joined</option>
            </select>
          </label>
        ) : null}
      </div>
      {error ? <Problem message={error} retry={() => void load()} /> : null}
      {loading ? <RuntimeLoading label="Loading members…" /> : null}
      {!loading && !error && visibleMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={requestsOnly ? "No pending requests" : "No members found"}
          text={
            requestsOnly
              ? "New requests will appear here when someone asks to join."
              : query
                ? "Try another name or username."
                : "This group is ready to welcome its first members."
          }
        />
      ) : (
        <div className="group-directory-list">
          {visibleMembers.map((member) => {
            const canManageTarget =
              viewerRole !== null && roleRank[viewerRole] > roleRank[member.role];
            return (
              <article className="group-member-row" key={member.user_id}>
                <Link
                  className="group-member-identity"
                  to={`/profile/${encodeURIComponent(member.username)}`}
                >
                  <span className="group-member-avatar">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" loading="lazy" />
                    ) : (
                      (member.display_name || member.username).charAt(0).toUpperCase()
                    )}
                  </span>
                  <span>
                    <strong>{member.display_name || member.username}</strong>
                    <small>@{member.username}</small>
                  </span>
                </Link>
                <span className="group-member-role">{member.role}</span>
                {requestsOnly && canModerate ? (
                  <div className="group-member-actions">
                    <Button
                      type="button"
                      disabled={busyId === member.user_id}
                      onClick={() => void reviewRequest(member, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      disabled={busyId === member.user_id}
                      onClick={() => void reviewRequest(member, false)}
                    >
                      Decline
                    </Button>
                  </div>
                ) : !requestsOnly && canModerate && canManageTarget ? (
                  <div className="group-member-actions">
                    {canManageRoles ? (
                      <label>
                        <span className="sr-only">Role for @{member.username}</span>
                        <select
                          value={member.role}
                          disabled={busyId === member.user_id}
                          onChange={(event) =>
                            void changeRole(
                              member,
                              event.target.value as "member" | "moderator" | "admin",
                            )
                          }
                        >
                          <option value="member">Member</option>
                          <option value="moderator">Moderator</option>
                          {viewerRole === "owner" ? <option value="admin">Admin</option> : null}
                        </select>
                      </label>
                    ) : null}
                    <Button
                      type="button"
                      disabled={busyId === member.user_id}
                      onClick={() => void removeMember(member)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {hasMore && !loading ? (
        <Button
          type="button"
          onClick={() => setOffset((current) => current + pageSize)}
          disabled={loading}
        >
          Load more
        </Button>
      ) : null}
      <Link to={`/groups/${group.slug}`}>Back to group</Link>
    </FeatureFrame>
  );
}

export function GroupMembersPage() {
  return <GroupDirectoryPage />;
}

export function GroupRequestsPage() {
  return <GroupDirectoryPage requestsOnly />;
}
