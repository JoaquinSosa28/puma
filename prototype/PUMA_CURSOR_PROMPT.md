# P.U.M.A — Cursor Build Prompt (Next.js + MongoDB + TypeScript)

> Paste this whole file as the **first message** to Cursor's agent (or keep it open and `@`-reference it). It is the master prompt. The always-on conventions live in `.cursor/rules/puma.mdc`.

---

## 0 · HOW TO USE THIS PROMPT
You are building a production app from an existing **interactive HTML prototype**. Work in milestones (Section 9). After each milestone: typecheck, lint, run, and show me a diff summary before moving on. Ask before introducing any dependency or pattern not listed here. Do not scaffold the entire app in one shot — go milestone by milestone.

## 1 · ROLE & MISSION
You are a senior full-stack engineer. Rebuild **P.U.M.A (Procrastination Ultimate Management App)** — a personal life-management dashboard — as an idiomatic **Next.js 15 (App Router) + React 19 + TypeScript (strict)** app backed **only by MongoDB (Atlas)**. The result must match the prototype's UX and visual system, follow modern best practices, and be cleanly structured for future features (auth, multi-user).

**Rebuild, don't transplant.** The prototype is a single-file design component (custom runtime, inline styles, localStorage). Treat it as the **source of truth for UX, layout, copy, behavior, and design tokens** — NOT as code to copy. Reimplement everything with the stack below.

## 2 · SOURCE-OF-TRUTH FILES (read first, in this order)
1. `BUILD_SPEC.md` — product, data models, behaviors, build order, the "works out of the box" dealbreaker.
2. `PUMA.dc.html` — the working prototype. **This is the visual + interaction reference.** Read it fully:
   - Logic class `Component` = all state, seed data, and behaviors (omni parsing, streak math, day-%, kanban, project auto-%, tag filtering).
   - Template (between `<x-dc>`…`</x-dc>`) = layout, spacing, and the design tokens in the `<helmet><style>` block (CSS variables for light/dark).
   - Seed data in `seed()` = the realistic first-load content you must reproduce in `lib/seed.ts`.
3. `Dashboard.dc.html` (optional) — the approved static Home layout, same system.

Extract from the prototype: the **design tokens** (Section 7), the **data shapes** (Section 6), and the **exact behaviors** (Section 8). When in doubt about a behavior, the prototype's logic class is authoritative.

## 3 · PRODUCT SUMMARY
Spaces (sidebar): **Home, Tasks, Notes, Habits, Goals, Projects, Calendar**, plus **Tags** (sidebar section), **Settings**, and later **Stats/Insights, Mood, Weekly Review, Search**. A persistent **omni quick-add** box at top captures anything: defaults to a **Task due today**, parses inline `#tags`, `!priority`, and natural-language dates, and can be saved as Task/Habit/Goal/Note. Light + dark mode. Dense, power-user layout. **No setup wall** — seed realistic data + default tags on first run.

