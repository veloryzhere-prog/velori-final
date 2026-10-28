# VELORI authenticated transcription worker

This service belongs to the existing VELORI repository. React/Vite remains the frontend; Supabase verifies the signed-in user and proxies to a separate Node process. It is source-complete and tested with controlled subprocess adapters, but no FFmpeg/Whisper binaries, model or server have been installed or deployed.

## Configuration

Use a Node runtime with native Request/FormData support. Start with:
`node services/transcription/server.mjs`

Protected worker variables:

- VELORI_TRANSCRIPTION_WORKER_TOKEN: at least 32 random characters, shared only with the Edge function.
- FFMPEG_BINARY_PATH / FFPROBE_BINARY_PATH: absolute paths to trusted installed binaries.
- WHISPER_BINARY_PATH / WHISPER_MODEL_PATH: absolute paths to the trusted whisper-cli binary and compatible model.
- HOST defaults to 127.0.0.1; PORT defaults to 8089. Put it behind authenticated private networking or an HTTPS reverse proxy. The host requires separate provisioning.

Protected Edge variables:

- VELORI_TRANSCRIPTION_ENABLED=true
- VELORI_TRANSCRIPTION_WORKER_URL=https://your-worker-host/transcribe
- VELORI_TRANSCRIPTION_WORKER_TOKEN: same protected value.

POST multipart/form-data with an audio field to /functions/v1/velori-studio/transcribe, carrying the real Supabase user bearer token and public project API key. Never expose the worker token to React. The Edge source must be deployed before this new route is available. It currently returns 503 until configured.

## Limits and behavior

8 MiB audio, two minutes maximum, one active worker task, one request per user per minute per worker instance. Every task probes the actual stream, normalizes to 16 kHz mono PCM, runs Whisper via fixed executable argument arrays without a shell and removes its fresh temporary directory in finally. Filenames/commands/model paths never come from the client. Upload, subprocess and response sizes/time are bounded. Unsupported MIME, invalid audio, concurrent work and unavailable configuration produce explicit errors.

Keep worker replicas at one until shared rate limiting is implemented. This endpoint does not deduct paid generation credits: transcription pricing and durable metering are not part of the current entitlement contract. Browser-local editing/export is not billable.

No audio or transcript is stored by this service. The host/reverse proxy must disable body logging and apply HTTPS, network restrictions and operational monitoring. No real audio/binary acceptance or performance result is claimed.

## New attachments review

Read all 217 lines of Pasted text(20261025-083153).txt and all 250 lines of Pasted text (2)(3).txt. Pricing/quota components already exist under src/features/artifacts. Stripe/Razorpay helpers exist in commerce.ts. The commercial SQL remains a separately reviewed proposal; settlement lifecycle and receipt dispatch are not activated. Do not copy the example public SECURITY DEFINER token increment, hardcoded receipt recipient, non-dismissible fake discount, or shell-interpolated Whisper command into production.

PhonePe and Razorpay have separate webhook contracts; the Razorpay HMAC handler is not PhonePe support. A payment success redirect never grants credits. See docs/forge/COMPLETE_BLUEPRINT_REVIEW.md for the remaining commercial rollout steps.
