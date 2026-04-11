# Fride Visit Schedule

Three-week Israel visit planner for June 3, 2026 through June 24, 2026.

## What is here

- public trip schedule UI with day segments instead of hourly slots
- password-only admin route at `/admin`
- Supabase-ready client scaffolding
- project-level Supabase MCP config in `.mcp.json`
- Vercel-ready Next.js app

## Current product shape

- everyone can view the schedule
- only one admin password is needed for editing mode
- no usernames and no full user auth system yet
- Google Calendar sync is intentionally deferred until after the UI and data model settle

## Environment variables

Copy `.env.example` to `.env.local` and fill in the missing values:

```bash
cp .env.example .env.local
```

Required next values:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_PASSWORD`

Optional:

- `NEXT_PUBLIC_GITHUB_REPO`

## Local development

```bash
npm install
npm run dev
```

## Routes

- `/` public visit planner
- `/admin` password-only admin mode
- `/api/status` infrastructure status

## Supabase MCP

This repo now includes a local `.mcp.json` entry pointing at:

- `https://mcp.supabase.com/mcp?project_ref=xjiiuhuagwsqepginkep`

If you want to authenticate that MCP server in another client, do it from the client that supports the MCP auth flow.
