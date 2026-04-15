---
name: fride-visit-schedule-api
description: Use this skill when you need to read, create, suggest, update, approve, reject, or delete events in the Fride Israel trip schedule through its external HTTP API. Works well for day-specific schedule lookups, person-filtered views, and event management from an OpenClaw agent.
---

# Fride Visit Schedule API

Use this skill when the user wants to interact with the Fride trip schedule directly instead of using the web UI.

## Required environment

Set these variables in the OpenClaw environment:

- `FRIDE_VISIT_API_BASE_URL`
  - example: `https://fride-visit-schedule.vercel.app`
- `FRIDE_VISIT_API_TOKEN`
  - this must match the site's `AGENT_API_TOKEN`

## Domain rules

### People

- `gilad`
- `yaara`
- `kids`

### Day segments

- `morning`
- `noon`
- `evening`
- `night`

### Event operations

- `create`: directly creates an approved event
- `suggest`: creates a pending suggestion with suggester identity
- `approve`: turns a pending event into an approved one
- `reject`: turns an event into rejected
- `update`: edits an existing event
- `delete`: removes an event

## API usage

Always send:

```bash
-H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN"
-H "Content-Type: application/json"
```

### Get events for one day

```bash
curl -s "$FRIDE_VISIT_API_BASE_URL/api/agent/events?date=2026-06-12" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN"
```

### Get events for a date range

```bash
curl -s "$FRIDE_VISIT_API_BASE_URL/api/agent/events?from=2026-06-03&to=2026-06-24" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN"
```

### Filter by person or status

```bash
curl -s "$FRIDE_VISIT_API_BASE_URL/api/agent/events?person=gilad&status=pending" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN"
```

### Create an event

```bash
curl -s -X POST "$FRIDE_VISIT_API_BASE_URL/api/agent/events" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "title": "ארוחת ערב עם המשפחה",
    "emoji": "🍽️",
    "date": "2026-06-12",
    "segment": "evening",
    "location": "רעננה",
    "attendees": ["gilad", "yaara", "kids"],
    "notes": "לקבוע שעה סופית"
  }'
```

### Suggest an event

```bash
curl -s -X POST "$FRIDE_VISIT_API_BASE_URL/api/agent/events" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN" \
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

### Update an event

```bash
curl -s -X PATCH "$FRIDE_VISIT_API_BASE_URL/api/agent/events/EVENT_ID" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "ארוחת ערב מעודכנת",
    "emoji": "🍽️",
    "date": "2026-06-12",
    "segment": "evening",
    "location": "רעננה",
    "attendees": ["gilad", "yaara", "kids"],
    "notes": "עודכן לפי בקשת המשפחה"
  }'
```

### Approve a suggestion

```bash
curl -s -X PATCH "$FRIDE_VISIT_API_BASE_URL/api/agent/events/EVENT_ID" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}'
```

### Reject a suggestion

```bash
curl -s -X PATCH "$FRIDE_VISIT_API_BASE_URL/api/agent/events/EVENT_ID" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"reject"}'
```

### Delete an event

```bash
curl -s -X DELETE "$FRIDE_VISIT_API_BASE_URL/api/agent/events/EVENT_ID" \
  -H "Authorization: Bearer $FRIDE_VISIT_API_TOKEN"
```

## Operating guidance

- Prefer `GET /api/agent/events?date=...` when the user asks about a single day.
- Use `suggest` when the user is proposing an event rather than commanding a confirmed change.
- Use `create` only when the user clearly wants the event added directly.
- Before approving or rejecting, read the event first when context is ambiguous.
- When updating an event, send the full event payload, not a partial patch.
- Surface API errors directly to the user when possible.

## Install into OpenClaw

Copy this folder to:

```bash
~/.openclaw/skills/fride-visit-schedule-api/
```

Then enable or load it in OpenClaw using its normal skills workflow.
