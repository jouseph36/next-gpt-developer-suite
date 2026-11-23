# DualMind AI

A minimal **independent**, Arabic-first web app that uses the official OpenAI Responses and Anthropic Messages APIs. It is **not** the proprietary ChatGPT or Claude source code and does not replicate all their features.

## Start

Requires Node.js 20+. No npm dependencies.

```bash
cp .env.example .env
# Edit .env with your own OPENAI_API_KEY and/or ANTHROPIC_API_KEY
npm start
```

Then open `http://localhost:3000`. If `APP_PASSWORD` is set, enter it in the app settings before chatting. Production requires a password of at least 20 characters.

The Render service uses the `deploy/dualmind-ai` branch and starts `node dualmind-ai/server.js` from the repository root. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in the service's Environment page and select **Save and deploy**. Use both keys to compare providers.

Features: streaming, provider/model switching, side-by-side model comparison via parallel replies, image/PDF upload, browser-only IndexedDB chat history, local import/export, optional provider web-search API tools, mobile RTL design.

Limitations: not a full ChatGPT/Claude clone; no native mobile client, realtime voice, image generation, agent execution, third-party account integrations, shared/multiuser server data, or automated backup. Uploaded attachments are not replayed to provider in subsequent messages. API fees and provider account credentials are separate from ChatGPT or Claude subscriptions. See `README_AR.md` for full Arabic instructions, Render setup, security and privacy notes.

```bash
npm test
```

MIT license for this independently written scaffold.
