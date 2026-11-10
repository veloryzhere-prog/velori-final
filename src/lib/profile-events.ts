export type ProfileSnapshot = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const PROFILE_CHANGED_EVENT = "velori:profile-changed";

export function publishProfileChange(profile: ProfileSnapshot) {
  window.dispatchEvent(
    new CustomEvent<ProfileSnapshot>(PROFILE_CHANGED_EVENT, { detail: profile }),
  );
}
