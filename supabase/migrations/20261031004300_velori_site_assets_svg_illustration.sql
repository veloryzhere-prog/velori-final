-- SVG error illustrations: the public shell renders illustrations through <img>,
-- which never executes scripts, and the Edge Function rejects active content
-- (scripts, event handlers, entities, embedded HTML) before any object is
-- stored. Only the bucket's allowed-type list changes; size limits still apply.
update storage.buckets
   set allowed_mime_types =
         case
           when allowed_mime_types is null
             then array['image/svg+xml']
           when allowed_mime_types @> array['image/svg+xml']
             then allowed_mime_types
           else allowed_mime_types || array['image/svg+xml']
         end
 where id = 'site-assets';
