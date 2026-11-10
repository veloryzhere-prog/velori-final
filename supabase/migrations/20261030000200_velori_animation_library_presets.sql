-- Add stable, named entries for the global startup and error artwork slots.
-- Uploading to these entries keeps media in the library until a route override
-- is saved and published through motion_configuration.

insert into public.animation_configs
  (key, label, category, enabled, animation_type, duration_ms, intensity, delay_ms, easing, respect_reduced_motion)
values
  ('startup_intro', 'Startup intro', 'overlay', true, 'fade', 1200, 35, 0, 'ease-out', false),
  ('error_artwork', 'Error artwork', 'state', true, 'fade', 320, 35, 0, 'ease-out', false)
on conflict (key) do nothing;
