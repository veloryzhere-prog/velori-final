# VELORI FFmpeg renderer

This service runs outside Supabase Edge Functions because those functions do not
provide an FFmpeg subprocess. It has no npm dependencies and requires Node.js 20+
and an FFmpeg build with `libx264`, `libx265`, `prores_ks`, and `drawtext`.

## Configure and run

Run the service on a private network behind an HTTPS reverse proxy. The worker
itself speaks HTTP; only the proxy should be externally reachable. Restrict
proxy access to the Supabase Edge Function and keep the shared token out of browser
configuration and generate a random value of at least 32 characters. The
Dockerfile builds an image with FFmpeg and the text-overlay font included:

```powershell
docker build -f services\reel-renderer\Dockerfile -t velori-reel-renderer .
docker run --rm -p 127.0.0.1:8788:8788 `
  -v D:\velori-render-output:/data/exports `
  -e VELORI_FFMPEG_RENDERER_TOKEN="<long-random-secret>" `
  -e SUPABASE_URL="https://<project-ref>.supabase.co" `
  -e VELORI_RENDER_CONCURRENCY="1" `
  velori-reel-renderer
```

For direct Node deployment instead of Docker, install FFmpeg with `libx264`,
`libx265`, `prores_ks`, and `drawtext`, then set `PORT`,
`VELORI_FFMPEG_RENDERER_TOKEN`, `SUPABASE_URL`, `VELORI_RENDER_OUTPUT_DIR`, and
optionally `VELORI_FFMPEG_FONT_FILE` before running
`node services\reel-renderer\server.mjs`.

Set these server-side Supabase Edge Function secrets:

- `VELORI_FFMPEG_RENDERER_URL`: the HTTPS base URL of this worker.
- `VELORI_FFMPEG_RENDERER_TOKEN`: the same secret configured on the worker.
- `VELORI_SUPABASE_SECRET_KEY`: the Supabase service-role key, if the project
  runtime does not inject `SUPABASE_SECRET_KEYS`.
- `ALLOWED_ORIGINS`: comma-separated VELORI web origins.

Deploy the Edge Function with
`supabase functions deploy reel-export --no-verify-jwt`. It verifies the user's
Supabase access token itself, creates user-prefixed signed input uploads, and
proxies worker status and download requests. The worker accepts only signed
source URLs from the configured Supabase origin and checks the authenticated
owner ID on status and download requests.

The worker keeps active job metadata in memory. Its output directory must be
persistent and have enough free space for concurrent source and output files.
Completed outputs and thumbnails are removed after 24 hours. A worker restart
loses its active and completed job metadata; results cannot be downloaded after
that restart even if the files remain on disk. Deploy it with a process
supervisor and avoid restarting during rendering or before users download their
results. No database tables or storage buckets are created by this
implementation.

## Supported render settings

- MP4 with H.264/H.265, AAC audio, and selectable CBR/VBR target bitrate.
- MOV with ProRes 422 HQ and linear PCM audio.
- 720p, 1080p, or 4K; 24, 25, 30, or 60 fps.
- 9:16, 1:1, 16:9, or 4:5 center crop.
- Mono/stereo AAC or PCM at 44.1/48 kHz.
- Selected thumbnail frame and optional 200-character text overlay.

The current editor export is deliberately limited to the selected source MP4
clip. It does not composite multiple timeline clips, external audio tracks,
transitions, effects, captions, or other editor metadata.
