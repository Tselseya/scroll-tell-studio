# ScrollTell Studio

ScrollTell Studio is a lightweight, local-first content workspace for drafting, transforming, organizing, and publishing content with AI assistance. It is designed for modest hardware and delegates heavy model work to connected providers such as OpenAI, Claude, and Manus while keeping the workspace local.

## Current foundation

The repository contains a native Node.js monorepo with a React/Vite/Tailwind dashboard, a Fastify API, and a Drizzle ORM schema backed by SQLite. The API now includes GitHub/Google OAuth session authentication, organization-scoped workspace authorization, and versioned consent persistence. AI provider adapters, MCP authorization, and publishing adapters continue to be added incrementally.

## Requirements

- Node.js 22 or newer
- pnpm 11 or newer

## Run locally

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:5173>.

To run both the dashboard and the local API server together, use:

```bash
pnpm dev:all
```

The API server listens on `http://127.0.0.1:8787`. Its health endpoint is `GET /health`, and the dashboard-facing API is under `/api`.

## Open the actual interface

The interface is the React dashboard in `apps/web`, not the repository README. Start the full local app with:

```bash
pnpm install
pnpm db:migrate
pnpm dev:all
```

Then open <http://localhost:5173>. You will see the ScrollTell sign-in screen. Configure at least one OAuth provider before signing in:

```bash
export APP_URL=http://127.0.0.1:8787
export WEB_APP_URL=http://127.0.0.1:5173
export GITHUB_CLIENT_ID=your-client-id
export GITHUB_CLIENT_SECRET=your-client-secret
```

For GitHub OAuth, use `http://127.0.0.1:8787/auth/github/callback` as the callback URL. Google uses `http://127.0.0.1:8787/auth/google/callback`. OAuth secrets belong only in the server environment and must never be committed.

The previous GitHub Pages URL displayed the README because the repository did not have a Pages build workflow and GitHub Pages was serving the repository root. A workflow is now included at `.github/workflows/pages.yml`; after it runs, the static dashboard will be available at <https://tselseya.github.io/scroll-tell-studio/>. GitHub Pages can host the visual frontend, but it cannot run the Node.js API, SQLite database, OAuth secrets, or publishing workers. For sign-in and real data, set `VITE_API_URL` to a separately hosted HTTPS API and configure that API's OAuth callback URLs accordingly.

Without a running API, the Pages dashboard is only a static shell and cannot authenticate or save content. For a fully working personal instance, use the local URL first.

## Verify and build

```bash
pnpm typecheck
pnpm build
```

## Database commands

The schema lives in `packages/db/src/schema.ts` and includes workspaces, content items, platform variants, media assets, destinations, connected accounts, jobs, publish attempts, and audit events.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

The local database is ignored by Git and is expected to live under `data/`.

## MCP connections

The server exposes a stateless Streamable HTTP MCP endpoint at `http://127.0.0.1:8787/mcp`. It also supports stdio for desktop MCP clients:

```bash
MCP_TRANSPORT=stdio pnpm server:start
```

For Claude Desktop or another stdio-compatible MCP client, point the command at the repository's package manager executable:

```json
{
  "mcpServers": {
    "scrolltell": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/scroll-tell-studio", "server:start"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

The initial MCP tools can list and read content, create and update drafts, create destination variants, queue explicit publish jobs, and inspect job status. Queueing a publish job does not publish externally; platform adapters will execute those jobs in a later phase.

## Repository layout

```text
apps/web/       React/Vite/Tailwind browser workspace
packages/db/   Drizzle schema, SQLite client, and migrations
data/          Gitignored local database and media vault
```

See [`MVP-ARCHITECTURE.md`](./MVP-ARCHITECTURE.md) for the full product and integration plan.

Deployment instructions are in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md), and Claude/Manus MCP setup is in [`docs/MCP-CONNECTIONS.md`](./docs/MCP-CONNECTIONS.md).
