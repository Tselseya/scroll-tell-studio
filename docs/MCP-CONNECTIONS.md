# MCP Connections for Claude and Manus

M.O.S.A.N.G. exposes the Model Context Protocol at `POST /mcp`. The server is currently stateless Streamable HTTP. It also supports local stdio. The tools can list content, read a content item, create and update drafts, preview destination variants, queue a publish job, and list jobs.

## Important security distinction

The local stdio server directly opens the local SQLite database and is appropriate for Claude Code or another MCP client running on the same machine. A remote MCP server is different: it exposes the database over the internet. Use HTTPS, set `MCP_AUTH_TOKEN`, keep the server single-user until per-user MCP authorization is implemented, and never expose a remote MCP endpoint without authentication.

The current remote guard expects:

```http
Authorization: Bearer YOUR_MCP_AUTH_TOKEN
```

In production, the server returns `503` if `MCP_AUTH_TOKEN` is missing and `401` when the token is incorrect.

## Claude Code: local stdio, recommended for the local workspace

From the repository root:

```bash
claude mcp add --transport stdio mosang -- pnpm --dir /absolute/path/to/mosang server:start
```

Or add a project `.mcp.json` entry:

```json
{
  "mcpServers": {
    "mosang": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mosang", "server:start"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

Then open Claude Code in the project and run `/mcp` to confirm the server is connected. Start with read-only prompts such as “list my recent drafts.” Publishing tools only queue jobs; they do not perform external posting yet.

## Claude Code: remote Streamable HTTP

Once the API is deployed at `https://YOUR_API_DOMAIN`, configure the remote server with its MCP URL and bearer token:

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  mosang https://YOUR_API_DOMAIN/mcp
```

The exact option syntax can vary by Claude Code version; the important values are transport `http`/`streamable-http`, the HTTPS `/mcp` URL, and the Authorization header. Run `/mcp` and test `list_content`.

Anthropic’s MCP connector API uses a server definition like:

```json
{
  "type": "url",
  "url": "https://YOUR_API_DOMAIN/mcp",
  "name": "mosang",
  "authorization_token": "YOUR_MCP_AUTH_TOKEN"
}
```

The connector API supports Streamable HTTP and bearer authentication. It requires a publicly reachable HTTPS URL; it cannot connect directly to a local stdio server.

## Manus: custom MCP connector

In Manus, open the Integrations or Connectors area and choose the option to create a custom MCP connector/server. Enter:

- URL: `https://YOUR_API_DOMAIN/mcp`
- Transport: Streamable HTTP, if shown
- Authentication: Bearer token
- Token: the value of `MCP_AUTH_TOKEN`

Save the connector, complete any authentication prompt, and test with a read-only request such as “list recent M.O.S.A.N.G. drafts.” Manus documentation describes custom MCP servers as the route for internal tools and specialized databases. The exact UI labels may change, so use the connector’s custom MCP option rather than a prebuilt app connector.

Do not paste the token into a public prompt or commit it to the repository. Remove and rotate it immediately if exposed.

## Local API smoke test

Start the server:

```bash
MCP_AUTH_TOKEN=replace-with-a-long-random-value pnpm server:start
```

Then send an MCP initialize request with the bearer token:

```bash
curl -i https://YOUR_API_DOMAIN/mcp \
  -H 'Authorization: Bearer YOUR_MCP_AUTH_TOKEN' \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"0.1.0"}}}'
```

For a remote service, test with the deployed HTTPS URL, not `127.0.0.1`.

## Current limitation and next security step

The MCP tools currently use the process-wide database context and `workspaceId` arguments. They do not yet derive tenant identity from the authenticated MCP caller. Therefore, keep remote MCP single-user and protect it with a strong bearer token. Before opening MCP to multiple SaaS customers, add MCP OAuth or per-user short-lived tokens and pass the authenticated organization scope into every MCP tool query and mutation.

## Sources

- [Anthropic MCP connector](https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector)
- [Claude Code MCP configuration](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Manus custom connectors](https://help.manus.im/en/articles/12231777-how-can-i-use-manus-connectors)
- [Manus integrations](https://manus.im/docs/integrations/integrations)
