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

## Repository layout

```text
apps/web/       React/Vite/Tailwind browser workspace
packages/db/   Drizzle schema, SQLite client, and migrations
data/          Gitignored local database and media vault
```

See [`MVP-ARCHITECTURE.md`](./MVP-ARCHITECTURE.md) for the full product and integration plan.
