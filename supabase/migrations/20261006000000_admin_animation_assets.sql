-- Configurable startup and error animation assets, managed by administrators.
alter table public.site_settings
  add column if not exists startup_animation_url text,
  add column if not exists error_animation_url text;

alter table public.site_settings
  alter column error_404_enabled set default true;

-- The earlier 404 migration shipped with animation off by default. The product
-- now starts with the supplied animation enabled; administrators can turn it
-- off again in Site settings.
update public.site_settings
set error_404_enabled = true
where error_404_enabled = false;

-- The existing bucket remains public-read only. Uploads still go through the
-- administrator Edge Function, which checks role, size, MIME and file bytes.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'video/mp4']
where id = 'site-assets';
