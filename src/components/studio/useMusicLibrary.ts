/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  emptyMusicLibrary,
  musicLibraryKey,
  readMusicLibrary,
  updateMusicLibrary,
  type MusicLibrary,
} from "../../lib/music-library";

export function useMusicLibrary() {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const [state, setState] = useState<{ owner: string | null; library: MusicLibrary }>({
    owner: null,
    library: emptyMusicLibrary(),
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const load = () => {
      setNotice("");
      try {
        setState({
          owner,
          library: owner ? readMusicLibrary(localStorage, owner) : emptyMusicLibrary(),
        });
      } catch {
        setState({ owner, library: emptyMusicLibrary() });
        setNotice("Saved music could not be restored on this device.");
      }
    };
    load();
    const changed = (event: StorageEvent) => {
      if (owner && (event.key === musicLibraryKey(owner) || event.key === null)) load();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [owner]);
  const change = (id: string, action: "save" | "recent") => {
    if (!owner) {
      setNotice("Sign in to save music choices on this device.");
      return;
    }
    try {
      const library = updateMusicLibrary(readMusicLibrary(localStorage, owner), id, action);
      localStorage.setItem(musicLibraryKey(owner), JSON.stringify(library));
      setState({ owner, library });
      setNotice("");
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Music choices could not be saved on this device.",
      );
    }
  };
  return {
    ...(state.owner === owner ? state.library : emptyMusicLibrary()),
    notice,
    signedIn: !!owner,
    change,
  };
}
