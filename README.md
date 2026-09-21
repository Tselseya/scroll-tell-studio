# ScrollTell Studio

ScrollTell Studio is a lightweight, local-first content workspace for drafting, transforming, organizing, and publishing content with AI assistance. It is designed for modest hardware and delegates heavy model work to connected providers such as OpenAI, Claude, and Manus while keeping the workspace local.

## Current foundation

The repository now contains a native Node.js monorepo with a React/Vite/Tailwind dashboard and a Drizzle ORM schema backed by SQLite. The dashboard is currently a frontend-first workspace shell; the local server, AI provider adapters, MCP server, and publishing adapters will be added incrementally.

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
