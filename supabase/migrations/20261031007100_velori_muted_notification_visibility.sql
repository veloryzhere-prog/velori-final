drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and not exists (
      select 1 from public.mutes m
       where m.muter_id = (select auth.uid())
         and m.muted_id = notifications.actor_id
         and m.hide_notifications
    )
  );
