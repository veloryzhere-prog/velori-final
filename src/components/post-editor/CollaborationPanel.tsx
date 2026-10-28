import { useCallback, useEffect, useMemo, useState } from "react";
import "./CollaborationPanel.css";
import type { User } from "@supabase/supabase-js";
import type { PostDraftChannel } from "../../lib/post-editor/collab";
import {
  Activity,
  Check,
  Clock3,
  Copy,
  History,
  MessageSquare,
  Send,
  Users,
  X,
} from "lucide-react";
import { supabase, type Profile } from "../../lib/supabase";
import {
  flattenDraftPresence,
  subscribeToPostDraftCollaboration,
} from "../../lib/post-editor/collab";
import type { DraftMediaRecord } from "../../lib/post-media";

type Role = "admin" | "editor" | "reviewer" | "approver" | "viewer" | "client";
type DraftRecord = {
  id: string;
  author_id: string;
  body: string;
  collaboration_status: string;
  version_number: number;
};
type CommentRecord = {
  id: string;
  author_id: string;
  body: string;
  anchor: { type?: string; mediaId?: string };
  resolved_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "display_name" | "username">;
};
type VersionRecord = {
  id: string;
  version_number: number;
  name: string;
  body: string;
  author_id: string | null;
  created_at: string;
};
type ActivityRecord = {
  id: number;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor_name?: string;
};
type SuggestionRecord = {
  id: string;
  author_id: string;
  proposed_body: string;
  reason: string;
  status: string;
  created_at: string;
};

const ROLES: Role[] = ["admin", "editor", "reviewer", "approver", "viewer", "client"];
const FLOW = ["draft", "in_review", "approved", "scheduled", "published"];

