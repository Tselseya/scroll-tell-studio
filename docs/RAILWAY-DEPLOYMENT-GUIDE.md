# Deploy M.O.S.A.N.G.’s Node.js API to Railway

This guide deploys the Fastify API in `apps/server`, keeps the SQLite database on a Railway Volume, and connects the GitHub Pages frontend to the API over HTTPS.

> **Target architecture:** GitHub Pages hosts only the React frontend. Railway hosts the Node.js API, OAuth callbacks, MCP endpoint, and the persistent SQLite file.

## 1. Prepare the repository

The repository already contains the Railway configuration in [`railway.json`](../railway.json). It defines the build command, production start command, health check, and restart policy.

The production start command is:

```bash
pnpm server:prod
```

That command runs the Drizzle migration and then starts the Fastify server:

```bash
pnpm db:migrate
pnpm server:start
```

The API binds to `0.0.0.0` automatically when `NODE_ENV=production`, which is required for Railway’s public network.

Before deploying, push the latest repository state to GitHub:

```bash
git status
git add -A
git commit -m "prepare railway deployment"
git push origin main
```

## 2. Create the Railway project

Open [Railway](https://railway.app/) and sign in with GitHub.

Create a new project, choose **Deploy from GitHub repo**, and select:

```text
Tselseya/mosang
```

Use the repository root as the service root. Do not select `apps/web` because the API service needs the monorepo root, the workspace lockfile, and the `packages/db` package.

Railway should detect the Node.js project and read `railway.json`. If the dashboard asks for commands manually, enter:

| Setting | Value |
|---|---|
| Build command | `corepack enable && pnpm install --frozen-lockfile` |
| Start command | `pnpm server:prod` |
| Health check path | `/health` |
| Root directory | repository root, `/` |

Start the first deployment after saving these settings.

## 3. Add the persistent SQLite Volume

The database must not live on Railway’s normal ephemeral filesystem.

In the Railway project:

1. Open the project canvas.
2. Select **Add** or the command palette.
3. Create a **Volume**.
4. Attach the Volume to the M.O.S.A.N.G. API service.
5. Set the mount path to:

```text
/app/data
```

Railway’s application directory is `/app`. The repository’s database directory is `data`, so mounting the Volume at `/app/data` preserves the SQLite file that the API is instructed to use.

Do not run migrations as a build step. Railway Volumes are available at runtime, so migrations run through the `server:prod` start command after the Volume has been mounted.

## 4. Add Railway environment variables

Open the API service and select **Variables**. Add these values.

### Required server variables

```text
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=/app/data/scrolltell.db
```

`PORT` should normally be left unset so Railway can provide its assigned port. The server reads `process.env.PORT` automatically.

### Temporary application URLs

You need the Railway domain before these values can be final. First deploy once, generate the domain in the next step, then return to Variables and replace `YOUR_RAILWAY_DOMAIN`.

```text
APP_URL=https://YOUR_RAILWAY_DOMAIN
WEB_APP_URL=https://tselseya.github.io/mosang/
WEB_ORIGIN=https://tselseya.github.io
```

Use the exact Railway HTTPS origin for `APP_URL`. Do not add a trailing slash to `APP_URL`.

### OAuth variables

If GitHub login is enabled:

```text
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

If Google login is enabled:

```text
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### MCP variable

Generate a strong token locally:

```bash
openssl rand -hex 32
```

Add the output as:

```text
MCP_AUTH_TOKEN=the-generated-random-token
```

The production server intentionally returns an error if `MCP_AUTH_TOKEN` is missing. This prevents accidentally exposing the remote database tools without authentication.

Never commit these values to GitHub. The repository’s [`.env.example`](../.env.example) contains names only, not secrets.

## 5. Generate the Railway public domain

In the API service:

1. Open **Settings**.
2. Find **Networking** or **Public Networking**.
3. Choose **Generate Domain**.
4. Copy the resulting URL, for example:

```text
https://mosang-api-production.up.railway.app
```

Now update the variables:

```text
APP_URL=https://mosang-api-production.up.railway.app
```

If the service redeploys after changing variables, wait for the deployment to finish before testing.

## 6. Configure GitHub OAuth

In [GitHub Developer Settings](https://github.com/settings/developers), open or create the OAuth App for M.O.S.A.N.G..

Set the authorization callback URL to:

```text
https://YOUR_RAILWAY_DOMAIN/auth/github/callback
```

Use the Railway domain exactly. The callback URL must use HTTPS in production and must not point to GitHub Pages.

The GitHub OAuth app should have the minimum scopes needed by the application. For the current identity flow, the API uses the authenticated GitHub identity and email information.

## 7. Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/), open the OAuth client used by M.O.S.A.N.G..

Add this authorized redirect URI:

```text
https://YOUR_RAILWAY_DOMAIN/auth/google/callback
```

Add the production Pages origin to the authorized JavaScript origins if Google requests it:

```text
https://tselseya.github.io
```

Google may require the OAuth consent screen to be configured before external users can sign in.

## 8. Test the Railway API directly

Set a shell variable locally:

```bash
export API_URL="https://YOUR_RAILWAY_DOMAIN"
```

Test the health endpoint:

```bash
curl -i "$API_URL/health"
```

Expected result:

```http
HTTP/2 200
```

```json
{
  "ok": true,
  "service": "mosang-server",
  "timestamp": "..."
}
```

Check configured OAuth providers:

```bash
curl -i "$API_URL/auth/providers"
```

Expected result if both providers are configured:

```json
{
  "github": true,
  "google": true
}
```

Check that protected content is not publicly readable:

```bash
curl -i "$API_URL/api/content"
```

Expected result:

```http
HTTP/2 401
```

```json
{
  "error": "Authentication required"
}
```

Do not treat a public `200` response from `/api/content` as success. That would mean tenant data is exposed without authentication.

## 9. Connect GitHub Pages to Railway

In the GitHub repository, open:

```text
Settings → Secrets and variables → Actions → Variables
```

Create this repository variable:

```text
Name: VITE_API_URL
Value: https://YOUR_RAILWAY_DOMAIN
```

The Pages workflow reads this variable during `pnpm build` and embeds it into the Vite bundle.

Run the deployment manually:

```text
Actions → Deploy dashboard to GitHub Pages → Run workflow
```

Or push a new commit to `main`.

After deployment, open:

<https://tselseya.github.io/mosang/>

The sign-in buttons should point to:

```text
https://YOUR_RAILWAY_DOMAIN/auth/github
https://YOUR_RAILWAY_DOMAIN/auth/google
```

If the buttons still point to `127.0.0.1`, the `VITE_API_URL` repository variable is missing or the Pages workflow has not been rerun after adding it.

## 10. Test the complete browser flow

Use a private browser window and open the Pages URL.

1. Confirm the page loads the M.O.S.A.N.G. sign-in screen.
2. Click **Continue with GitHub** or **Continue with Google**.
3. Complete the OAuth approval.
4. Confirm the provider redirects to the Railway API callback.
5. Confirm the API redirects back to the Pages frontend.
6. Confirm the dashboard loads the authenticated workspace.
7. Create a draft.
8. Refresh the page.
9. Confirm the draft still exists.

The refresh test verifies that the data was written to the Railway Volume rather than only held in browser memory.

## 11. Configure the remote MCP endpoint

The remote MCP endpoint is:

```text
https://YOUR_RAILWAY_DOMAIN/mcp
```

It requires:

```http
Authorization: Bearer YOUR_MCP_AUTH_TOKEN
Accept: application/json, text/event-stream
```

A direct protocol test is:

```bash
curl -i "$API_URL/mcp" \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"railway-smoke-test","version":"0.1.0"}}}'
```

A successful response uses `text/event-stream` and contains the M.O.S.A.N.G. MCP server name.

Connect Claude Code with:

```bash
claude mcp add \
  --transport http \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN" \
  mosang \
  "$API_URL/mcp"
```

For Manus, create a custom MCP connector with the same HTTPS URL and bearer token.

The current remote MCP design is intended for your personal workspace or a private beta. Before allowing multiple SaaS customers to use remote MCP, add per-user authentication and enforce organization scope inside every MCP tool.

## 12. Backups and operational limits

A persistent Volume protects the SQLite file from normal redeploys, but it is not a complete backup strategy. Periodically copy the database to an encrypted backup location and test restoring it.

Keep the API at one instance while it uses SQLite. Do not enable horizontal replicas. Do not place the database on an ephemeral path. Do not expose the SQLite file through a static route.

Move to managed PostgreSQL before onboarding substantial customer data, enabling multiple API replicas, or running a high-volume publishing queue.

## References

[1]: https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime "Railway Node.js and Express deployment guide"
[2]: https://docs.railway.com/volumes "Railway Volumes"
[3]: https://docs.github.com/en/actions "GitHub Actions documentation"
[4]: https://github.com/settings/developers "GitHub Developer Settings"
[5]: https://console.cloud.google.com/ "Google Cloud Console"
