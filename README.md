# Sovaio

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-087EA4?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Vercel AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-000000?style=for-the-badge&logo=vercel&logoColor=white)
![PostHog](https://img.shields.io/badge/PostHog-FF5C35?style=for-the-badge&logo=posthog&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)

Sovaio is a Next.js app for YouTube creators who want clearer sponsorship pricing and negotiation support from their own channel analytics.

Unlike simple rate card generators that only estimate prices from subscriber count or a few form fields, Sovaio builds reusable analytics snapshots from YouTube Studio CSV exports. Those snapshots carry through the product, so generated rate cards, deal tracking, and AI-assisted guidance can stay grounded in the creator's actual audience, geography, content performance, and saved sponsorship context.

Creators can save analytics snapshots, generate sponsorship rate cards, track brand deals, and use AI-assisted channel and negotiation guidance grounded in their saved data.

## Features

- YouTube Studio CSV upload flow for building reusable analytics snapshots.
- Analytics snapshot viewer with cleaned report data, confidence scoring, and summary context.
- AI-assisted sponsorship rate card generation based on creator analytics and sponsorship inputs.
- Saved rate cards with pricing ranges, explanation, improvement tips, and pitch email copy.
- Deal tracker for brand conversations, creator asks, brand offers, timelines, and notes.
- Deal Assistant for negotiation guidance and ready-to-send brand reply drafts.
- Channel Advisor for broader channel, audience, pricing, and sponsorship positioning questions.
- Supabase authentication, protected app routes, profile settings, avatar uploads, and account deletion.
- Onboarding checklist and contextual hints for first-time product setup.
- Markdown-powered blog content for public educational pages.

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
