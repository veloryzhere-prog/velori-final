-- Optional data-only setup for another VELORI installation. Existing bucket privacy,
-- upload limits and participant RLS policies stay unchanged. No schema changes.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/gif')
where id = 'message-media' and not ('image/gif' = any(allowed_mime_types));
