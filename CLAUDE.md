# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-channel AI agent bot that analyzes RSS feeds, SEC filings, and weather data via LangGraph workflows backed by LLMs (Google Gemini, Ollama). Delivers reports through Telegram and Feishu/Lark. Monorepo using Bun workspaces, TypeScript, and an event-driven architecture.

## Essential Commands

```bash
# Development (runs the bot with hot-reload via Bun)
bun run dev

# Production
bun run start

# Lint and format
bun run lint
bun run format

# Run tests (only the SEC filing test exists)
bun test --timeout 60000
# Or with env vars stubbed:
SQLITE_DB_PATH=/tmp/test.db TG_BOT_TOKEN=t OLLAMA_MODEL_NAME=t TG_PERSONAL_CHAT_ID=0 GOOGLE_MODEL_NAME=t GOOGLE_API_KEY=t TG_NEWS_REPORT_THREAD_ID=0 TG_WEATHRE_THREAD_ID=0 TG_STOCK_THREAD_ID=0 TG_SEC_FILING_THREAD_ID=0 bun test --timeout 60000
```

Only one test file exists: `packages/agents/src/__tests__/xbrl-pipeline.test.ts`.

## Architecture

```
packages/
  bot/          Entry point — bootstraps channels + cron, then idle loop
  channel/      Message I/O: Telegram (Telegraf long-polling) + Feishu (Lark WS)
  cron/         Scheduled tasks via node-cron: RSS analysis, SEC filings, weather
  agents/       LangGraph StateGraph workflows: RSS, SEC Filing, Weather, Longbridge
  events/       In-process EventEmitter bus connecting commands → agents → channels
  function-tools/  LangChain tools: RSS parsing, Readability extraction, METAR/TAF, browser snapshots
  utils/        Shared: config (dotenv), SQLite (RSS subs), Winston logger, Longbridge client, helpers
```

### Startup Flow

1. `packages/bot/src/setup.ts` loads `.env.{NODE_ENV}`, then calls `bootstrapChannel()` and `startCron()`
2. `bootstrapChannel()` starts Telegram (Telegraf long-polling with supervisor auto-restart) and/or Feishu (Lark WebSocket), then registers the `channel:send_message` event listener
3. `startCron()` registers cron jobs for RSS (daily 8:12 GMT+8) and SEC filings (weekdays 7:00 AM ET)
4. `packages/agents/src/handlers.ts` wires `agent:rsssum` and `agent:sec` events to their respective agent runners

### Event Bus Pattern

All inter-module communication goes through `eventBus` (a plain Node.js `EventEmitter` from `@krobert/events`):

- **`channel:send_message`** — Agents and crons emit this with `{ targets: ChannelTarget[], messages: string[] }`. The listener in `message-channel.ts` routes to Telegram/Feishu senders.
- **`agent:rsssum`** — Telegram `/rsssum <category>` or Feishu menu/command triggers RSS agent.
- **`agent:sec`** — Telegram `/sec <symbol>` or Feishu command triggers SEC filing agent.

### Agent Design (LangGraph StateGraph)

All agents follow the same pattern:
- Define `AgentState` via `Annotation.Root()` with typed fields and a messages reducer
- Build a `StateGraph` with nodes → edges → compile
- Invoke with `app.invoke(initialState)`
- Each node reads/writes state fields; the final node emits `channel:send_message` to deliver results

**RSS Agent** (`rss-agent/`): `scraper` → `analyzer`. Scraper reads SQLite subscriptions, fetches/parses RSS feeds, filters by age (per-category TTL), and emits a raw feed list. Analyzer sends feed JSON to Gemini with a system prompt (`system-prompt-News.md` / `system-prompt-Blog.md`) and emits the AI-generated report.

**SEC Filing Agent** (`sec-filing-agent/`): `fetchFilings` → `extractSections` → `fetchXbrl` → `analyzer`. Fetches from SEC EDGAR (with per-domain rate limiting, retry+backoff), parses filing HTML to extract key sections (Item 1/1A/7/8 for 10-K, equivalents for 20-F/6-K/8-K), pulls XBRL company facts for financial metrics, then sends everything to Gemini for analysis with `system-prompt-extraction.md`.

**Weather Agent** (`weather-agent/`): `informationGathering` ⇄ `tools` (ToolNode loop). Uses Ollama with bound tools (CheckWX METAR/TAF, browser snapshots) in a ReAct loop.

### Channel Abstraction

`ChannelTarget` is a discriminated union: `{ channel: 'telegram', ... } | { channel: 'feishu', ... }`. The listener in `message-channel.ts` iterates targets and dispatches to the appropriate sender. Feishu supports three send modes: `message` (Markdown→rich text with table→card conversion), `plain_text`, and `card_template`.

### SEC EDGAR Client (`edgar-client.ts`)

- Per-domain rate limiting (data.sec.gov: 200ms, www.sec.gov: 600ms)
- Retry with exponential backoff for 429/503 responses
- Caches `company_tickers.json` ticker→CIK map in memory
- `buildFilingArchiveUrls()` constructs all URL variants from CIK + accession number
- Foreign issuer fallback: if no 10-K/10-Q/8-K found, tries 20-F/40-F/6-K

### SQLite (`rss-sub.ts`)

Stores RSS subscriptions with URL (UNIQUE), title, category, subscription_type. Used by both Telegram and Feishu `/rsssub` commands. Lazy-initialized via Proxy in `sqlite.ts`.

## Key Conventions

- **Runtime**: Bun only. Uses `bun:sqlite` for SQLite. `package.json` scripts use `bun run`.
- **Module resolution**: `"module": "ESNext"`, `"moduleResolution": "Bundler"`. Packages reference each other via `@krobert/*` workspace names.
- **Env files**: `.env.development` / `.env.production` loaded based on `NODE_ENV`. Required vars: `TG_BOT_TOKEN`, `GOOGLE_API_KEY`, `GOOGLE_MODEL_NAME`, `SQLITE_DB_PATH`, `TG_PERSONAL_CHAT_ID`, plus thread IDs.
- **LLM backends**: RSS and SEC agents use Google Gemini (`@langchain/google`). Weather agent uses Ollama. Model selection is in `common/model.ts` factories.
- **Logging**: Winston with console (colorized) + daily rotate files to `logs/`. Level controlled by `LOG_LEVEL` env var.
- **No framework**: This is a plain long-running process. PM2 ecosystem config is provided (`ecosystem.config.cjs`) for production deployment.
- **`import.meta.dirname`**: Used in SEC agent to resolve system prompt paths. Only works in Bun.
- **TypeScript project references**: Root `tsconfig.json` references all 7 packages. Each package has its own `tsconfig.json` with `composite: true`.
- **Paths are relative to CWD** (project root), not to source files. `SQLITE_DB_PATH` and log directories resolve from `process.cwd()`.
