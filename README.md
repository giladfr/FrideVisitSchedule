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
- `AGENT_API_TOKEN` if you want to use the external agent API

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
- `/api/agent/events` token-auth external agent API

## External agent API

This project now includes a machine-friendly API for agents such as OpenClaw.

Authentication:

- send `Authorization: Bearer <AGENT_API_TOKEN>`

Main endpoints:

- `GET /api/agent/events?date=2026-06-04`
- `GET /api/agent/events?from=2026-06-03&to=2026-06-24`
- `GET /api/agent/events?person=gilad&status=pending`
- `POST /api/agent/events` with `operation: "create"` or `operation: "suggest"`
- `PATCH /api/agent/events/:id` to update an event
- `PATCH /api/agent/events/:id` with `{"action":"approve"}` or `{"action":"reject"}`
- `DELETE /api/agent/events/:id`

Example create request:

```bash
curl -X POST "$BASE_URL/api/agent/events" \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "title": "ארוחת ערב עם המשפחה",
    "emoji": "🍽️",
    "date": "2026-06-12",
    "segment": "evening",
    "location": "רעננה",
    "attendees": ["gilad", "yaara", "kids"],
    "notes": "לקבוע שעה סופית מול כולם"
  }'
```

Example suggest request:

```bash
curl -X POST "$BASE_URL/api/agent/events" \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "suggest",
    "title": "טיול קצר לים",
    "emoji": "🏖️",
    "date": "2026-06-14",
    "segment": "morning",
    "location": "חוף בהרצליה",
    "attendees": ["yaara", "kids"],
    "suggestedByName": "יובל",
    "suggestedByPerson": "gilad"
  }'
```

Valid `person` values:

- `gilad`
- `yaara`
- `kids`

Valid `segment` values:

- `morning`
- `noon`
- `evening`
- `night`

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