## 4 · TECH STACK — best tool per scenario (use these; ask before adding others)
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 App Router, React 19** | RSC for data-near rendering, Server Actions for mutations |
| Language | **TypeScript (strict)** | safety; infer types from Zod |
| DB | **MongoDB Atlas** via the official **`mongodb`** driver | "MongoDB only"; no ORM overhead. (Mongoose only if you later need lifecycle hooks — not now.) |
| Validation | **Zod** | one schema → runtime validation + inferred TS types; validate every Server Action input + every DB read boundary |
| Reads | **React Server Components** querying repositories directly | no client round-trips; fast first paint |
| Mutations | **Server Actions** + `revalidatePath`/`revalidateTag` | typed, colocated, no hand-written API for internal use |
| Instant UI | **React 19 `useOptimistic`** for toggles (task done, habit check, kanban move) | snappy feel the prototype has, without losing server truth |
| Client caching/search | **TanStack Query** *only* for the global search + any polling | keep it off the simple paths |
| Styling | **Tailwind CSS v4** with CSS variables mapped 1:1 from the prototype tokens | tokens already exist as CSS vars; Tailwind for ergonomics |
| Theming | **next-themes** (`attribute="data-theme"`, values `light`/`dark`) | matches prototype's `[data-theme]` token switch |
| UI primitives | **shadcn/ui** (Radix) — dialog, popover, dropdown, tabs, tooltip, switch | accessible, unstyled-ish, Tailwind-native |
| Toasts | **sonner** | matches prototype's toast + undo affordance |
| Drag & drop | **dnd-kit** | task reorder + kanban columns |
| Dates | **date-fns** | formatting, week math, streaks |
| NL date parsing | **chrono-node** | replaces the prototype's hand-rolled "friday 2pm" parser — more robust |
| Command palette (⌘K) | **cmdk** | the search/quick-jump the prototype stubs |
| Notes editor | **textarea + react-markdown (remark-gfm)** for preview; upgrade path = **Tiptap** | markdown per spec; keep simple first |
| Forms (settings) | **react-hook-form + @hookform/resolvers/zod** | only where real forms exist |
| URL state | **nuqs** | view/tab/filter/selected-day in the URL (shareable, back-button) |
| Charts (Stats) | **Recharts** | simple, good enough for insights |
| IDs | Mongo **ObjectId**, exposed as `string` in DTOs | standard |
| Auth (later) | **Auth.js (NextAuth)** | not now — seed a single `users` doc; gate behind `getCurrentUserId()` returning the seed user so multi-user is a later swap |

## 5 · ARCHITECTURE
```
app/
  (app)/                      # authed shell group
    layout.tsx                # Sidebar + Topbar + OmniBox + ThemeProvider + Toaster
    page.tsx                  # HOME (RSC: fetch all widgets' data in parallel)
    tasks/page.tsx
    notes/page.tsx  notes/[id]/page.tsx
    habits/page.tsx
    goals/page.tsx
    projects/page.tsx  projects/[id]/page.tsx
    calendar/page.tsx
    settings/page.tsx
    stats/page.tsx            # later
  api/search/route.ts         # only client-fetched endpoint (TanStack Query + text index)
  globals.css                 # token CSS vars (light + [data-theme=dark]) + base
components/
  shell/{Sidebar,Topbar,OmniBox,ThemeToggle,TagRail}.tsx
  tasks/{TaskRow,TaskList,TaskGroups,AddTaskInput}.tsx
  habits/{HabitRow,HabitHeatmap}.tsx
  notes/{NoteList,NoteEditor}.tsx
  goals/{GoalCard}.tsx
  projects/{ProjectCard,KanbanBoard,KanbanCard}.tsx
  calendar/{MonthGrid,DayCell,DayPanel}.tsx
  ui/                         # shadcn components
lib/
  mongodb.ts                  # cached client (global in dev to survive HMR)
  db/{tasks,habits,habitEntries,notes,goals,projects,tags,settings,users}.ts  # repositories
  schemas/*.ts                # Zod schemas + inferred types (one per collection)
  actions/*.ts                # 'use server' mutations, grouped by domain
  parse.ts                    # omni parser: #tags, !priority, chrono date, type detection
  date.ts                     # iso(), weekDates(), startOfWeek, streak(), bestStreak()
  metrics.ts                  # dayDonePercent, project auto-%, habit stats
  seed.ts                     # idempotent seed (mirror prototype seed())
hooks/  types/  scripts/seed.ts (run via tsx)
```
**Data flow:** RSC pages call repositories (`lib/db/*`) → return DTOs (ObjectId→string). Interactive islands are `'use client'` and call **Server Actions** (`lib/actions/*`). Optimistic updates via `useOptimistic`; server action persists + `revalidatePath`. Keep business math (streaks, %, parsing) in `lib/` so it's unit-testable and shared.

## 6 · DATA LAYER (MongoDB)
**Connection** (`lib/mongodb.ts`): single `MongoClient`, cached on `globalThis` in dev to survive HMR; read `MONGODB_URI` + `MONGODB_DB` from `.env.local`. Export `getDb()`.

