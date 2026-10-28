import { SceneHeading } from "../components/SceneHeading";
import { PageWorkspace } from "../components/PageWorkspace";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  LockKeyhole,
  ShieldCheck,
  UserRoundX,
  VolumeX,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { friendlyError, supabase } from "../lib/supabase";

type PrivacySettingsRecord = {
  profile_id: string;
  searchable: boolean;
  followers_visibility: "everyone" | "followers" | "only_me";
  following_visibility: "everyone" | "followers" | "only_me";
  show_follower_count: boolean;
  show_following_count: boolean;
  show_bio: boolean;
  show_avatar: boolean;
  show_website: boolean;
  show_account_type: boolean;
  default_comment_permission: "everyone" | "followers" | "following" | "nobody";
  mention_permission: "everyone" | "followers" | "following" | "nobody";
  message_permission: "everyone" | "followers" | "following" | "mutuals" | "existing" | "nobody";
  story_reply_permission: "everyone" | "followers" | "close_friends" | "nobody";
  reshare_permission: "everyone" | "followers" | "nobody";
  like_permission: "everyone" | "followers" | "nobody";
  like_list_visibility: "everyone" | "followers" | "nobody";
  show_activity_status: boolean;
  show_online_indicator: boolean;
  show_typing_indicator: boolean;
  show_read_receipts: boolean;
};

type SettingKey = Exclude<keyof PrivacySettingsRecord, "profile_id">;
type SettingValue = PrivacySettingsRecord[SettingKey];

const defaults: Omit<PrivacySettingsRecord, "profile_id"> = {
  searchable: true,
  followers_visibility: "followers",
  following_visibility: "followers",
  show_follower_count: true,
  show_following_count: true,
  show_bio: true,
  show_avatar: true,
  show_website: false,
  show_account_type: true,
  default_comment_permission: "everyone",
  mention_permission: "everyone",
  message_permission: "followers",
  story_reply_permission: "followers",
  reshare_permission: "everyone",
  like_permission: "everyone",
  like_list_visibility: "everyone",
  show_activity_status: true,
  show_online_indicator: true,
  show_typing_indicator: true,
  show_read_receipts: true,
};

