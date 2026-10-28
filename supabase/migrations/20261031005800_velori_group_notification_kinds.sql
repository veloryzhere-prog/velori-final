-- The group RPCs emit distinct lifecycle events so recipients can filter them
-- with the existing Groups category.
alter table public.notifications
  drop constraint if exists notifications_kind_check,
  add constraint notifications_kind_check
    check (
      kind in (
        'like',
        'comment',
        'reply',
        'follow',
        'follow_request',
        'mention',
        'tag',
        'story_reaction',
        'story_reply',
        'reel_interaction',
        'message',
        'group',
        'group_invite',
        'group_join',
        'group_request_approved',
        'group_request_declined',
        'security',
        'system'
      )
    );
