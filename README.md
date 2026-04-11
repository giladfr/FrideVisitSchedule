# Fride Visit Schedule

Infrastructure-first starter for a public family trip planning app.

## What is here

- Next.js app ready for Vercel
- simple public landing page
- `/api/status` endpoint for infrastructure checks
- Supabase client scaffolding
- environment template for local and Vercel setup

## Local setup

1. Copy `.env.example` to `.env.local`
2. Add the Supabase values when you create the project
3. Install dependencies
4. Start the app

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Planned services

### GitHub

- store the source code
- connect the repository to Vercel

### Vercel

- host the Next.js app
- manage deployment environment variables

### Supabase

- provide the Postgres database later
- optionally hold trip tables, events, and sync metadata

## Recommended first connection flow

1. Create the GitHub repository
2. Push this project
3. Create a Supabase project
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
5. Import the GitHub repository into Vercel
6. Confirm `/api/status` reports the services correctly

## Notes

- Authentication is intentionally omitted for now.
- The app is public by design in this first phase.
- The status page only checks whether expected environment variables are present.
