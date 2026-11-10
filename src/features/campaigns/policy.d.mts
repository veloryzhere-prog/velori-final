export function safeCampaignUrl(value: unknown): string | null;
export function announcementTargetsRoute(
  item: { target_route?: string; target_routes?: string[] },
  pathname: string,
): boolean;
export function isForgeAnnouncementEntryRoute(pathname: string): boolean;
export function announcementEligible(
  item: { starts_at?: string; ends_at?: string; frequency_mode?: string; max_show_count?: number },
  state?: {
    show_count?: number;
    count?: number;
    last_seen_at?: string | null;
    last?: number;
    dismissed_at?: string | null;
    dismissed?: boolean;
  },
  sessionSeen?: boolean,
  now?: number,
): boolean;
