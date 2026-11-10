import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Dialog, Avatar } from "./ui";
type Person = { id: string; username: string; display_name: string; avatar_url: string | null };
export function MutualConnections({ profileId }: { profileId: string }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [retry, setRetry] = useState(0),
    [page, setPage] = useState(0);
  useEffect(() => {
    if (!user || user.id === profileId) return;
    let active = true;
    setLoading(true);
    setError("");
    void supabase
      .rpc("profile_mutual_connections", {
        p_profile_id: profileId,
        p_limit: 13,
        p_offset: page * 12,
      })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Shared connections are unavailable.");
        else {
          setPeople((current) =>
            page ? [...current, ...(data || []).slice(0, 12)] : (data || []).slice(0, 12),
          );
          setMore((data || []).length > 12);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId, user?.id, retry, page]);
  useEffect(() => {
    setPeople([]);
    setPage(0);
    setOpen(false);
  }, [profileId]);
  if (!user || user.id === profileId) return null;
  return (
    <div className="mutual-connections">
      {error ? (
        <button onClick={() => setRetry((n) => n + 1)}>Retry shared connections</button>
      ) : loading && !people.length ? (
        <span>Finding shared connections…</span>
      ) : people.length ? (
        <button className="mutual-summary" onClick={() => setOpen(true)}>
          <span>
            {people.slice(0, 3).map((person) => (
              <Avatar
                key={person.id}
                name={person.display_name || person.username}
                src={person.avatar_url}
                size="small"
              />
            ))}
          </span>
          <span>
            People you both follow{" "}
            <strong>
              {people
                .slice(0, 2)
                .map((person) => person.display_name || person.username)
                .join(", ")}
              {people.length > 2 ? " and more" : ""}
            </strong>
          </span>
        </button>
      ) : (
        <small>No shared connections are visible.</small>
      )}
      {open ? (
        <Dialog
          open
          title="People you both follow"
          description="Shared connections visible under this profile’s privacy settings."
          onClose={() => setOpen(false)}
          className="mutual-dialog"
        >
          <div className="chat-members-list">
            {people.map((person) => (
              <Link
                key={person.id}
                to={"/profile/" + encodeURIComponent(person.username)}
                onClick={() => setOpen(false)}
              >
                <Avatar name={person.display_name || person.username} src={person.avatar_url} />
                <span>
                  <strong>{person.display_name || person.username}</strong>
                  <small>@{person.username}</small>
                </span>
              </Link>
            ))}
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {more ? (
            <button
              className="button button-outline"
              disabled={loading}
              onClick={() => setPage((n) => n + 1)}
            >
              {loading ? "Loading…" : "Load more connections"}
            </button>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
