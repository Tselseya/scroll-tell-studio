# M.O.S.A.N.G. — MVP Architecture

## Product direction

M.O.S.A.N.G. is a lightweight, open-source, single-user content operations workspace inspired by Blotato's multi-platform publishing workflow and MangoDisk's local-first, agent-friendly organization model. It is intended to run on modest hardware and to delegate demanding language-model work to connected providers rather than requiring a large local model.

The MVP should help one creator draft, organize, transform, preview, schedule, and publish content from one browser-based local application.

## Confirmed MVP scope

The first release targets:

1. Text posts, with priority on X/Twitter and Threads.
2. Image posts and carousels, expanding to Facebook and Instagram.
3. Short-form video publishing for Instagram and TikTok.
4. Long-form video publishing for YouTube.
5. Facebook, Instagram, Threads, YouTube, TikTok, and X/Twitter as the initial destinations.
6. Official platform APIs where practical, with browser automation available from day one to avoid approval bottlenecks.
7. A local browser application for one user and one local workspace.
8. A built-in chat interface that can use connected AI providers.
9. An MCP server so Claude, Manus, ChatGPT-compatible clients, and other MCP clients can operate the workspace through controlled tools.
10. Optional local Ollama models, optimized for small models rather than required for normal operation.

## Design principles

- **Local-first:** drafts, metadata, queues, and media remain on the user's computer by default.
- **Provider-agnostic:** AI providers and publishing adapters are replaceable modules.
- **Low resource usage:** no mandatory local GPU, vector database, browser-heavy frontend, or large model.
- **Human-controlled publishing:** generation and preparation are separate from final publishing, with previews and explicit publish actions.
- **Automation with fallbacks:** use official APIs when available and Playwright-based browser automation when API access is unavailable or delayed.
- **Open integration surface:** every major operation is exposed through typed internal services and safe MCP tools.
- **Single-user security:** local secrets are protected and never exposed to model prompts or MCP tool responses.

## Proposed runtime architecture

```text
+------------------------------- Browser -------------------------------+
| React + TypeScript workspace                                           |
| Chat | Content library | Composer | Calendar | Accounts | Run history |
+-------------------------------+---------------------------------------+
                                | local HTTP/WebSocket
+-------------------------------v---------------------------------------+
| Local application server                                                   |
| Fastify or Hono + TypeScript                                             |
|                                                                           |
|  Chat orchestration  |  Content service  |  Publishing service        |
|  MCP server           |  Media service    |  Scheduler / job queue     |
+----------+------------+----------+-----------+-------------+-------------+
           |                       |                         |
     SQLite database        Local media vault          Worker processes
     + Drizzle ORM          files + thumbnails         API / Playwright
           |                       |                         |
           +-----------------------+-------------------------+
                                   |
             AI provider adapters and publishing adapters
```

### Frontend

Use **React, TypeScript, and Vite** for a fast local development loop and a small browser bundle. Use a restrained component system such as Tailwind CSS with accessible headless components. The interface should emphasize a content library, a composer, a provider-aware chat panel, publishing previews, and a run-history view rather than a heavy social-media dashboard.

### Local application server

Use **Node.js with TypeScript** and a small HTTP framework such as **Fastify** or **Hono**. The server owns the database, credential access, provider calls, publishing adapters, media operations, MCP transport, and the job queue. The browser should never receive raw provider secrets.

### Storage

Use **SQLite** as the default database, accessed through **Drizzle ORM**. Store structured records for workspaces, content items, variants, media assets, destinations, connected accounts, publish attempts, jobs, and audit events. Store large media files in a local vault directory and keep only paths, hashes, dimensions, durations, and derived metadata in SQLite.

This avoids requiring PostgreSQL, Redis, Elasticsearch, or a hosted object store for the personal MVP.

### Job execution

Use a SQLite-backed job table with a small worker loop. Jobs should be resumable and idempotent, with states such as `queued`, `running`, `succeeded`, `failed`, `retrying`, and `cancelled`. The same mechanism handles media preparation, API publishing, browser automation, scheduled publishing, and AI transformations.

A separate process is preferable for Playwright and media-heavy work so the local web server remains responsive. For the smallest installation, the worker may initially run in the same Node process and be split out when needed.

## AI and MCP architecture

### AI provider interface

Define one internal provider contract so the chat UI can switch models without changing the rest of the application:

```ts
interface ModelProvider {
  id: string;
  capabilities: ProviderCapability[];
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens?(request: ChatRequest): Promise<number>;
}
```

Initial provider adapters:

- **OpenAI adapter** for ChatGPT models through the OpenAI-compatible API.
- **Anthropic adapter** for Claude models.
- **Manus adapter** using the supported Manus API or connector mechanism available to the installation; the adapter must not assume undocumented endpoints.
- **Ollama adapter** for optional local models such as small Qwen or Llama variants.

The chat orchestrator supplies selected content, media metadata, brand instructions, and available tools to the provider. It should support streaming responses, provider selection per conversation, retries, and usage/error records.

### MCP server

Expose the local application as an MCP server using the official TypeScript MCP SDK. Support:

