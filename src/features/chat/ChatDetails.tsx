import { AccountChatSettings } from "./AccountChatSettings";
import { MutualConnections } from "../../components/MutualConnections";
import { useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Pin,
  Archive,
  ShieldCheck,
  Palette,
  Users,
  Image,
  Film,
  FileText,
  ArrowUpRight,
  Flag,
  Search,
  EyeOff,
} from "lucide-react";
import { Dialog } from "../../components/ui";
import { SharedChatContent } from "./SharedChatContent";
import { containsBlockedLanguage, type ChatPreferences } from "./policy.mjs";
type Person = { id: string; username: string; display_name: string; avatar_url: string | null };
type Props = {
  conversationId: string;
  title: string;
  kind: string;
  people: Person[];
  userId: string;
  preferences: ChatPreferences;
  update: (patch: Partial<ChatPreferences>) => boolean;
  syncStatus: string;
  onRetrySync: () => void;
  muted: boolean;
  pinned: boolean;
  busy: boolean;
  notice: string;
  onAction: (action: "mute" | "pin" | "archive" | "unread") => void;
  onBlock: (person: Person) => void;
  onReport: () => void;
  onAvatar: (person: Person) => void;
  onSearch: () => void;
  onClose: () => void;
  initialTab?: string;
};
export function ChatDetails(props: Props) {
  const { preferences, update } = props;
  const [tab, setTab] = useState(props.initialTab || "details"),
    [nicknames, setNicknames] = useState(preferences.nicknames),
    [feedback, setFeedback] = useState("");
  const tabs = [
    ["details", "Details"],
    ["media", "Media"],
    ["reels", "Reels"],
    ["files", "Files"],
    ["members", "People"],
    ["settings", "Settings"],
  ];
  const saveNames = () => {
    if (preferences.childMode && Object.values(nicknames).some(containsBlockedLanguage)) {
      setFeedback("Child Mode: choose a nickname without blocked language.");
      return;
    }
    if (update({ nicknames })) setFeedback("Nicknames saved on this device.");
  };
  return (
    <Dialog
      open
      title="Your VELORI circle"
      description={props.title}
      onClose={props.onClose}
      className="chat-details-dialog"
    >
      <div className="chat-details-cover">
        <span className="chat-detail-brand">
          velori<span>✦</span>
        </span>
        <h3>{props.title}</h3>
        <p>
          {props.kind === "group" ? "A shared conversation" : "A little closer, a little more you."}
        </p>
      </div>
      <div className="chat-details-tabs" role="group" aria-label="Conversation details">
        {tabs.map(([key, label]) => (
          <button type="button" key={key} aria-pressed={key === tab} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "details" ? (
        <>
          {props.kind === "direct" && props.people.find((p) => p.id !== props.userId) ? (
            <MutualConnections profileId={props.people.find((p) => p.id !== props.userId)!.id} />
          ) : null}
          <div className="chat-detail-shortcuts">
            <button onClick={props.onSearch}>
              <Search />
              Search chat
            </button>
            <button disabled={props.busy} onClick={() => props.onAction("mute")}>
              <Bell />
              {props.muted ? "Unmute" : "Mute"}
            </button>
            <button disabled={props.busy} onClick={() => props.onAction("pin")}>
              <Pin />
              {props.pinned ? "Unpin" : "Pin chat"}
            </button>
          </div>
          <button className="chat-child-feature" onClick={() => setTab("settings")}>
            <ShieldCheck size={26} />
            <span>
              <strong>Child Mode</strong>
              <small>
                {preferences.childMode
                  ? "On · text filtering on this device"
                  : "A kinder space starts with words"}
              </small>
            </span>
            <b>{preferences.childMode ? "ON" : "SET UP"}</b>
          </button>
          <div className="chat-detail-rows">
            <button onClick={() => setTab("media")}>
              <Image />
              Shared photos & videos
              <ArrowUpRight />
            </button>
            <button onClick={() => setTab("reels")}>
              <Film />
              Reels shared here
              <ArrowUpRight />
            </button>
            <button onClick={() => setTab("members")}>
              <Users />
              People & profiles
              <ArrowUpRight />
            </button>
            <button onClick={() => setTab("settings")}>
              <Palette />
              Personalize this chat
              <ArrowUpRight />
            </button>
          </div>
        </>
      ) : null}
      {tab === "media" || tab === "reels" || tab === "files" ? (
        <SharedChatContent
          key={tab}
          conversationId={props.conversationId}
          tab={tab}
          hiddenIds={preferences.hiddenIds}
          childMode={preferences.childMode}
        />
      ) : null}
      {tab === "members" ? (
        <div className="chat-members-list">
          {props.people.map((person) => (
            <article key={person.id}>
              <button
                className="chat-person-avatar"
                aria-label={"Preview " + person.username + " profile picture"}
                onClick={() => props.onAvatar(person)}
              >
                {person.avatar_url ? <img src={person.avatar_url} alt="" /> : <Users size={21} />}
              </button>
              <Link to={"/profile/" + encodeURIComponent(person.username)}>
                <strong>
                  {preferences.nicknames[person.id] || person.display_name || person.username}
                </strong>
                <small>
                  @{person.username}
                  {person.id === props.userId ? " · You" : ""}
                </small>
              </Link>
              {person.id !== props.userId ? (
                <button className="chat-danger-link" onClick={() => props.onBlock(person)}>
                  Block
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {tab === "settings" ? (
        <>
          <section className="chat-child-settings">
            <div>
              <ShieldCheck size={25} />
              <span>
                <strong>Child Mode</strong>
                <small>Text filtering · this device</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.childMode}
                aria-label="Child Mode"
                onClick={() => {
                  if (update({ childMode: !preferences.childMode }))
                    setFeedback(
                      preferences.childMode
                        ? "Child Mode turned off on this device."
                        : "Child Mode turned on on this device.",
                    );
                }}
              >
                {preferences.childMode ? "On" : "Off"}
              </button>
            </div>
            <p>
              Blocks matching words before sending or editing, and hides matching text in this chat
              and inbox. Anyone using this account can turn it off. Images, video, voice and
              external links are not checked.
            </p>
            <a href="/child-mode-readme.html" target="_blank" rel="noreferrer">
              Read the Child Mode guide <ArrowUpRight size={13} />
            </a>
          </section>
          <p role="status" className="chat-sync-status">
            {props.syncStatus}{" "}
            <button type="button" onClick={props.onRetrySync}>
              Retry sync
            </button>
          </p>
          <section className="chat-customization">
            <h4>Make it your space</h4>
            <p className="chat-detail-note">
              Themes and nicknames are personal to your account. A local copy works offline. Other
              participants see their own preferences.
            </p>
            <div className="chat-theme-swatches" role="group" aria-label="Chat theme">
              {["rose", "sunshine", "lavender", "ocean", "paper"].map((theme) => (
                <button
                  type="button"
                  key={theme}
                  data-chat-theme={theme}
                  aria-label={theme + " theme"}
                  aria-pressed={theme === preferences.theme}
                  onClick={() => {
                    if (update({ theme })) setFeedback("Chat theme saved on this device.");
                  }}
                >
                  <i />
                  <span>{theme}</span>
                </button>
              ))}
            </div>
            <h4>Nicknames</h4>
            {props.people.map((person) => (
              <label className="chat-nickname" key={person.id}>
                <span>@{person.username}</span>
                <input
                  maxLength={32}
                  value={nicknames[person.id] || ""}
                  placeholder={person.display_name || person.username}
                  onChange={(event) =>
                    setNicknames({ ...nicknames, [person.id]: event.target.value })
                  }
                />
              </label>
            ))}
            <button className="button button-outline" onClick={saveNames}>
              Save nicknames
            </button>
          </section>
          <AccountChatSettings userId={props.userId} />
          <div className="chat-detail-rows">
            <button disabled={props.busy} onClick={() => props.onAction("mute")}>
              <Bell />
              {props.muted ? "Turn notifications on" : "Mute notifications for 8 hours"}
            </button>
            <button disabled={props.busy} onClick={() => props.onAction("unread")}>
              <EyeOff />
              Mark unread & close
            </button>
            <button disabled={props.busy} onClick={() => props.onAction("archive")}>
              <Archive />
              Archive conversation
            </button>
            <button onClick={props.onReport}>
              <Flag />
              Report a message
            </button>
            <Link to="/settings/privacy">
              <ShieldCheck />
              Account privacy & safety
              <ArrowUpRight />
            </Link>
          </div>
        </>
      ) : null}
      {feedback || props.notice ? (
        <p role="status" className="chat-details-feedback">
          {feedback || props.notice}
        </p>
      ) : null}
    </Dialog>
  );
}