**Collections & TS/Zod** (one schema file each; `z.infer` the types). Mirror `BUILD_SPEC.md` exactly:
`users, settings, tags, tasks, habits, habitEntries, notes, goals, projects, moods, reviews`.
- Store dates as `YYYY-MM-DD` strings for day-keyed data (tasks.due may add `THH:00`), ISO for timestamps — matches the prototype so streak/calendar math is unchanged.
- DTO rule: never leak `ObjectId`/`Buffer` to client — repositories map `_id` → `id: string`.
- **Indexes** (create in a `scripts/indexes.ts`): `tasks: {due:1}, {projectId:1}, {status:1}`, text index on `tasks.title`; `habitEntries: unique {habitId:1, date:1}`; `notes: text {title,body}`; `tags: unique {name:1}`.
- **Validation:** every Server Action parses input with the Zod schema before writing; every repository read validates/coerces at the boundary.

**Seeding** (`lib/seed.ts` + `scripts/seed.ts` run with `tsx`): reproduce the prototype's `seed()` content verbatim (same tags, tasks incl. project-linked ones, 6 habits with the same streak patterns, 3 goals, 4 projects, 3 notes, today's agenda). Idempotent: only seed if `users` is empty. This satisfies the **works-out-of-the-box dealbreaker**.

## 7 · DESIGN SYSTEM (extract from `PUMA.dc.html`, reproduce in Tailwind)
**Fonts:** Schibsted Grotesk (UI), JetBrains Mono (labels/numbers/meta) — load via `next/font/google`.
**Tokens → CSS vars in `globals.css`** (copy these exact values):
```
:root{ --bg:#faf9f7; --surface:#fff; --surface2:#fbfaf8; --border:#ece9e4; --border2:#f1efea;
  --ink:#1b1a18; --muted:#76716b; --faint:#a39e97; --faint2:#b3aea7; --hover:#f3f1ed; --chip:#f3f1ed; --shadow:rgba(0,0,0,.08); }
[data-theme="dark"]{ --bg:#161519; --surface:#1f1e23; --surface2:#1a191e; --border:#2d2b32; --border2:#262429;
  --ink:#f0eee9; --muted:#a9a49d; --faint:#827c74; --faint2:#6b655e; --hover:#26242b; --chip:#2a282f; --shadow:rgba(0,0,0,.4); }
```
Map these to Tailwind theme colors (`bg-surface`, `text-ink`, `border-border`, …).
**Space/accent colors** (constant across themes, oklch): primary/indigo `oklch(0.55 0.16 274)`; goals/violet `oklch(0.58 0.17 300)`; projects/blue `oklch(0.58 0.14 245)`; habits/green `oklch(0.6 0.13 155)`; notes/amber `oklch(0.7 0.12 70)`; tasks/coral `oklch(0.64 0.18 25)`. Use ` / <alpha>` for tints (e.g. chips at `/0.1`, hovers at `/0.18`).
**Shape:** cards radius 13px, inputs 8px; the **omni-box** is the signature element — 2px solid `--ink` border, 14px radius, `4px 4px 0 var(--shadow)` offset shadow. The **streak card** is black (`#1b1a18`) with a deliberately hard line ("Skip today and you're back to zero."). Habit history = 12–13px rounded dot cells; today cell has a 2px outline. Tag = mono pill + colored dot. Density is high; min font 12px.

