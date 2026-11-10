import { useEffect, useState, type ComponentProps } from "react";
import { supabase } from "./supabase";

const bucket = "profile-avatars";
const signedLifetimeSeconds = 60;
const signedCache = new Map<string, { url: string; expiresAt: number }>();

function objectPathFromReference(reference: string): string | null {
  const marker = "/storage/v1/object/public/profile-avatars/";
  const signedMarker = "/storage/v1/object/sign/profile-avatars/";
  const markerIndex = reference.indexOf(marker);
  const signedIndex = reference.indexOf(signedMarker);
  const index =
    markerIndex >= 0
      ? markerIndex + marker.length
      : signedIndex >= 0
        ? signedIndex + signedMarker.length
        : -1;
  if (index >= 0) {
    try {
      return decodeURIComponent(reference.slice(index).split("?")[0]);
    } catch {
      return null;
    }
  }
  if (!/^https?:\/\//i.test(reference)) return reference;
  return null;
}

export async function signProfileAvatar(reference: string | null | undefined) {
  if (!reference) return null;
  const path = objectPathFromReference(reference);
  if (!path) return null;
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, signedLifetimeSeconds);
  if (error || !data?.signedUrl) return null;
  signedCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + (signedLifetimeSeconds - 10) * 1000,
  });
  return data.signedUrl;
}

type ProfileAvatarImageProps = Omit<ComponentProps<"img">, "src"> & {
  src: string | null | undefined;
};

export function ProfileAvatarImage({ src, ...imageProps }: ProfileAvatarImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    void signProfileAvatar(src).then((url) => {
      if (active) setSignedUrl(url);
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (!signedUrl) return null;
  return <img {...imageProps} src={signedUrl} />;
}
