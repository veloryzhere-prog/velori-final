-- Reel cover images live in the private `reel-media` bucket next to the rendered
-- video. The bucket previously accepted only `video/mp4`, so the cover frame a
-- creator picks in the Reel Studio could never be uploaded. The viewer already
-- resolves covers from `reel_media` rows with `media_type = 'image'`, and the
-- row check constraint already permits that value, so only the bucket mime list
-- needs widening. The existing "Reel authors upload own media" policy already
-- allows an author to upload media for a reel they own.
update storage.buckets
set allowed_mime_types = array['video/mp4', 'image/jpeg']
where id = 'reel-media';
