# P.U.M.A — Procrastination Ultimate Management App

Personal life-management dashboard rebuilt from the HTML prototype as **Next.js 15 + React 19 + TypeScript**.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app seeds realistic demo data in memory on first load — no database setup required.

## Stack

- **Next.js 15** App Router, React Server Components, Server Actions
- **In-memory store** (demo) with repository layer ready for MongoDB Atlas
- **Tailwind CSS v4** + design tokens from the prototype
- **next-themes**, **sonner**, **nuqs**, **zod**, **chrono-node**, **date-fns**

## Spaces

Home · Tasks · Notes · Habits · Goals · Projects · Calendar · Settings

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (`lib/parse`, `lib/date`, `lib/metrics`) |
| `npm run lint` | ESLint |

## Environment

```env
DATA_SOURCE=memory          # demo (default)
MONGODB_URI=...             # phase 2: Atlas connection string
MONGODB_DB=puma
```

## MongoDB migration (phase 2)

1. Implement `lib/mongodb.ts` with cached `MongoClient`
2. Set `DATA_SOURCE=mongodb` in `.env.local`
3. Run seed + index scripts against Atlas
4. Repositories switch data source — no UI changes needed

## Prototype reference

Original interactive prototype lives in [`prototype/PUMA.dc.html`](prototype/PUMA.dc.html).
