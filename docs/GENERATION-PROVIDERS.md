# M.O.S.A.N.G. generation providers and cost model

M.O.S.A.N.G. is the orchestration layer. It stores prompts, jobs, generated assets, content relationships, and workflow history, but it does not need to pay for hosted generation on behalf of users.

## Current generation mapping

| Content type | M.O.S.A.N.G. component | Provider adapter | What happens | Cost model |
|---|---|---|---|---|
| Text drafts and rewrites | API server/editor copilot | OpenAI-compatible endpoint or direct Claude configuration | The server sends the request using the configured server key and returns editorial text | Use a provider free tier, local model, or your own API key |
| Images | Provider worker | Google image adapter | Worker sends the prompt, downloads returned image bytes, and stores them in `MEDIA_DIR` and `media_assets` | Google account quota/free allowance where available; otherwise Google provider pricing |
| Voice/audio | Provider worker | ElevenLabs REST adapter | Worker sends text to `/v1/text-to-speech/{voice_id}`, stores returned MP3 bytes, and creates a media asset | ElevenLabs free allowance where available; otherwise ElevenLabs pricing |
| Videos | Reserved job type | Not implemented yet | Job remains queued until a video adapter is added | No provider call is made yet |
| Social publishing | Publishing worker | Not implemented for external platforms yet | `/api/v1/publish/queue` records a job but does not publish externally | No social API call is made yet |

## Why this remains free for M.O.S.A.N.G.

The software itself remains open source and free to self-host. Provider credentials are supplied by the operator through environment variables and are never embedded in the frontend or sent to n8n. M.O.S.A.N.G. does not operate a shared paid proxy, so it does not create a central bill for provider usage.

The practical meaning of “free” is:

1. The M.O.S.A.N.G. source code, local editor, SQLite storage, worker, n8n API, and MCP integration can be used without a M.O.S.A.N.G. subscription.
2. A provider may offer a free quota, trial allowance, or local/self-hosted option, but those limits and terms belong to that provider and can change.
3. If a provider key is absent, the worker fails the job without making a paid provider request.
4. Retry limits and idempotency keys are used to reduce accidental duplicate requests.
5. Local providers can be added later, such as ComfyUI for images or a local text-to-speech engine, when the user's hardware can support them.

## Current environment configuration

```env
# Google image adapter
GOOGLE_IMAGE_API_KEY=
GOOGLE_IMAGE_API_URL=
GOOGLE_IMAGE_MODEL=gemini-2.5-flash-image

# ElevenLabs voice adapter
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128

# Worker controls
WORKER_POLL_MS=5000
WORKER_MAX_ATTEMPTS=3
```

Google's older Imagen Gemini endpoint should not be assumed to work. The Google adapter supports a configurable endpoint and model so the operator can select a currently available Google image-generation surface. Check the provider's current documentation and account access before enabling it.

## Local-only route to zero provider cost

For a completely provider-free setup, use M.O.S.A.N.G. with text models and media engines running on the user's own hardware. This avoids hosted API charges but requires suitable hardware, model downloads, storage, and slower generation. The low-spec default remains BYOK hosted providers because it avoids downloading large local models.
