# Family Israel Visit Scheduler

## Project Status

This file now reflects the app as it exists today, not just the original idea.

The project is live and usable as a shared family trip site for the June 3, 2026 through June 24, 2026 visit to Israel.

## Current Product

### Public experience

- public shared trip site in Hebrew
- right-to-left layout
- mobile-friendly design
- desktop and mobile calendar views
- family member filtering
- shared events and person-specific events
- event details with title, emoji, location, notes, date, segment, and attendees
- suggestion flow for family and friends

### Admin experience

- password-based admin mode in production
- local admin bypass in development
- create, edit, delete, approve, and reject events
- drag-and-drop editing
- click empty slot to create a new event
- pending suggestions queue
- conflict detection for overlapping events

### Data and hosting

- Next.js app on Vercel
- Supabase-backed event storage
- production deployment on Vercel
- GitHub repo connected
- PWA support for adding to iPhone home screen

## Implemented Features

### Infrastructure

- GitHub repository created and connected
- Vercel project configured and deployed
- Supabase project connected
- production database schema created
- seed/demo event flow added for initial data population

### Schedule UI

- Hebrew interface copy
- RTL weekly calendar layout
- Sunday-first week structure for Israel
- out-of-range days shown grayed out
- week view
- day view
- full-trip view
- agenda-style week view available on both mobile and desktop
- responsive layout for phone, tablet, and desktop

### Events

- event creation
- event editing
- event deletion
- drag-and-drop movement between slots
- event emoji selection
- location support
- notes support
- attendee selection
- compact event cards
- attendee markers based on person emojis:
  - `👨` גלעד
  - `👩` יערה
  - `🧒` ילדים
- full-family events shown with grouped people emojis instead of a separate family icon

### Suggestions and approval flow

- non-admin users can suggest events
- suggestion captures who suggested it
- pending suggestions visible only where appropriate before approval
- admin can approve suggestions
- admin can reject suggestions
- admin can edit suggestions before approval

### Admin workflow

- dedicated admin page
- edit mode toggle
- drag-drop with visible drop targets
- optimistic UI for drag/drop so the board does not blank and reload
- conflict list in admin sidebar
- pending suggestion queue in admin sidebar

### Visual design

- Israel-themed gradient background
- smoother fixed background without scroll seam
- Israel flag accent in the hero
- custom favicon and app icons with calendar + Israeli flag theme + Star of David
- streamlined family-friendly Hebrew copy

### Mobile support

- mobile-safe modal and form layout
- mobile agenda week view
- agenda week view remains available in landscape
- PWA manifest and Apple touch icon
- can be added to iPhone home screen as `ביקור פרידאים`

## Decisions We Changed

These were in the original plan but were intentionally changed during implementation.

### Auth

Original idea:

- Supabase Auth or organizer login

Current implementation:

- simple password-based admin mode
- no full user account system

Reason:

- faster, cheaper, and enough for a family trip site

### Color coding

Original idea:

- person colors as the main family distinction

Current implementation:

- person emojis are the main visual language

Reason:

- friendlier and easier to scan in this family/trip context

### Calendar library

Original idea:

- FullCalendar

Current implementation:

- custom-built schedule UI in Next.js/React

Reason:

- easier to tailor to Hebrew, RTL, segmented day-parts, and the specific trip workflow

### Recurrence

Original idea:

- possible recurring event support

Current implementation:

- recurrence intentionally removed

Reason:

- not needed for this trip and not worth the added complexity

## Deferred / Not Implemented Yet

### Google Calendar sync

Not implemented yet.

Status:

- intentionally deferred

Reason:

- the schedule and admin workflow needed to stabilize first

### Maps integration

Not implemented yet.

Possible future addition:

- tap location to open Google Maps or Waze

### Notifications

Not implemented yet.

Possible future addition:

- reminders or day-of alerts

### Per-viewer privacy rules

Not implemented yet.

Current behavior:

- the site is designed as a practical shared family/friends schedule

## Current Data Model

### People

- `gilad`
- `yaara`
- `kids`

### Event fields in use

- `id`
- `title`
- `emoji`
- `date`
- `segment`
- `location`
- `notes`
- `attendees`
- `status`
- `suggestedByName`
- `suggestedByPerson`
- `createdAt`

### Event statuses

- `approved`
- `pending`
- `rejected`

## Current Hosting/Deployment Model

- GitHub for source control
- Vercel for production hosting
- Supabase for persistent event storage
- local development against the same cloud Supabase project

## What Is Working Well

- shared family schedule experience
- admin editing and approval flow
- Hebrew/RTL support
- mobile usage
- PWA installability
- low-friction family suggestion workflow

## Known Future Improvement Areas

- map links from locations
- richer admin editing panel
- comments when rejecting/changing suggestions
- better visual handling for very dense weeks
- optional Google Calendar import later

## Recommended Next Steps

If development continues, the best next items are:

1. Add map links for event locations
2. Improve the admin editor into a faster side panel / drawer workflow
3. Add optional comments on approval/rejection
4. Revisit Google Calendar import only after the above polish is done