function SettingSelect<T extends SettingValue>({
  label,
  detail,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label className="privacy-setting-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const reducedMotion = useInterfaceMotion().reduced;
  return (
    <div className="privacy-setting-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <m.button
        type="button"
        className={`privacy-toggle ${checked ? "is-on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
        transition={
          reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
        }
      >
        <m.span
          animate={{ x: checked ? 18 : 0 }}
          transition={
            reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
          }
        />
      </m.button>
    </div>
  );
}

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reducedMotion = useInterfaceMotion().reduced;
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [onCancel]);
  return (
    <m.div
      className="settings-confirm-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <m.section
        className="settings-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="settings-confirm-title"
        aria-describedby="settings-confirm-description"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{
          opacity: 1,
          scale: 1,
          x: reducedMotion ? 0 : [0, -4, 4, -3, 3, 0],
        }}
        exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : {
                duration: 0.32,
                ease: "easeOut",
                scale: { type: "spring", stiffness: 300, damping: 25 },
              }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <AlertTriangle size={23} aria-hidden="true" />
        <h2 id="settings-confirm-title">{title}</h2>
        <p id="settings-confirm-description">{description}</p>
        <div className="settings-confirm-actions">
          <button type="button" className="button button-outline" onClick={onCancel}>
            Cancel
          </button>
          <m.button
            type="button"
            className="button button-primary settings-confirm-destructive"
            whileTap={reducedMotion ? undefined : { scale: 0.94 }}
            transition={
              reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </m.button>
        </div>
      </m.section>
    </m.div>
  );
}

type SafetyKind = "blocks" | "mutes" | "restrictions" | "story_hides";
type SafetyEntry = { id: string; username: string };

const safetyKinds: { table: SafetyKind; title: string; detail: string; icon: typeof UserRoundX }[] =
  [
    {
      table: "blocks",
      title: "Blocked accounts",
      detail: "Blocked accounts cannot view your profile or contact you.",
      icon: UserRoundX,
    },
    {
      table: "mutes",
      title: "Muted accounts",
      detail: "Hide their stories and notifications from your experience.",
      icon: VolumeX,
    },
    {
      table: "restrictions",
      title: "Restricted accounts",
      detail: "Their messages and comments receive additional limits.",
      icon: EyeOff,
    },
    {
      table: "story_hides",
      title: "Hide stories from",
      detail: "These accounts cannot view your stories or their protected media.",
      icon: EyeOff,
    },
  ];

function SafetyLists({ profileId }: { profileId: string }) {
  const [entries, setEntries] = useState<Record<SafetyKind, SafetyEntry[]>>({
    blocks: [],
    mutes: [],
    restrictions: [],
    story_hides: [],
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [blockTarget, setBlockTarget] = useState<{ id: string; username: string } | null>(null);

  async function reload() {
    const { data, error: listError } = await supabase.rpc("my_safety_lists");
    if (listError) {
      setError(friendlyError(listError));
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as { list_name: SafetyKind; target_id: string; username: string }[];
    setEntries({
      blocks: rows
        .filter((row) => row.list_name === "blocks")
        .map((row) => ({ id: row.target_id, username: row.username })),
      mutes: rows
        .filter((row) => row.list_name === "mutes")
        .map((row) => ({ id: row.target_id, username: row.username })),
      restrictions: rows
        .filter((row) => row.list_name === "restrictions")
        .map((row) => ({ id: row.target_id, username: row.username })),
      story_hides: rows
        .filter((row) => row.list_name === "story_hides")
        .map((row) => ({ id: row.target_id, username: row.username })),
    });
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [profileId]);

  async function update(kind: SafetyKind, targetId: string, remove: boolean, confirmed = false) {
    if (kind === "blocks" && !remove && !confirmed) {
      const target = entries.blocks.find((entry) => entry.id === targetId);
      setBlockTarget({ id: targetId, username: target?.username ?? "this account" });
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const [table, ownerColumn, targetColumn] =
      kind === "blocks"
        ? ["blocks", "blocker_id", "blocked_id"]
        : kind === "mutes"
          ? ["mutes", "muter_id", "muted_id"]
          : kind === "restrictions"
            ? ["restrictions", "restrictor_id", "restricted_id"]
            : ["story_hides", "owner_id", "hidden_profile_id"];
    const database = supabase as any;
    const { error: actionError } = remove
      ? await database.from(table).delete().eq(ownerColumn, profileId).eq(targetColumn, targetId)
      : await database.from(table).insert({ [ownerColumn]: profileId, [targetColumn]: targetId });
    if (actionError) setError(friendlyError(actionError));
    else {
      await reload();
      setNotice(remove ? "Account removed from list." : "Account added to list.");
    }
    setBusy(false);
  }

  async function add(kind: SafetyKind) {
    const username = query.trim().replace(/^@/, "");
    if (!username) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: lookupError } = await supabase.rpc("profile_discovery_by_username", {
      p_username: username,
    });
    const target = data?.[0];
    if (lookupError || !target) {
      setError(
        lookupError
          ? friendlyError(lookupError)
          : "No discoverable account found for that username.",
      );
      setBusy(false);
      return;
    }
    if (target.id === profileId) {
      setError("You cannot add your own account to a safety list.");
      setBusy(false);
      return;
    }
    if (kind === "blocks") {
      setBlockTarget({ id: target.id, username: target.username });
      return;
    }
    await update(kind, target.id, false);
    setQuery("");
  }

  return (
    <section className="privacy-card" aria-labelledby="privacy-safety-heading">
      <h2 id="privacy-safety-heading">
        <ShieldCheck size={18} /> Safety lists
      </h2>
      <p>Manage accounts you have blocked, muted, or restricted.</p>
      <label className="privacy-setting-row">
        <span>
          <strong>Find an account</strong>
          <small>Enter their username, then choose a list.</small>
        </span>
        <input
          value={query}
          disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="@username"
        />
      </label>
      {error ? (
        <p className="inline-feedback" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="inline-feedback" role="status">
          {notice}
        </p>
      ) : null}
      {loading ? <p>Loading safety lists…</p> : null}
      {safetyKinds.map(({ table, title, detail, icon: Icon }) => (
        <div className="privacy-setting-row" key={table}>
          <span>
            <strong>
              <Icon size={16} /> {title}
            </strong>
            <small>{detail}</small>
            {entries[table].length ? (
              <small>
                {entries[table].map((entry) => (
                  <span key={entry.id} className="safety-list-entry">
                    @{entry.username}{" "}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void update(table, entry.id, true)}
                    >
                      Remove
                    </button>
                  </span>
                ))}
              </small>
            ) : (
              <small>No accounts in this list.</small>
            )}
          </span>
          <button
            type="button"
            className="button button-soft"
            disabled={busy || !query.trim()}
            onClick={() => void add(table)}
          >
            Add
          </button>
        </div>
      ))}
      {createPortal(
        <AnimatePresence>
          {blockTarget ? (
            <ConfirmationDialog
              title={`Block @${blockTarget.username}?`}
              description="Blocking removes both follow connections and pending follow requests. They will not be restored if you unblock later."
              confirmLabel="Block account"
              onCancel={() => setBlockTarget(null)}
              onConfirm={() => {
                const target = blockTarget;
                setBlockTarget(null);
                void update("blocks", target.id, false, true);
              }}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  );
}

export function PrivacySettingsPage() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visibilityToConfirm, setVisibilityToConfirm] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const [profileResult, settingsResult] = await Promise.all([
        supabase.from("profiles").select("id,is_private").eq("id", user.id).maybeSingle(),
        supabase.from("account_settings").select("*").eq("profile_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.error) setError(friendlyError(profileResult.error));
      else if (profileResult.data) {
        setProfileId(profileResult.data.id);
        setIsPrivate(profileResult.data.is_private);
      }
      if (settingsResult.error) setError(friendlyError(settingsResult.error));
      else if (settingsResult.data) {
        const row = settingsResult.data as Partial<PrivacySettingsRecord>;
        setSettings({ ...defaults, ...row });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function saveSetting<K extends SettingKey>(key: K, value: PrivacySettingsRecord[K]) {
    if (!profileId || busyKey) return;
    setBusyKey(key);
    setError("");
    setNotice("");
    const { error: saveError } = await supabase
      .from("account_settings")
      .update({ [key]: value })
      .eq("profile_id", profileId);
    if (saveError) setError(friendlyError(saveError));
    else {
      setSettings((current) => ({ ...current, [key]: value }));
      setNotice("Privacy setting saved.");
    }
    setBusyKey(null);
  }

  async function changeVisibility(nextPrivate: boolean) {
    if (!profileId || busyKey || nextPrivate === isPrivate) return;
    setBusyKey("is_private");
    setError("");
    setNotice("");
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ is_private: nextPrivate })
      .eq("id", profileId);
    if (saveError) setError(friendlyError(saveError));
    else {
      setIsPrivate(nextPrivate);
      setNotice(`Your account is now ${nextPrivate ? "private" : "public"}.`);
    }
    setBusyKey(null);
  }

  const pending = loading || busyKey !== null;
  const confirmVisibility = visibilityToConfirm;
  const set = <K extends SettingKey>(key: K, value: PrivacySettingsRecord[K]) =>
    void saveSetting(key, value);
  const all = [
    { value: "everyone", label: "Everyone" },
    { value: "followers", label: "Approved followers" },
    { value: "following", label: "People I follow" },
    { value: "nobody", label: "Nobody" },
  ] as const;
  const visibility = [
    { value: "everyone", label: "Everyone" },
    { value: "followers", label: "Approved followers" },
    { value: "only_me", label: "Only me" },
  ] as const;
  const storyReplies = [
    { value: "everyone", label: "Everyone who can view" },
    { value: "followers", label: "Approved followers" },
    { value: "close_friends", label: "Close friends" },
    { value: "nobody", label: "Nobody" },
  ] as const;
  const reshare = [
    { value: "everyone", label: "Everyone who can view" },
    { value: "followers", label: "Approved followers" },
    { value: "nobody", label: "Nobody" },
  ] as const;
  const messageOptions = [
    { value: "everyone", label: "Everyone" },
    { value: "followers", label: "Approved followers" },
    { value: "following", label: "People I follow" },
    { value: "mutuals", label: "Mutual connections" },
    { value: "existing", label: "Existing conversations only" },
    { value: "nobody", label: "Nobody" },
  ] as const;

  return (
    <PageWorkspace area="settings" className="privacy-page">
      <Link to="/settings" className="button button-soft privacy-back">
        <ArrowLeft size={16} /> Settings
      </Link>
      <SceneHeading
        eyebrow="YOUR SPACE, YOUR WAY"
        title="Privacy & safety"
        subtitle="Choose what people can discover and how they connect with you."
      />
      {!user ? <p>Please sign in to manage privacy settings.</p> : null}
      {error ? (
        <p className="inline-feedback" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="inline-feedback" role="status">
          {notice}
        </p>
      ) : null}
      {loading ? <div className="skeleton-card" aria-label="Loading privacy settings" /> : null}
      {!loading && user ? (
        <>
          <section className="privacy-card" aria-labelledby="privacy-account-heading">
            <h2 id="privacy-account-heading">
              <LockKeyhole size={18} /> Account visibility
            </h2>
            <p>
              Private accounts require approval for new followers. Existing approved followers keep
              access.
            </p>
            <div className="privacy-visibility-options">
              <button
                type="button"
                disabled={pending}
                aria-pressed={!isPrivate}
                onClick={() => setVisibilityToConfirm(false)}
              >
                Public <small>Anyone can see content you share publicly.</small>
              </button>
              <button
                type="button"
                disabled={pending}
                aria-pressed={isPrivate}
                onClick={() => setVisibilityToConfirm(true)}
              >
                Private <small>Only approved followers can see follower-only content.</small>
              </button>
            </div>
          </section>
          <section className="privacy-card" aria-labelledby="privacy-discovery-heading">
            <h2 id="privacy-discovery-heading">
              <ShieldCheck size={18} /> Profile & discovery
            </h2>
            <ToggleRow
              label="Search discoverability"
              detail="Allow your profile to appear in people search."
              checked={settings.searchable}
              disabled={pending}
              onChange={(value) => set("searchable", value)}
            />
            <ToggleRow
              label="Show profile photo"
              detail="Include your profile photo in discoverable profile previews."
              checked={settings.show_avatar}
              disabled={pending}
              onChange={(value) => set("show_avatar", value)}
            />
            <ToggleRow
              label="Show bio"
              detail="Include your bio in discoverable profile previews."
              checked={settings.show_bio}
              disabled={pending}
              onChange={(value) => set("show_bio", value)}
            />
            <ToggleRow
              label="Show website"
              detail="Show your website and profile link."
              checked={settings.show_website}
              disabled={pending}
              onChange={(value) => set("show_website", value)}
            />
            <ToggleRow
              label="Show account category"
              detail="Show whether your profile is personal, creator, or business."
              checked={settings.show_account_type}
              disabled={pending}
              onChange={(value) => set("show_account_type", value)}
            />
          </section>
          <section className="privacy-card" aria-labelledby="privacy-connections-heading">
            <h2 id="privacy-connections-heading">Followers & following</h2>
            <SettingSelect
              label="Who can see your followers?"
              detail="Controls access to your follower list."
              value={settings.followers_visibility}
              options={visibility}
              disabled={pending}
              onChange={(value) => set("followers_visibility", value)}
            />
            <SettingSelect
              label="Who can see who you follow?"
              detail="Controls access to your following list."
              value={settings.following_visibility}
              options={visibility}
              disabled={pending}
              onChange={(value) => set("following_visibility", value)}
            />
            <ToggleRow
              label="Show follower count"
              detail="Display the number of approved followers."
              checked={settings.show_follower_count}
              disabled={pending}
              onChange={(value) => set("show_follower_count", value)}
            />
            <ToggleRow
              label="Show following count"
              detail="Display how many accounts you follow."
              checked={settings.show_following_count}
              disabled={pending}
              onChange={(value) => set("show_following_count", value)}
            />
          </section>
          <section className="privacy-card" aria-labelledby="privacy-interactions-heading">
            <h2 id="privacy-interactions-heading">Interactions</h2>
            <SettingSelect
              label="Who can comment?"
              detail="Applies as the default on your posts and reels."
              value={settings.default_comment_permission}
              options={all}
              disabled={pending}
              onChange={(value) => set("default_comment_permission", value)}
            />
            <SettingSelect
              label="Who can like your content?"
              detail="Applies when likes are enabled for a post, reel, or story."
              value={settings.like_permission}
              options={reshare}
              disabled={pending}
              onChange={(value) => set("like_permission", value)}
            />
            <SettingSelect
              label="Who can see who liked your content?"
              detail="Like lists stay available to you and people allowed by this setting."
              value={settings.like_list_visibility}
              options={reshare}
              disabled={pending}
              onChange={(value) => set("like_list_visibility", value)}
            />
            <SettingSelect
              label="Who can mention you?"
              detail="Mentions must follow this setting."
              value={settings.mention_permission}
              options={all}
              disabled={pending}
              onChange={(value) => set("mention_permission", value)}
            />
            <SettingSelect
              label="Who can message you?"
              detail="Messaging permission is independent from account visibility."
              value={settings.message_permission}
              options={messageOptions}
              disabled={pending}
              onChange={(value) => set("message_permission", value)}
            />
            <SettingSelect
              label="Who can reply to your stories?"
              detail="Limits replies from people who can see a story."
              value={settings.story_reply_permission}
              options={storyReplies}
              disabled={pending}
              onChange={(value) => set("story_reply_permission", value)}
            />
            <SettingSelect
              label="Who can reshare your content?"
              detail="Controls resharing where the feature is available."
              value={settings.reshare_permission}
              options={reshare}
              disabled={pending}
              onChange={(value) => set("reshare_permission", value)}
            />
          </section>
          <section className="privacy-card" aria-labelledby="privacy-activity-heading">
            <h2 id="privacy-activity-heading">Activity & receipts</h2>
            <ToggleRow
              label="Show activity status"
              detail="Let eligible people know when you have been active."
              checked={settings.show_activity_status}
              disabled={pending}
              onChange={(value) => set("show_activity_status", value)}
            />
            <ToggleRow
              label="Show online indicator"
              detail="Show when you are currently online."
              checked={settings.show_online_indicator}
              disabled={pending}
              onChange={(value) => set("show_online_indicator", value)}
            />
            <ToggleRow
              label="Show typing indicator"
              detail="Let conversation members see when you are typing."
              checked={settings.show_typing_indicator}
              disabled={pending}
              onChange={(value) => set("show_typing_indicator", value)}
            />
            <ToggleRow
              label="Send read receipts"
              detail="Let people know when you have read their message."
              checked={settings.show_read_receipts}
              disabled={pending}
              onChange={(value) => set("show_read_receipts", value)}
            />
          </section>
          <SafetyLists profileId={profileId} />
          <p className="privacy-footnote">
            Your settings are enforced by your account and content access rules.
          </p>
        </>
      ) : null}
      {createPortal(
        <AnimatePresence>
          {confirmVisibility !== null ? (
            <ConfirmationDialog
              title={`Make your account ${confirmVisibility ? "private" : "public"}?`}
              description={
                confirmVisibility
                  ? "New followers will need your approval to view follower-only content."
                  : "People can access your content according to its visibility settings."
              }
              confirmLabel={confirmVisibility ? "Make private" : "Make public"}
              onCancel={() => setVisibilityToConfirm(null)}
              onConfirm={() => {
                const nextPrivate = confirmVisibility;
                setVisibilityToConfirm(null);
                void changeVisibility(nextPrivate);
              }}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </PageWorkspace>
  );
}

export default PrivacySettingsPage;
