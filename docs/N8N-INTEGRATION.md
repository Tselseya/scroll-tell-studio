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

The response is asynchronous:

```json
{
  "job": {
    "id": "job-id",
    "type": "ai_generation",
    "status": "queued"
  },
  "message": "Generation queued. Provider workers will execute this job when configured."
}
```

### Poll a job

Use a Wait node followed by an HTTP Request node:

```text
GET https://YOUR_MOSANG_API_HOST/api/v1/jobs/{{$json.job.id}}
```

Continue polling while the status is `queued` or `running`. Stop on `succeeded`, `failed`, or `cancelled`.

## Important current limitation

The API currently **queues** generation jobs but does not yet execute Google, ElevenLabs, or other generation-provider adapters. The generation endpoints establish the stable n8n contract and job records first. The next implementation phase will add workers for:

- Google/Imagen image generation
- ElevenLabs voice generation
- A video provider such as Veo or another supported API
- Media output persistence and attachment to content items

Similarly, `/api/v1/publish/queue` creates a local job but does not yet make an external social post until a publishing adapter and worker are configured.

Do not describe a queued job as a completed image, video, voice file, or published post.

## Security and deployment

Use a separate API key for each automation environment where possible. The current first version uses one server-level key for the personal workspace. Before public multi-tenant launch, replace it with database-backed keys that support workspace scopes, permissions, expiration, revocation, rate limits, and last-used timestamps.

Use HTTPS for cloud deployments. Keep the M.O.S.A.N.G. API key separate from `MCP_AUTH_TOKEN`, OAuth client secrets, and provider keys. Do not pass the key in a webhook URL. n8n Webhook production URLs should be authenticated and should only be enabled after the workflow has been tested.
