# Sovaio

Sovaio is a Next.js app for YouTube creators who want clearer sponsorship pricing and negotiation support from their own channel analytics.

Creators can upload YouTube Studio CSV exports, save them as reusable analytics snapshots, generate sponsorship rate cards, track brand deals, and use AI-assisted channel and negotiation guidance grounded in their saved data.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Supabase Auth, database, and storage
- OpenAI via the Vercel AI SDK and Responses API
- PostHog product analytics
- Tailwind CSS

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file with the required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
POSTHOG_HOST=
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Project Structure

- `app/` - App Router pages, layouts, middleware-protected app routes, and API route handlers.
- `components/` - Client-side product UI for uploads, rate cards, onboarding, deal workflows, and AI sidebars.
- `lib/` - Supabase clients, analytics context building, AI access checks, PostHog helpers, and shared business logic.
- `supabase/migrations/` - Database migration files included with this repo.
- `content/blog/` - Markdown blog content used by the public blog routes.

## Useful Commands

```bash
npm run lint
npm run build
```