## 8 · BEHAVIORS TO REPRODUCE (authoritative: prototype logic class)
- **Omni parse** (`lib/parse.ts`): extract `#tag` tokens (create tag if new, cycling the accent palette), `!high|!med|!low` priority, and a natural date via **chrono-node**; strip matched tokens from the title. Default type = **task**, default due = **today** when none parsed. Convert chips switch the target type (Task/Habit/Goal/Note). Show live parsed chips (tag pills + date) as the user types.
- **Tasks:** toggle done (sets `completedAt`, recomputes day-%), cycle priority, inline rename, delete (with **undo** toast), tabs Today/Upcoming/All, group by None/Tag/Project, add via input (same parser).
- **Day-done %** (`lib/metrics.ts`): `(tasksDoneToday + habitsDoneToday) / (tasksToday + habits)`.
- **Habits:** toggle a given date (presence in `habitEntries` = done); **current streak** = consecutive days ending today (or yesterday if today not done); **best streak** = longest run ever; month heatmap (last ~35 days), add/rename/archive.
- **Goals:** Personal/Professional split, progress ±5, rename, linked project chips.
- **Projects:** auto-% = done/total of linked tasks (fallback to stored); **kanban** columns from `task.status` `todo|doing|done`, move via action; add task scoped to the project.
- **Calendar:** month grid (Mon-start), prev/next/today, tasks placed by `due`, habit-completion dot per day; click a day → side panel lists/lets you add tasks for that day.
- **Tags:** clicking a tag filters lists app-wide; add tag from the rail; default tags seeded (`note, idea, work, health, finance, personal`).
- **Global:** dark-mode toggle (persist in `settings`), toasts + undo on create/delete, smooth view transitions, inline edit. ⌘K command palette + cross-everything search (Stats/Mood/Review come last).

## 9 · BUILD MILESTONES (do in order; acceptance criteria each)
- **M0 Scaffold:** Next 15 + TS strict + Tailwind v4 + ESLint/Prettier + shadcn init + `.env.local`. ✔ `pnpm dev` runs, typecheck clean.
- **M1 Data layer:** `mongodb.ts`, Zod schemas, repositories, indexes script, `seed.ts`. ✔ seed populates Atlas; a temp RSC can list tasks.
- **M2 Shell + theme:** `(app)/layout.tsx` Sidebar/Topbar/TagRail, tokens in `globals.css`, next-themes, fonts, sonner Toaster. ✔ nav + dark mode work; matches prototype chrome.
- **M3 Home (RSC):** all widgets reading real data (agenda, today tasks, habits w/ week + streak, goals, projects, latest notes, day-%, streak card) + the **OmniBox** working end-to-end (create task/note/habit/goal, parsing, toasts). ✔ parity with prototype Home.
- **M4 Tasks** · **M5 Notes** · **M6 Habits** · **M7 Goals** · **M8 Projects (kanban + dnd)** · **M9 Calendar** — one space per milestone, each with its interactions from Section 8. ✔ parity per space.
- **M10 Tags manager + Settings** (theme, defaults, manage tags/habits). 
- **M11 Extras:** Stats/Insights (Recharts), Mood, Weekly Review, global Search (⌘K + `/api/search`).
- **M12 Polish:** dnd everywhere intended, `useOptimistic` on all toggles, view transitions, empty states, keyboard shortcuts, a11y pass (focus, roles, contrast), loading/error states, basic tests for `lib/parse.ts`, `lib/date.ts`, `lib/metrics.ts`.

## 10 · CONVENTIONS
- Server Actions are the only mutation path for internal features; no REST for those. `'use server'` files in `lib/actions`, each returns `{ ok, data?, error? }`.
- Repositories are the only place that touch the driver. Pages/components never import `mongodb` directly.
- All inputs validated with Zod at the action boundary; never trust client data.
- Keep pure logic (parsing, dates, metrics) framework-free and unit-tested.
- Co-locate `'use client'` islands; keep pages server-first. Prefer `useOptimistic` over client stores; reach for zustand only if a genuinely client-only cross-component state appears.
- Tailwind for layout/spacing; use the CSS-var-backed tokens, not raw hexes. Accent oklch values as utilities or inline where needed.
- Strict TS: no `any`; DTOs typed; `id: string` everywhere client-facing.

## 11 · GUARDRAILS — ask before
- Adding any dependency not in Section 4.
- Introducing an ORM, a second datastore, or moving mutations to REST/tRPC.
- Changing the data shapes in `BUILD_SPEC.md` (they map to Atlas).
- Restyling away from the extracted tokens, or “improving” layouts beyond the prototype.

## 12 · DEFINITION OF DONE
Feature parity with `PUMA.dc.html` across all spaces; seeded + usable on first run with no setup; light/dark; typecheck + lint clean; pure-logic unit tests pass; Lighthouse a11y ≥ 95 on Home; `.env.example` + README (setup, seed, Atlas notes) written.
