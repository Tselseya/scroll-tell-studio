# M.O.S.A.N.G. n8n integration

M.O.S.A.N.G. exposes a versioned automation API for n8n and other workflow tools. The first integration uses a bearer API key and is intentionally separate from the browser's OAuth session cookie.

## Configure the API key

Generate a key:

```bash
openssl rand -hex 32
```

Set it only in the API server environment:

```env
MOSANG_N8N_API_KEY=replace-with-a-long-random-value
```

Restart the API after changing the environment. Never place this key in frontend code, GitHub Pages variables, a public workflow export, or a URL query string.

## Configure n8n

Create a credential for the M.O.S.A.N.G. API using Header Auth:

| Field | Value |
|---|---|
| Header name | `Authorization` |
| Header value | `Bearer YOUR_MOSANG_N8N_API_KEY` |

Use the API host as the base URL. For local development:

```text
http://127.0.0.1:8787
```

A cloud-hosted n8n instance cannot reach `127.0.0.1` on your personal computer. Use a public HTTPS M.O.S.A.N.G. API deployment or a secure network connection.

## Verify the connection

Use an HTTP Request node:

```text
Method: GET
URL: https://YOUR_MOSANG_API_HOST/api/v1/health
Authentication: Header Auth
```

Expected response:

```json
{
  "ok": true,
  "service": "mosang-automation-api",
  "version": "v1"
}
```

The OpenAPI contract is [`mosang-automation.openapi.yaml`](./api/mosang-automation.openapi.yaml). It can be imported into tools that support OpenAPI or used as the contract for a future verified n8n community node.

## Current operations

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/health` | Verify the key and API availability |
| `GET` | `/api/v1/content` | List drafts and content items |
| `POST` | `/api/v1/content` | Create a draft |
| `POST` | `/api/v1/content/:id/variants` | Create a platform-specific variant |
| `POST` | `/api/v1/generation/images` | Queue an image-generation job |
| `POST` | `/api/v1/generation/videos` | Queue a video-generation job |
| `POST` | `/api/v1/generation/voice` | Queue a voice-generation job |
| `GET` | `/api/v1/jobs` | List recent jobs |
| `GET` | `/api/v1/jobs/:id` | Read one job's status |
| `POST` | `/api/v1/publish/queue` | Queue a publishing job |

## Example n8n workflow

A first workflow can be structured as:

```text
Webhook trigger
  → Create M.O.S.A.N.G. draft
  → Queue image generation
  → Wait or poll the job status
  → Create an X or Threads variant
  → Queue publishing
```

### Create a draft

HTTP Request node:

```text
Method: POST
URL: https://YOUR_MOSANG_API_HOST/api/v1/content
Authentication: Header Auth
Send: JSON
```

Body:

```json
{
  "workspaceId": "personal",
  "title": "{{$json.title}}",
  "description": "{{$json.description}}",
  "contentType": "text",
  "status": "draft",
  "sourcePrompt": "Created by n8n"
}
```

### Queue an image job

```text
Method: POST
URL: https://YOUR_MOSANG_API_HOST/api/v1/generation/images
Authentication: Header Auth
Send: JSON
```

Body:

```json
{
  "workspaceId": "personal",
  "provider": "google-imagen",
  "prompt": "{{$json.imagePrompt}}",
  "aspectRatio": "1:1",
  "contentItemId": "{{$node['Create draft'].json.item.id}}",
  "idempotencyKey": "{{$execution.id}}-image"
}
```

The response is asynchronous. Once the provider worker is running and its key is configured, it will call the selected provider and attach the generated file to the M.O.S.A.N.G. media vault:

```json
{
  "job": {
    "id": "job-id",
    "type": "ai_generation",
    "status": "queued"
  },
  "message": "Generation queued. Run the M.O.S.A.N.G. worker with the selected provider configured."
}
```

### Poll a job

Use a Wait node followed by an HTTP Request node:

```text
GET https://YOUR_MOSANG_API_HOST/api/v1/jobs/{{$json.job.id}}
```

Continue polling while the status is `queued` or `running`. Stop on `succeeded`, `failed`, or `cancelled`.

## Run the provider worker

The API process and worker process are separate. Run both during local development:

```bash
pnpm server:start
pnpm worker:start
```

The worker polls queued `ai_generation` jobs, claims one, calls the configured provider, writes the returned bytes to `MEDIA_DIR`, creates a media-asset record, and updates the job to `succeeded`. Failed jobs are retried up to `WORKER_MAX_ATTEMPTS`.

Current adapters:

| Job kind | Provider value | Required configuration | Output |
|---|---|---|---|
| `image_generation` | `google-image`, `google-imagen`, or `google` | `GOOGLE_IMAGE_API_KEY` and a supported Google image endpoint/model | PNG media asset |
| `voice_generation` | `elevenlabs` or `eleven-labs` | `ELEVENLABS_API_KEY` and a voice ID | MP3 media asset |

The Google adapter accepts a configurable `GOOGLE_IMAGE_API_URL` because Google has changed image-generation surfaces; verify that the selected endpoint and model are enabled for your account. The old Gemini Imagen endpoint is not assumed to be available.

Video jobs are intentionally left queued until a video-provider adapter is added.

For self-hosted image/video generation outside the current M.O.S.A.N.G. worker adapters, see [`OPEN_SOURCE_MEDIA_GENERATION.md`](./OPEN_SOURCE_MEDIA_GENERATION.md). In particular, ComfyUI documents a separate local server API (`POST /prompt`, history/output routes, and WebSocket progress) that n8n can call with HTTP Request nodes. This is a direct external integration, not an adapter already included in M.O.S.A.N.G. Do not expose the unauthenticated ComfyUI server publicly; keep it on a private network or behind authenticated access.

Similarly, `/api/v1/publish/queue` creates a local job but does not yet make an external social post until a publishing adapter and worker are configured.

Do not describe a queued or failed job as a completed image, video, voice file, or published post.

## Security and deployment

Use a separate API key for each automation environment where possible. The current first version uses one server-level key for the personal workspace. Before public multi-tenant launch, replace it with database-backed keys that support workspace scopes, permissions, expiration, revocation, rate limits, and last-used timestamps.

Use HTTPS for cloud deployments. Keep the M.O.S.A.N.G. API key separate from `MCP_AUTH_TOKEN`, OAuth client secrets, and provider keys. Do not pass the key in a webhook URL. n8n Webhook production URLs should be authenticated and should only be enabled after the workflow has been tested.

## Keeping it free

M.O.S.A.N.G. is free and open source, and the worker does not hide provider costs or pay them on your behalf. The hybrid model is **BYOK (bring your own key)**: you add your own Google and ElevenLabs credentials, and each provider applies its own quotas, free tier, or billing rules. If you do not configure a key, that provider's jobs fail safely without a paid request. Keep `WORKER_MAX_ATTEMPTS` low and use n8n idempotency keys so retries do not create unexpected provider usage.
