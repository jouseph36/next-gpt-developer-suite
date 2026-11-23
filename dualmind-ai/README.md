# DualMind AI — deployment edition

A private-use, self-hosted Arabic-first web chat for OpenAI and Anthropic APIs.
This is a lightweight working deployment edition; the full original v1.0 ZIP has additional features (streaming and attachments).

## Run

- Node.js 20+
- Set `APP_PASSWORD` (20+ characters) and at least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- Run `node server.js`.
- Open http://localhost:3000.

The server holds API keys; the client never receives them.
The app stores chat history in the browser's localStorage; clear browser data to remove it.
Never commit real keys. Requests to providers may incur separate charges.

## Render setup

- Source repository: `jouseph36/next-gpt-developer-suite`
- Branch: `deploy/dualmind-ai`
- Runtime: Node
- Build command: `echo Ready`
- Start command: `node dualmind-ai/server.js`
- Environment: `NODE_ENV=production`, `APP_PASSWORD` (secret), plus the API keys added via Render dashboard.

Use Render Environment dashboard for secrets, not GitHub.
