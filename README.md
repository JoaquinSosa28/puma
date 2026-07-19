# PUMA — Procrastination Ultimate Management App

A calm, single-screen **personal life OS**: tasks, habits, goals, projects and
notes, tied together by an agenda, a memento-mori life calendar, and an AI
planner that turns a one-sentence intent ("run a half-marathon in 6 months")
into a structured goal → project → task plan.

Built with **Next.js 15** (App Router, React Server Components, Server Actions),
**TypeScript** (strict), **Tailwind CSS v4**, and **MongoDB**. Runs fully
in-memory with zero setup for local use, or against MongoDB Atlas with real
accounts for hosting.

- **Live:** [puma.joaquinsosa.dev](https://puma.joaquinsosa.dev)
- **License:** [MIT](LICENSE) — self-host it for free, forever.

## Features

- **Tasks & kanban** — quick-capture with `#tags`, priorities, subtasks, due
  dates (natural-language via chrono-node), and per-project boards.
- **Habits & streaks** — daily / weekly / monthly cadences with heatmaps.
- **Goals that compute** — progress rolls up automatically from linked projects
  and habit streaks.
- **Projects** — drag-and-drop kanban, per-project task detail.
- **Notes** — markdown, tags, pinning.
- **Agenda** — a live day timeline with routines, meetings, and honest "dead
  time" between them.
- **Life calendar** — every week of your life on one screen.
- **AI planner & assistant** — describe an ambition and review the generated
  plan graph before anything is created; ask questions about your own data.
  Bring your own Anthropic API key (stored encrypted).
- **Auto Personal/Work switch** — the sidebar view follows your working hours.

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In the default
`DATA_SOURCE=memory` mode the app boots with realistic sample data held in
process — **no database, no keys, no auth required.** Great for trying it or
developing UI.

## Running with MongoDB (real accounts)

For persistence and multi-user auth, point it at MongoDB (e.g. Atlas):

```bash
cp .env.example .env.local
# set DATA_SOURCE=mongodb, MONGODB_URI, MONGODB_DB, and BETTER_AUTH_SECRET
npm run db:setup      # create indexes + seed a demo user
npm run dev
```

- **Auth** is [Better Auth](https://better-auth.com) (email + password). It is
  only active in `mongodb` mode; `memory` mode stays authless for local dev.
- **Every record is scoped to a `userId`** — reads, writes and deletes all
  filter by the session user, so accounts are fully isolated.
- **AI features** are optional. Set `ANTHROPIC_API_KEY`, or let each user paste
  their own key in Settings (encrypted at rest with AES-256-GCM). Per-user
  daily quotas prevent runaway spend.

See [`.env.example`](.env.example) for every variable, including the optional
hosted-mode settings — all off by default for self-hosted installs.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) on :3000 |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Vitest) |
| `npm run db:setup` | Indexes + seed (MongoDB mode) |
| `npm run db:repair-refs` | Report/unlink dangling references |

## Architecture

- **Data layer** — a repository pattern behind `lib/db/<entity>.ts` that
  switches between `./memory/*` and `./mongo/*` on `DATA_SOURCE`. The rest of
  the app never knows which backend is live.
- **Server Actions** for every mutation, each validated with `zod` (`.strict()`)
  and scoped to the session user.
- **RSC-first** — pages fetch on the server; the client bundle stays small.
- **Security** — CSP/HSTS/frame headers, origin-checked server actions, and no
  secrets in the client bundle.

## Deploy

The repo ships a multi-stage [`Dockerfile`](Dockerfile) producing a small
Next.js standalone image, and a GitHub Actions workflow that runs the full
typecheck/lint/test/build gate before publishing to GHCR. Any reverse proxy
(Traefik, Caddy, nginx) can sit in front — set `BETTER_AUTH_URL` to your public
URL and `SERVER_ACTIONS_ALLOWED_ORIGINS` to your domain.

## Contributing

Issues and PRs welcome. Run `npm run typecheck && npm run lint && npm run test`
before opening a PR.
