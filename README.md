# Fride Visit Schedule

Three-week Israel visit planner for June 3, 2026 through June 24, 2026.

## What is here

- public trip schedule UI with day segments instead of hourly slots
- password-only admin route at `/admin`
- Supabase-backed event API scaffold with public suggestions and admin approvals
- project-level Supabase MCP config in `.mcp.json`
- Vercel-ready Next.js app

## Current product shape

- everyone can view the schedule
- only one admin password is needed for editing mode
- no usernames and no full user auth system yet
- non-admin visitors can suggest events for approval
- pending suggestions show as tentative for the suggester's person-filtered view
- admin can approve, edit, reject, drag, and delete events
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
- `/api/events` schedule read/create endpoint
- `/api/status` infrastructure status

## Supabase setup

This repo now includes the SQL setup file at:

- `supabase/schema.sql`

Apply that SQL in the Supabase SQL editor before expecting live persistence.

Important:

- the app currently falls back to demo data if the database schema is missing
- the app also falls back to demo data if the Supabase anon key is invalid
- public suggestions and admin approvals need a real project anon key, not a placeholder string

## Supabase MCP

This repo now includes a local `.mcp.json` entry pointing at:

- `https://mcp.supabase.com/mcp?project_ref=xjiiuhuagwsqepginkep`

If you want to authenticate that MCP server in another client, do it from the client that supports the MCP auth flow.
