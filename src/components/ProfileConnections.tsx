import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Users } from "lucide-react";
import { Dialog } from "./ui";
import { supabase } from "../lib/supabase";
type Direction = "followers" | "following";
type Connection = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};
const PAGE_SIZE = 30;
export function ProfileConnections({
  profileId,
  username,
  initialDirection,
  onClose,
}: {
  profileId: string;
  username: string;
  initialDirection: Direction;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [profiles, setProfiles] = useState<Connection[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const pending = useRef(false);
  const load = async (nextOffset: number, selected: Direction) => {
    if (pending.current) return;
    pending.current = true;
    const ticket = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("profile_connections", {
        p_profile_id: profileId,
        p_direction: selected,
        p_limit: PAGE_SIZE,
        p_offset: nextOffset,
      });
      if (ticket !== requestId.current) return;
      if (result.error) throw result.error;
      const rows = (result.data || []) as Connection[];
      setProfiles((current) => [
        ...new Map(
          [...(nextOffset === 0 ? [] : current), ...rows].map((profile) => [profile.id, profile]),
        ).values(),
      ]);
      setOffset(nextOffset + rows.length);
      setMore(rows.length === PAGE_SIZE);
    } catch {
      if (ticket === requestId.current)
        setError("We couldn’t load these profiles. Please try again.");
    } finally {
      if (ticket === requestId.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    pending.current = false;
    setProfiles([]);
    setOffset(0);
    setMore(true);
    void load(0, direction);
    return () => {
      requestId.current++;
      pending.current = false;
    };
  }, [profileId, direction]);
  return (
    <Dialog
      open
      title={direction === "followers" ? "Followers" : "Following"}
      description={"@" + username + " · Lists follow this account’s privacy settings."}
      onClose={onClose}
      className="connections-dialog"
    >
      <div className="connections-tabs" role="group" aria-label="Connection list">
        {(["followers", "following"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={direction === tab}
            onClick={() => setDirection(tab)}
          >
            {tab === "followers" ? "Followers" : "Following"}
          </button>
        ))}
      </div>
      <div className="connections-list" aria-busy={busy}>
        {profiles.map((profile) => (
          <Link
            key={profile.id}
            to={"/profile/" + encodeURIComponent(profile.username)}
            onClick={onClose}
          >
            <span className="connections-avatar">
              <Users size={19} />
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </span>
            <span>
              <strong>{profile.display_name || profile.username}</strong>
              <small>@{profile.username}</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
      {busy ? <p role="status">Loading profiles…</p> : null}
      {!busy && !error && !profiles.length ? (
        <p role="status">
          No profiles to show. This list may be empty or limited by privacy settings.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {!busy && (error || more) ? (
        <button
          type="button"
          className="button button-outline connections-load"
          onClick={() => void load(offset, direction)}
        >
          {error ? "Try again" : "Load more profiles"}
        </button>
      ) : null}
    </Dialog>
  );
}