export function CollaborationPanel({
  draftId,
  user,
  body,
  media,
  onRestoreVersion,
  onRemoteDraft,
  onCursor,
  onChannel,
  onRole,
  ownerFallback = false,
}: {
  draftId: string;
  user: User;
  body: string;
  media: DraftMediaRecord[];
  onRestoreVersion: (body: string) => void;
  onRemoteDraft: (draft: DraftRecord) => void;
  onCursor: (cursor: {
    user_id: string;
    display_name: string;
    color: string;
    x: number;
    y: number;
  }) => void;
  onChannel: (channel: PostDraftChannel) => void;
  onRole: (role: Role | "owner") => void;
  ownerFallback?: boolean;
}) {
  const [presence, setPresence] = useState<Record<string, unknown>[]>([]);
  const [connection, setConnection] = useState("Connecting");
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [collabNotifications, setCollabNotifications] = useState<
    Array<{ id: number; kind: string; message: string; created_at: string }>
  >([]);
  const [shareLinks, setShareLinks] = useState<
    Array<{ id: string; role: string; expires_at: string; revoked_at: string | null }>
  >([]);
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [members, setMembers] = useState<
    Array<{ user_id: string; role: Role; profile?: Pick<Profile, "display_name" | "username"> }>
  >([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [scheduledFor, setScheduledFor] = useState("");
  const [comment, setComment] = useState("");
  const [anchor, setAnchor] = useState("canvas");
  const [suggestedBody, setSuggestedBody] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("editor");
  const [shareRole, setShareRole] = useState<"viewer" | "editor" | "client">("viewer");
  const [shareUrl, setShareUrl] = useState("");
  const [versionName, setVersionName] = useState("");
  const [versionPair, setVersionPair] = useState<[string, string] | null>(null);
  const [message, setMessage] = useState("");
  const displayName = String(user.user_metadata?.display_name || user.email || "Collaborator");
  const currentRole = members.find((member) => member.user_id === user.id)?.role;
  const isOwner = ownerId === user.id || ownerFallback;
  const canEdit = isOwner || currentRole === "admin" || currentRole === "editor";
  const canReview =
    isOwner ||
    (currentRole
      ? ["admin", "editor", "reviewer", "approver", "client"].includes(currentRole)
      : false);
  const canManage = isOwner || currentRole === "admin";

  useEffect(() => {
    if (membersLoaded) onRole(isOwner ? "owner" : currentRole || "viewer");
  }, [currentRole, isOwner, membersLoaded, onRole]);

  const loadCollaboration = useCallback(async () => {
    const [
      commentResult,
      versionResult,
      activityResult,
      suggestionResult,
      memberResult,
      draftResult,
      notificationResult,
      shareResult,
    ] = await Promise.all([
      supabase
        .from("post_draft_comments")
        .select(
          "id,author_id,body,anchor,resolved_at,created_at,profiles!post_draft_comments_author_id_fkey(display_name,username)",
        )
        .eq("draft_id", draftId)
        .order("created_at", { ascending: true }),
      supabase
        .from("post_draft_versions")
        .select("id,version_number,name,body,author_id,created_at")
        .eq("draft_id", draftId)
        .order("version_number", { ascending: false })
        .limit(30),
      supabase
        .from("post_draft_activity")
        .select("id,action,detail,created_at,actor_id")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("post_draft_suggestions")
        .select("id,author_id,proposed_body,reason,status,created_at")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: false }),
      supabase.from("post_draft_collaborators").select("user_id,role").eq("draft_id", draftId),
      supabase
        .from("post_drafts")
        .select("author_id,collaboration_status,scheduled_at")
        .eq("id", draftId)
        .maybeSingle(),
      supabase
        .from("post_draft_notifications")
        .select("id,kind,message,created_at")
        .eq("draft_id", draftId)
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("post_draft_share_links")
        .select("id,role,expires_at,revoked_at")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (commentResult.data) setComments(commentResult.data as unknown as CommentRecord[]);
    if (versionResult.data) setVersions(versionResult.data as VersionRecord[]);
    if (activityResult.data) {
      const rows = activityResult.data as ActivityRecord[];
      const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
      const actorProfiles = actorIds.length
        ? await supabase.from("profiles").select("id,display_name,username").in("id", actorIds)
        : { data: [] };
      setActivity(
        rows.map((row) => ({
          ...row,
          actor_name:
            actorProfiles.data?.find((profile) => profile.id === row.actor_id)?.display_name ||
            "A collaborator",
        })),
      );
    }
    if (suggestionResult.data) setSuggestions(suggestionResult.data as SuggestionRecord[]);
    if (notificationResult.data) setCollabNotifications(notificationResult.data);
    if (shareResult.data) setShareLinks(shareResult.data);
    if (memberResult.data) {
      const memberRows = memberResult.data as Array<{ user_id: string; role: Role }>;
      const profileResult = memberRows.length
        ? await supabase
            .from("profiles")
            .select("id,display_name,username")
            .in(
              "id",
              memberRows.map((row) => row.user_id),
            )
        : { data: [] };
      setMembers(
        memberRows.map((row) => ({
          ...row,
          profile: profileResult.data?.find((profile) => profile.id === row.user_id),
        })),
      );
    }
    setMembersLoaded(true);
    if (draftResult.data?.author_id) setOwnerId(draftResult.data.author_id);
    if (draftResult.data?.collaboration_status) setStatus(draftResult.data.collaboration_status);
    if (draftResult.data?.scheduled_at) {
      const localDate = new Date(draftResult.data.scheduled_at);
      localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
      setScheduledFor(localDate.toISOString().slice(0, 16));
    }
    const errorResult = [
      commentResult,
      versionResult,
      activityResult,
      suggestionResult,
      memberResult,
      draftResult,
      notificationResult,
      shareResult,
    ].find((result) => result.error);
    if (errorResult?.error) setMessage(errorResult.error.message);
  }, [draftId, user.id]);

  useEffect(() => {
    void loadCollaboration();
    return subscribeToPostDraftCollaboration({
      client: supabase,
      draftId,
      user: { id: user.id, displayName },
      onPresence: (state) => setPresence(flattenDraftPresence(state)),
      onDraftChange: (draft) => {
        setStatus(draft.collaboration_status);
        onRemoteDraft(draft);
      },
      onCommentChange: () => void loadCollaboration(),
      onSuggestionChange: () => void loadCollaboration(),
      onActivityChange: () => void loadCollaboration(),
      onCursor,
      onChannel,
      onStatus: (value) => setConnection(value === "SUBSCRIBED" ? "Live" : value),
    });
  }, [draftId, user.id, displayName, loadCollaboration, onRemoteDraft, onCursor, onChannel]);

  async function addComment() {
    if (!comment.trim()) return;
    const anchorValue =
      anchor === "canvas" ? { type: "canvas" } : { type: "media", mediaId: anchor };
    const { error } = await supabase
      .from("post_draft_comments")
      .insert({ draft_id: draftId, author_id: user.id, body: comment.trim(), anchor: anchorValue });
    if (error) setMessage(error.message);
    else {
      setComment("");
      setMessage("Comment added.");
      void loadCollaboration();
    }
  }

  async function addSuggestion() {
    if (!suggestedBody.trim()) return;
    const { error } = await supabase.from("post_draft_suggestions").insert({
      draft_id: draftId,
      author_id: user.id,
      proposed_body: suggestedBody,
      reason: suggestionReason.trim(),
    });
    if (error) setMessage(error.message);
    else {
      setSuggestedBody("");
      setSuggestionReason("");
      setMessage("Suggested edit shared with the creator.");
      void loadCollaboration();
    }
  }

  async function decideSuggestion(item: SuggestionRecord, decision: "accepted" | "rejected") {
    const { error } = await supabase
      .from("post_draft_suggestions")
      .update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) setMessage(error.message);
    else {
      if (decision === "accepted") onRestoreVersion(item.proposed_body);
      setMessage(
        decision === "accepted"
          ? "Suggested edit accepted. Save the draft to create a version."
          : "Suggested edit rejected.",
      );
      void loadCollaboration();
    }
  }

  async function restoreVersion(version: VersionRecord) {
    const { error } = await supabase
      .from("post_drafts")
      .update({ body: version.body, updated_at: new Date().toISOString() })
      .eq("id", draftId);
    if (error) setMessage(error.message);
    else {
      onRestoreVersion(version.body);
      setMessage(
        `Restored version ${version.version_number}; a new version is created when saved.`,
      );
      void loadCollaboration();
    }
  }

  async function renameVersion(version: VersionRecord) {
    if (!versionName.trim()) return;
    const { error } = await supabase
      .from("post_draft_versions")
      .update({ name: versionName.trim() })
      .eq("id", version.id);
    if (error) setMessage(error.message);
    else {
      setVersionName("");
      void loadCollaboration();
    }
  }

  async function addMember() {
    const { data: profile, error: findError } = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .eq("username", memberName.trim().replace(/^@/, "").toLowerCase())
      .maybeSingle();
    if (findError || !profile) {
      setMessage(findError?.message || "No profile found for that username.");
      return;
    }
    const { error } = await supabase
      .from("post_draft_collaborators")
      .upsert({ draft_id: draftId, user_id: profile.id, role: memberRole, invited_by: user.id });
    if (error) setMessage(error.message);
    else {
      setMemberName("");
      setMessage(`${profile.display_name || profile.username} added as ${memberRole}.`);
      void loadCollaboration();
    }
  }

  async function updateMemberRole(id: string, role: Role) {
    const { error } = await supabase
      .from("post_draft_collaborators")
      .update({ role })
      .eq("draft_id", draftId)
      .eq("user_id", id);
    if (error) setMessage(error.message);
    else void loadCollaboration();
  }

  async function shareDraft() {
    const { data: token, error } = await supabase.rpc("create_post_draft_share", {
      target_draft: draftId,
      share_role: shareRole,
    });
    if (error || !token) {
      setMessage(error?.message || "Could not create a share link.");
      return;
    }
    const url = new URL("/create", window.location.origin);
    url.searchParams.set("draft", draftId);
    url.searchParams.set("invite", token);
    setShareUrl(url.toString());
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setMessage("Authenticated collaboration link copied. It expires in seven days.");
  }

  async function revokeShare(id: string) {
    const { error } = await supabase
      .from("post_draft_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setMessage(error.message);
    else {
      setMessage("Share link revoked.");
      void loadCollaboration();
    }
  }

  async function markNotificationRead(id: number) {
    const { error } = await supabase
      .from("post_draft_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setMessage(error.message);
    else setCollabNotifications((items) => items.filter((item) => item.id !== id));
  }

  async function transition(next: string) {
    if (next === "scheduled" && (!scheduledFor || Date.parse(scheduledFor) <= Date.now())) {
      setMessage("Choose a future date and time before scheduling.");
      return;
    }
    const { error } = await supabase.rpc("set_post_draft_collaboration_status", {
      target_draft: draftId,
      next_status: next,
      schedule_for: next === "scheduled" ? new Date(scheduledFor).toISOString() : null,
    });
    if (error) setMessage(error.message);
    else {
      setStatus(next);
      setMessage(`Workflow moved to ${next.replace("_", " ")}.`);
      void loadCollaboration();
    }
  }

  const selectedPair = useMemo(
    () =>
      versionPair?.map((id) => versions.find((version) => version.id === id)).filter(Boolean) as
        | VersionRecord[]
        | undefined,
    [versionPair, versions],
  );
  const displayActivity = (record: ActivityRecord) => record.action.replace(/_/g, " ");

  return (
    <section className="post-collaboration" aria-label="Post collaboration">
      <header className="post-collaboration-heading">
        <div>
          <span className="post-collaboration-kicker">Collaborate</span>
          <h2>Review room</h2>
        </div>
        <span className={`post-collaboration-live ${connection === "Live" ? "is-live" : ""}`}>
          <i /> {connection}
        </span>
      </header>

      <section className="post-collab-block">
        <h3>
          <Users size={16} /> In this draft <span>{members.length + 1}</span>
        </h3>
        <div className="post-collab-presence">
          {presence.map((entry, index) => (
            <span
              className="post-collab-person"
              key={`${String(entry.user_id)}-${index}`}
              title={String(entry.display_name)}
            >
              <b>
                {String(entry.display_name || "?")
                  .slice(0, 1)
                  .toUpperCase()}
              </b>
              {String(entry.display_name || "Collaborator")}
            </span>
          ))}
        </div>
        <div className="post-collab-members">
          <p>
            <strong>You</strong>
            <small>Owner / active editor</small>
          </p>
          {members.map((member) => (
            <div className="post-collab-member" key={member.user_id}>
              <p>
                <strong>
                  {member.profile?.display_name || member.profile?.username || "Member"}
                </strong>
                <small>@{member.profile?.username}</small>
              </p>
              {canManage ? (
                <div className="post-collab-member-actions">
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void updateMemberRole(member.user_id, event.target.value as Role)
                    }
                    aria-label={`Role for ${member.profile?.username || "member"}`}
                  >
                    {ROLES.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("post_draft_collaborators")
                        .delete()
                        .eq("draft_id", draftId)
                        .eq("user_id", member.user_id);
                      if (error) setMessage(error.message);
                      else {
                        setMessage("Collaborator removed.");
                        void loadCollaboration();
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span>{member.role}</span>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <div className="post-collab-invite">
            <input
              aria-label="Collaborator username"
              placeholder="Add by username"
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
            />
            <select
              value={memberRole}
              onChange={(event) => setMemberRole(event.target.value as Role)}
              aria-label="New collaborator role"
            >
              {ROLES.filter((role) => role !== "admin").map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <button type="button" onClick={() => void addMember()} disabled={!memberName.trim()}>
              <Users size={14} /> Add
            </button>
          </div>
        )}
      </section>

      <section className="post-collab-block">
        <h3>
          <Activity size={16} /> Approval workflow
        </h3>
        <div className="post-collab-flow">
          {FLOW.map((step, index) => (
            <span className={FLOW.indexOf(status) >= index ? "is-done" : ""} key={step}>
              {step.replace("_", " ")}
            </span>
          ))}
        </div>
        {status === "scheduled" && (
          <p className="post-collab-empty">
            Scheduled for {new Date(scheduledFor || Date.now()).toLocaleString()}.
          </p>
        )}
        <label className="post-collab-select-label">
          Move workflow
          <select
            value={status}
            onChange={(event) => void transition(event.target.value)}
            disabled={
              !!currentRole && !["admin", "editor", "reviewer", "approver"].includes(currentRole)
            }
          >
            {FLOW.filter((step) => step !== "published").map((step) => (
              <option key={step} value={step}>
                {step.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {status !== "scheduled" && (
          <label className="post-collab-select-label">
            Schedule time
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </label>
        )}
      </section>

      <section className="post-collab-block">
        <h3>
          <MessageSquare size={16} /> Pinned comments{" "}
          <span>{comments.filter((item) => !item.resolved_at).length}</span>
        </h3>
        <div className="post-collab-comment-form">
          <label>
            Pin to
            <select value={anchor} onChange={(event) => setAnchor(event.target.value)}>
              <option value="canvas">Canvas / caption</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  Media {item.position + 1}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            placeholder="Add feedback. Mention a teammate with @username."
            aria-label="Add a pinned comment"
          />
          <button
            type="button"
            onClick={() => void addComment()}
            disabled={!comment.trim() || !canReview}
          >
            <Send size={14} /> Comment
          </button>
        </div>
        <div className="post-collab-comments">
          {comments.map((item) => (
            <article
              className={`post-collab-comment${item.resolved_at ? " is-resolved" : ""}`}
              key={item.id}
            >
              <div>
                <strong>{item.profiles?.display_name || "Collaborator"}</strong>
                <small>
                  {item.anchor?.type === "media"
                    ? `Pinned to media ${media.find((asset) => asset.id === item.anchor?.mediaId)?.position ?? ""}`
                    : "Pinned to canvas"}{" "}
                  · {new Date(item.created_at).toLocaleString()}
                </small>
              </div>
              <p>{item.body}</p>
              {!item.resolved_at && canReview && (
                <button
                  type="button"
                  aria-label="Resolve comment"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("post_draft_comments")
                      .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
                      .eq("id", item.id);
                    if (error) setMessage(error.message);
                    else void loadCollaboration();
                  }}
                >
                  <Check size={14} /> Resolve
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="post-collab-block">
        <h3>
          <MessageSquare size={16} /> Suggested edits
        </h3>
        {canReview && (
          <div className="post-collab-comment-form">
            <textarea
              value={suggestedBody}
              onChange={(event) => setSuggestedBody(event.target.value)}
              maxLength={2000}
              placeholder="Suggest revised post copy"
              aria-label="Suggested post text"
            />
            <input
              value={suggestionReason}
              onChange={(event) => setSuggestionReason(event.target.value)}
              maxLength={1000}
              placeholder="Reason (optional)"
              aria-label="Suggestion reason"
            />
            <button
              type="button"
              onClick={() => void addSuggestion()}
              disabled={!suggestedBody.trim()}
            >
              <Send size={14} /> Suggest edit
            </button>
          </div>
        )}
        {suggestions.map((item) => (
          <article className="post-collab-suggestion" key={item.id}>
            <span className={`post-collab-status status-${item.status}`}>{item.status}</span>
            <p>{item.proposed_body}</p>
            {item.reason && <small>{item.reason}</small>}
            {item.status === "pending" && canEdit && (
              <div>
                <button type="button" onClick={() => void decideSuggestion(item, "accepted")}>
                  <Check size={14} /> Accept
                </button>
                <button type="button" onClick={() => void decideSuggestion(item, "rejected")}>
                  <X size={14} /> Reject
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="post-collab-block">
        <h3>
          <History size={16} /> Version history <span>{versions.length}</span>
        </h3>
        <div className="post-collab-version-name">
          <input
            placeholder="Name the latest version"
            aria-label="Version name"
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
          />
          <button
            type="button"
            onClick={() => versions[0] && void renameVersion(versions[0])}
            disabled={!versions.length || !versionName.trim()}
          >
            Name version
          </button>
        </div>
        <div className="post-collab-versions">
          {versions.map((version) => (
            <article key={version.id}>
              <div>
                <strong>{version.name || `Version ${version.version_number}`}</strong>
                <small>
                  v{version.version_number} · {new Date(version.created_at).toLocaleString()}
                </small>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={versionPair?.includes(version.id) || false}
                  onChange={(event) =>
                    setVersionPair((pair) =>
                      event.target.checked
                        ? pair
                          ? pair[0] === version.id
                            ? [version.id, pair[1]]
                            : [pair[1], version.id]
                          : [version.id, version.id]
                        : pair
                          ? (pair.filter((id) => id !== version.id) as unknown as [string, string])
                          : null,
                    )
                  }
                />{" "}
                Compare
              </label>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => void restoreVersion(version)}
              >
                Restore
              </button>
            </article>
          ))}
        </div>
        {selectedPair && selectedPair.length === 2 && (
          <div className="post-collab-compare">
            <div>
              <b>{selectedPair[0].name || `Version ${selectedPair[0].version_number}`}</b>
              <p>{selectedPair[0].body || "(empty draft)"}</p>
            </div>
            <div>
              <b>{selectedPair[1].name || `Version ${selectedPair[1].version_number}`}</b>
              <p>{selectedPair[1].body || "(empty draft)"}</p>
            </div>
          </div>
        )}
      </section>

      {canManage && (
        <section className="post-collab-block">
          <h3>
            <Copy size={16} /> Share link
          </h3>
          <div className="post-collab-invite">
            <select
              value={shareRole}
              onChange={(event) => setShareRole(event.target.value as typeof shareRole)}
              aria-label="Share permission"
            >
              <option value="viewer">Read only</option>
              <option value="editor">Can edit</option>
              <option value="client">Client review</option>
            </select>
            <button type="button" onClick={() => void shareDraft()}>
              Create 7-day link
            </button>
          </div>
          {shareUrl && (
            <div className="post-collab-share-url">
              <input readOnly value={shareUrl} aria-label="Collaboration share link" />
              <button type="button" onClick={() => void copyShareUrl()}>
                <Copy size={14} /> Copy
              </button>
            </div>
          )}
          {shareLinks.map((link) => (
            <div className="post-collab-share-row" key={link.id}>
              <span>
                {link.role} · expires {new Date(link.expires_at).toLocaleDateString()}
              </span>
              {link.revoked_at ? (
                <small>Revoked</small>
              ) : (
                <button type="button" onClick={() => void revokeShare(link.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))}
          <small>
            Recipients must sign in to accept the link. Revocation and expiry are enforced by the
            database.
          </small>
        </section>
      )}

      <section className="post-collab-block">
        <h3>
          <Clock3 size={16} /> Activity log
        </h3>
        <div className="post-collab-activity">
          {activity.map((item) => (
            <p key={item.id}>
              <i />{" "}
              <span>
                <b>{item.actor_name}</b> {displayActivity(item)}
                {item.detail?.version ? ` · version ${item.detail.version}` : ""}
              </span>
              <time>{new Date(item.created_at).toLocaleString()}</time>
            </p>
          ))}
        </div>
        <small>
          Email and Slack delivery require server integrations that are not configured in this
          project.
        </small>
      </section>
      <section className="post-collab-block">
        <h3>
          <Activity size={16} /> In-app alerts <span>{collabNotifications.length}</span>
        </h3>
        {collabNotifications.length ? (
          <div className="post-collab-alerts">
            {collabNotifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void markNotificationRead(item.id)}
              >
                <b>{item.kind}</b>
                <span>{item.message}</span>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="post-collab-empty">No collaboration alerts.</p>
        )}
      </section>
      {message && (
        <p className="post-collab-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