- **stdio transport** for local desktop clients such as Claude Desktop.
- **Streamable HTTP transport** bound to localhost for clients that connect through an HTTP MCP endpoint.
- An optional authenticated remote endpoint only after the local mode is stable.

Initial MCP tools should be narrow and auditable:

- List and search content.
- Read a content item and its variants.
- Create a draft.
- Update a draft or generate a platform variant.
- Attach or inspect media metadata.
- Preview a destination-specific post.
- Queue a publish job.
- Inspect job status and publish history.
- Cancel a queued job.

Publishing tools should never silently publish from a general-purpose prompt. The first version should require an explicit publish operation and record the calling client, destination, account, payload hash, and timestamp.

## Publishing adapter architecture

Each destination implements a common interface while retaining platform-specific validation:

```ts
interface PublishingAdapter {
  destination: Destination;
  validate(payload: PublishPayload): ValidationResult;
  preview(payload: PublishPayload): Preview;
  publish(payload: PublishPayload, account: ConnectedAccount): Promise<PublishResult>;
}
```

Each adapter can expose two execution methods:

1. **Official API method** using OAuth or provider-issued credentials.
2. **Browser automation method** using Playwright with a persistent, user-owned browser profile or an explicitly connected session.

The adapter should select the configured method, report why a fallback was used, and avoid storing raw browser cookies in the database. Browser automation must include rate limiting, screenshots or logs on failure, and a visible review step before the first use of a new destination/account.

Initial adapters:

- X/Twitter: text-first publishing.
- Threads: text-first publishing.
- Facebook: text and image publishing, then video.
- Instagram: image/carousel publishing, then short video.
- TikTok: short video publishing.
- YouTube: long-form video publishing, title, description, thumbnail, visibility, and scheduling fields.

Platform restrictions, account eligibility, API access, and browser flows change over time, so each adapter must be independently testable and versioned.

## Media pipeline

The MVP should not require AI video generation or local model inference. It should support importing existing files, generating platform-specific metadata, validating dimensions and durations, and optionally transcoding with **FFmpeg** when installed. Media processing should be queued and should preserve the original file.

For low-spec computers:

- Generate thumbnails lazily.
- Avoid loading full videos into browser memory.
- Use streaming uploads where supported.
- Keep concurrency at one media job by default.
- Make FFmpeg optional and clearly report when a requested transformation is unavailable.

## Security model

- Bind the local server to `127.0.0.1` by default.
- Require a local session token for browser and MCP HTTP access.
- Keep API keys and OAuth refresh tokens outside ordinary content records.
- Prefer the operating-system credential store where available; otherwise encrypt a local secrets vault with a user-provided master password.
- Redact secrets from logs, prompts, MCP responses, screenshots, and error reports.
- Treat MCP clients as privileged automation clients with per-tool confirmation settings.
- Maintain an append-only local audit log for provider calls, account changes, publish attempts, and browser automation.

## Suggested repository layout

```text
mosang/
├── apps/
│   ├── web/                  # React/Vite browser UI
│   └── server/               # local HTTP server and MCP endpoint
├── packages/
│   ├── core/                 # domain types and service contracts
│   ├── db/                   # SQLite schema and migrations
│   ├── providers/            # OpenAI, Anthropic, Manus, Ollama adapters
│   ├── publishers/           # platform adapters and Playwright flows
│   ├── media/                # file, thumbnail, and FFmpeg services
│   └── config/               # validated local configuration
├── data/                     # gitignored local database and media vault
├── docs/                     # design, setup, adapter, and security docs
├── tests/                    # unit, integration, and adapter tests
├── docker-compose.yml        # optional convenience deployment
├── package.json
├── LICENSE
└── README.md
```

## Installation target

The default target should be a one-command browser application for Windows, macOS, and Linux. The recommended first installation path is native Node.js with a local SQLite database because it has less overhead than requiring Docker on an 8 GB machine. Docker Compose can be provided as an optional reproducible setup for contributors and advanced users.

The app should open a local browser URL, create the local workspace on first run, and guide the user through adding provider keys and connected publishing accounts. No cloud account should be required for drafting, organizing, or using a local Ollama provider.

## Deliberate non-goals for the MVP

The first release will not include multi-user accounts, team permissions, hosted storage, a mandatory cloud backend, a built-in large language model, automatic autonomous publishing without review, or a full replacement for every platform's analytics suite.

## Open-source repository status

The project home is the existing public repository:

<https://github.com/Tselseya/mosang>

It is currently public on the `main` branch and contains only a minimal `index.html`, so the next implementation phase should establish the repository structure, README, license, contribution guide, security policy, and a runnable skeleton before adding publishing integrations.

## Recommended implementation order

1. Establish the monorepo, development scripts, README, license, and security policy.
2. Build the local server, SQLite schema, content library, and draft composer.
3. Add the provider interface and chat UI with OpenAI, Anthropic, and Ollama adapters.
4. Add the MCP server with read/create/update/preview tools.
5. Add X/Twitter and Threads text publishing, first through official APIs and then browser fallback.
6. Add media assets, image/carousel workflows, and Facebook/Instagram adapters.
7. Add short-video validation and TikTok/Instagram publishing.
8. Add YouTube upload and scheduling.
9. Add packaging, diagnostics, adapter contract tests, and contributor documentation.
