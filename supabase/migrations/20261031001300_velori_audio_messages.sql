-- Add recorded voice notes to the existing private message-media flow.

alter table public.messages
  drop constraint if exists messages_kind_check;

alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'image', 'video', 'file', 'audio', 'system'));

alter table public.message_attachments
  drop constraint if exists message_attachments_media_type_check;

alter table public.message_attachments
  add constraint message_attachments_media_type_check
  check (media_type in ('image', 'video', 'file', 'audio'));

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg',
     'image/png',
     'image/webp',
     'video/mp4',
     'application/pdf',
     'audio/mp4',
     'audio/webm',
     'audio/ogg'
   ]
 where id = 'message-media';
