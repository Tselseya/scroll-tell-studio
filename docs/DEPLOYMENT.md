# Production API Deployment

This repository contains two deployable pieces: the static React dashboard in `apps/web` and the Fastify API in `apps/server`. GitHub Pages can host the dashboard, but it cannot run Node.js, SQLite, OAuth callbacks, or MCP. The API therefore needs a separate HTTPS host.

## Recommended first production shape

For a personal or very small beta, run one API instance with one persistent SQLite volume. Use the `server:prod` command, which applies Drizzle migrations and starts the API. This is simple but not horizontally scalable. SQLite must not be placed on an ephemeral filesystem and must not be shared concurrently by multiple instances.

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| Railway + volume + SQLite | Fastest path; easy public URL and volume; single-instance SQLite limitation; usage-based billing. | Railway plan/usage and volume charges | Low |
| Render paid web service + persistent disk + SQLite | Clear disk model and daily snapshots; disk service is single-instance and deploys have a brief swap; free filesystem is ephemeral. | Paid web service and disk | Low–medium |
| Managed Postgres plus API host | Best long-term multi-tenant and scaling path; requires database migration and more operations. | Provider/database usage | Medium–high |

For this project, Railway is the quickest personal beta path. For public SaaS, move from SQLite to managed Postgres before adding multiple API replicas or substantial customer data.

## Railway deployment

1. Create a Railway project and deploy the GitHub repository `Tselseya/mosang`.
2. Configure the service root as the repository root.
3. Railway should use `railway.json`. If entering commands manually, use:
   - Build: `corepack enable && pnpm install --frozen-lockfile`
   - Start: `pnpm server:prod`
   - Health check: `/health`
4. Add a Railway Volume and mount it at `/app/data`. Railway documents that relative `./data` writes persist only when the volume is mounted at the corresponding absolute application path.
5. Set `DATABASE_URL=/app/data/scrolltell.db`.
6. Set `NODE_ENV=production` and `HOST=0.0.0.0`.
7. Generate a public HTTPS domain, for example `https://mosang-api-production.up.railway.app`.
8. Set `APP_URL` to that exact API origin and `WEB_APP_URL` to the frontend origin.
9. Add the GitHub and/or Google client IDs and secrets. OAuth callback URLs must be:
   - `https://YOUR_API_DOMAIN/auth/github/callback`
   - `https://YOUR_API_DOMAIN/auth/google/callback`
10. Set a long random `MCP_AUTH_TOKEN`. Do not use the OAuth session cookie as the MCP credential.
11. Verify `GET https://YOUR_API_DOMAIN/health` returns JSON and check logs for successful migrations.

Railway volumes are mounted at runtime, not during build or pre-deploy. The migration runs in the start command so the volume is available. Back up the SQLite file before schema changes and before destructive maintenance.

## Render deployment

The repository includes `render.yaml` as a starting Blueprint.

1. In Render, create a Blueprint from the GitHub repository, or create a Node Web Service manually.
2. Use:
   - Build: `corepack enable && pnpm install --frozen-lockfile`
   - Start: `pnpm server:prod`
   - Health check path: `/health`
3. Attach a persistent disk mounted at `/var/data`.
4. Set `DATABASE_URL=/var/data/scrolltell.db`.
5. Set `HOST=0.0.0.0`; Render requires the public service to bind to `0.0.0.0` and the `PORT` environment variable.
6. Add the same OAuth, `APP_URL`, `WEB_APP_URL`, `WEB_ORIGIN`, and `MCP_AUTH_TOKEN` variables described above.
7. Use the resulting `https://YOUR_SERVICE.onrender.com` URL as the API origin.

Render’s filesystem is ephemeral without a disk. Persistent disks are available to paid services, are attached to one service instance, cannot be shared between replicas, and prevent zero-downtime deploys. That makes this suitable for a single-instance beta, not a scaled multi-tenant production system.

## GitHub Pages frontend

Build the frontend with the API URL embedded at build time:

```bash
VITE_API_URL=https://YOUR_API_DOMAIN pnpm build
```

The included GitHub Actions Pages workflow currently builds the static frontend. Add `VITE_API_URL` as a repository or environment variable in GitHub Actions when the API is live. The browser must call an HTTPS API from the HTTPS Pages site; do not use `http://127.0.0.1` in production.

The API must allow the exact Pages origin through `WEB_ORIGIN`, and cookies must remain `SameSite=Lax` or use a carefully reviewed cross-site OAuth/session design. If frontend and API are on different sites, test OAuth cookies in the actual browser because browser third-party-cookie rules vary. A custom domain under the same site is simpler.

## SQLite production limits

SQLite is a good low-cost personal beta database, but it is not the final public-SaaS database here. Do not run multiple API replicas against the same SQLite file. Do not use a shared network filesystem for concurrent SQLite writers. Maintain backups, test restore, monitor disk usage, and plan the PostgreSQL migration before onboarding significant user data.

## Sources

- [Railway Node deployment guide](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime)
- [Railway volumes](https://docs.railway.com/volumes)
- [Render web services](https://render.com/docs/web-services)
- [Render persistent disks](https://render.com/docs/disks)
