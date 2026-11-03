# CLAUDE.md — Boulder

Personal workout tracker (running + weightlifting) focused on visualizing progress. **Read `SPEC.md` before starting any feature** — it is the source of truth for the data model, metrics, screens, and build order.

## Stack
Vite + React + TypeScript (strict), Tailwind, Recharts, Supabase, Vitest, deployed on Vercel.

## Commands
<!-- Fill these in once the scaffold exists -->
- `npm run dev` — local dev server
- `npm test` — run Vitest
- `npm run lint` — lint
- `npm run build` — production build (must pass before committing)

## Project layout
- `src/lib/metrics.ts` — all derived-metric math (pace, 1RM, volume, Riegel). Pure functions only, no React, no Supabase.
- `src/lib/db/` — Supabase client and typed query functions. Components never call Supabase directly.
- `src/components/` — reusable UI
- `src/pages/` — Log, Progress, History, Settings
- `supabase/migrations/` — SQL schema migrations (never edit the DB by hand)

## Conventions
- TypeScript strict; no `any`.
- Store canonical units (miles, seconds, pounds); format only at display time.
- Dates: the `date` column is the day the workout happened. Use local dates, not UTC timestamps, for grouping by day/week. Weeks start Monday.
- Every function in `metrics.ts` gets unit tests, including edge cases.
- Mobile-first layouts; the Log screen must be usable one-handed.
- Keep dependencies minimal — ask before adding a new package.

## Workflow
- Work one build-order slice from `SPEC.md` at a time; propose a plan before writing code.
- Run tests, lint, and build before saying a slice is done.
- Commit after each working step with a clear message. Don't push without asking.
- Never commit secrets. Supabase keys go in `.env.local` (gitignored); keep `.env.example` updated.
- If the spec is ambiguous or seems wrong, ask rather than guess — and update `SPEC.md` when a decision is made.
