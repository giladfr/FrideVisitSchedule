# Family Israel Visit Scheduler

## Goal

Build a mobile-friendly web app for a three-week family visit to Israel that:

- shows the schedule for the whole family and each individual family member
- supports shared events and person-specific events
- can be viewed by family and friends from any device
- can be edited by the organizer from desktop and mobile
- syncs with Google Calendar so existing events become the base schedule
- stays low-cost and simple to host

## Recommended Stack

### Frontend and Hosting

- Next.js on Vercel
- Tailwind CSS for responsive UI
- FullCalendar for day, week, and agenda views with drag-and-drop

### Database and Auth

- Supabase Postgres
- Supabase Auth with magic link or Google sign-in

### Sync and Background Jobs

- Google Calendar API for read/write sync
- Vercel Cron or Supabase Edge Functions for periodic sync

## Why This Stack

- Vercel is a good fit for a Next.js app and has a generous free tier.
- Supabase is the simplest low-cost way to get Postgres, auth, and row-level security.
- FullCalendar already supports the hardest UI parts: calendar views, event resizing, drag-and-drop, mobile responsiveness, and recurring event support if needed later.
- Google Calendar integration is straightforward enough for an MVP if we start with one-way import and then add two-way sync carefully.

## Recommended Product Scope

### MVP

- public read-only shared schedule page
- private organizer login
- family member filters
- shared events and person-specific events
- day view, week view, and full-trip list view
- event details: title, description, location, date, time, attendees
- drag-and-drop editing
- import from one Google Calendar
- manual event creation and editing inside the app

### Phase 2

- two-way Google Calendar sync
- friend/relative-specific shared links
- color-coding by person
- map links for locations
- optional RSVP or notes from relatives

### Phase 3

- notifications or reminders
- offline-friendly mobile behavior
- duplicate/conflict warnings
- attachments or photo links

## Core User Roles

### Organizer

- full edit access
- connects Google Calendar
- creates and updates events
- assigns attendees

### Family Viewer

- sees all events or filtered events
- mobile-friendly access

### Friend/Relative Viewer

- read-only access to the shared schedule
- optional filtered view if you want to share only relevant events later

## Data Model

### Person

- id
- name
- role
- color
- is_family_member

### Event

- id
- title
- description
- location_name
- location_address
- start_at
- end_at
- all_day
- visibility
- source (`manual` or `google`)
- google_event_id
- last_synced_at

### EventAttendee

- id
- event_id
- person_id

### CalendarConnection

- id
- provider
- google_calendar_id
- refresh_token
- access_token
- token_expires_at

## Important Product Decisions

### Shared vs Personal Events

Each event should support one or more assigned people:

- if assigned to everyone, treat it as a shared family event
- if assigned to one person, treat it as a personal event
- if assigned to a subset, show it only for those people plus the combined family view

This is more flexible than having separate event types.

### Google Calendar Sync

Recommended rollout:

1. Start with one-way sync from Google Calendar into the app.
2. Let the app create additional manual events.
3. Add two-way sync only after the event model is stable.

This avoids early sync conflicts and keeps the MVP much simpler.

### Sharing Model

For the first version, use:

- private organizer dashboard
- public read-only trip page with optional secret URL

This is cheaper and faster than building a full permissions system on day one.

## Suggested Pages

### `/`

- trip overview
- today’s events
- quick filters by person

### `/calendar`

- day/week/month-like planning views
- drag-and-drop editing for organizer

### `/trip`

- full three-week timeline list

### `/event/[id]`

- event details
- directions link
- attendees

### `/admin`

- event management
- Google Calendar sync controls
- people management

## UI Notes

- default to a simple mobile-first design
- use person chips and color labels for filtering
- support sticky date headers in list view
- make location tap open Google Maps or Waze
- keep event cards compact but expandable

## Cost Estimate

For an app like this, the likely MVP cost can be:

- Vercel: free
- Supabase: free
- Google Calendar API: free within normal personal usage

This should stay free unless traffic or database usage becomes unusually high.

## Technical Risks

### Two-way Sync Complexity

Google sync is the main area where apps get messy. Conflicts can happen if:

- an event is edited in both places
- an event is deleted in one system
- attendees differ between app and calendar

For that reason, MVP should treat Google as the source of imported base events and keep app-created events separate until phase 2.

### Permissions

If friends can only view, a secret shared URL is enough for MVP. If later you want per-person private events hidden from outsiders, we should add authenticated viewer roles and event visibility rules.

## Best MVP Build Order

1. Scaffold Next.js app on Vercel
2. Add Supabase schema and auth
3. Add people and event CRUD
4. Add calendar UI with filters
5. Add public shared trip page
6. Add Google Calendar import sync
7. Polish mobile UX

## Recommendation

The best first version is:

- Next.js on Vercel
- Supabase for database and auth
- FullCalendar for the interactive scheduler
- Google Calendar one-way sync first

That gives you a practical, low-cost system we can build quickly without locking ourselves into a fragile architecture.

## Next Step

If we continue, the next implementation step should be to scaffold:

- Next.js app router project
- Supabase integration
- initial schema for people, events, and attendees
- calendar page with mock data

That will give us a working shell before we connect Google Calendar.
