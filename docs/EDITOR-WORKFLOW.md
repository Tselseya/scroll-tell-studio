# Editor workflow and AI provider configuration

## Editor capabilities

The editor now loads real workspace content from `GET /api/content`, supports opening an existing draft, creating a new draft, selecting status filters in the content library, attaching image/video/audio files, showing saved versions, restoring a previous version, and previewing the current copy against X, Threads, Instagram, Facebook, TikTok, and YouTube character limits and media expectations.

Uploads are stored in the local media vault. The default development path is `data/media`; production deployments must set `MEDIA_DIR` to a mounted persistent directory. The upload endpoint accepts image, video, and audio files up to 50 MB per file. It does not yet transcode, resize, scan, or publish media.

## Direct Claude selection

M.O.S.A.N.G. uses Anthropic's official OpenAI-compatible compatibility layer for the direct Claude option. Anthropic documents that this requires the Claude base URL, a Claude API key, and a Claude model name. Configure the server environment:

```env
CLAUDE_API_KEY=your-claude-console-key
CLAUDE_BASE_URL=https://api.anthropic.com/v1
CLAUDE_MODEL=claude-sonnet-4-6
```

Restart the API, open a draft, and select **Claude API** in the editor provider selector. The browser sends only the provider choice and model preference; the API key remains server-side. If the provider is not configured, the editor shows the provider error rather than silently falling back to another model.

The compatibility layer is appropriate for ordinary editorial chat and rewrites. Native Claude API integration should be added later if the product needs Claude-specific features such as native structured outputs, full thinking controls, or advanced content blocks.

## Manus selection and MCP

Manus is not exposed here as a synchronous model-provider dropdown because Manus is a complete AI agent and tool runner, not a conventional chat-completions endpoint. The editor therefore labels it **Manus via MCP** and disables the local chat box when selected. This avoids pretending that a Manus MCP connection can be called like a normal model API.

To use Manus with M.O.S.A.N.G.:

1. Deploy the API so the MCP endpoint is reachable over HTTPS.
2. Set a strong server value for `MCP_AUTH_TOKEN`.
3. Add the deployed endpoint in Manus under **Settings → Integrations → Custom MCP Servers**.
4. Use the endpoint:

   ```text
   https://YOUR_API_HOST/mcp
   ```

5. Configure bearer-token authentication with the same token.
6. Test the connection and allow Manus to see the M.O.S.A.N.G. tools.
7. In Manus chat, ask it to list drafts, create a draft, update a draft, create a platform variant, or queue a job.

The MCP route lets Manus operate on the same content workspace. It does not make Manus appear as an inline completion model inside the editor. If inline Manus-generated text is required later, implement a separate Manus API adapter that submits an agent task, tracks its task ID, and returns the completed result asynchronously. That is a different integration from MCP and should include explicit consent and job-status UI.

## Provider comparison

| Option | How it works | Best use | Current status |
|---|---|---|---|
| OpenAI-compatible | Server sends chat-completions request to `AI_BASE_URL` | Fast inline rewrite and chat | Available |
| Claude API | Server uses Anthropic's OpenAI-compatible endpoint with `CLAUDE_API_KEY` | Claude inline editorial work | Available |
| Manus via MCP | Manus calls M.O.S.A.N.G. tools from Manus chat | Agentic draft operations and workflows | Available through MCP, not inline model chat |

Never place any provider key in `VITE_*` variables or frontend source. Store keys only in the API environment and rotate them if exposed.
