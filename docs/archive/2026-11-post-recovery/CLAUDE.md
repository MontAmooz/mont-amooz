# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**مُنت‌آموز** (اُپن‌اُدیو گیت) is a Persian/RTL, GitHub-inspired collaborative platform for Iranian school handouts (pamphlets), now evolving into a comprehensive teaching marketplace.

**Current Status**: Phase 2 MVP complete - includes both Pamphlet Hub and Teaching Marketplace features.

**Core Mission**: Create the free, community-curated layer of supplementary educational content that complements the official national curriculum. Teachers upload handouts; the community rates, reviews, and improves them. Future phases include live online classes, recorded courses, an exam builder, and AI tutoring.

## Project Quick Start

```bash
# Install dependencies
bun install

# Start development server — NOTE: ./start.sh does NOT exist in this checkout (stale reference).
# Use: bun run dev  (and for classroom: cd mini-services/classroom-service && bun run dev)
# See docs/DEVELOPMENT.md for the authoritative setup steps.
# Frontend: http://localhost:3000
# Mini-services classroom-service: http://localhost:3003

# Or run directly
bun run dev

# Run linter
bun run lint

# Lint clean (force delete generated files)
bun run lint clean
```

**Note**: This is a Next.js 16 App Router project adapted to a single-route SPA structure with hash routing (`#page`, `#/pamphlet/{id}`, etc.). The project uses **Prisma ORM with SQLite** in development (normally PostgreSQL).

## Development Database (Sandbox)

This sandbox uses SQLite for the development database:
- **Database file**: `db/custom.db`
- **Schema**: `prisma/schema.prisma` (pushed to local SQLite)
- **Seed data**: `prisma/seed.ts` - includes 7 demo users (password: `123456`), 14 pamphlets, 29 open slots, 5 courses, and various test data

### Key Demo Accounts

All passwords: `123456`
- `montajebii@montamooz.ir` (محمدرضا، founder)
- `ali.rezaei@montamooz.ir`
- `z.ahmadi@montamooz.ir`
- `s.mohammadi@montamooz.ir`
- `m.karimi@montamooz.ir`
- `f.hosseini@montamooz.ir`
- `hossein@montamooz.ir`

**Maintenance**: Run `bun prisma/seed.ts` after major schema changes to reset test data.

## Project Architecture

### Tech Stack (Current Sandbox Adaptation)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS 4 | App Router, single visible route SPA with hash routing |
| **Database** | Prisma ORM + SQLite | Normally PostgreSQL 16 with pg_trgm full-text search |
| **Auth** | HMAC-signed session token | Stored in httpOnly cookie `oeg_session` |
| **Real-time** | Socket.io | Mini-service at port 3003 (classroomService) |
| **Styling** | Tailwind CSS 4 | Brutalist aesthetic, RTL-first |

### Directory Structure

```
.
├── src/
│   ├── app/                     # App Router handlers
│   │   ├── api/v1/               # REST API endpoints
│   │   │   ├── auth/            # Authentication handlers
│   │   │   ├── pamphlets/       # Handout CRUD + forks
│   │   │   ├── reviews/         # Reviews + votes
│   │   │   ├── merge-requests/  # Pull requests workflow
│   │   │   ├── wallet/          # Wallet + transactions
│   │   │   ├── market/          # Teacher marketplace
│   │   │   ├── teachers/        # Teacher profile + slots
│   │   │   ├── slots/           # Teaching slots management
│   │   │   ├── sessions/        # Class sessions CRUD
│   │   │   ├── courses/         # Video course CRUD
│   │   │   ├── lessons/         # Course lesson management
│   │   │   └── learn/           # User learning progress
│   │   ├── layout.tsx           # Root layout (RTL, fonts)
│   │   ├── page.tsx             # SPA shell + route dispatch
│   │   └── globals.css          # Global styles + brand tokens
│   ├── components/edu/           # Core application components
│   │   ├── router.ts            # Hash routing logic (useHashRoute)
│   │   ├── store.ts             # Zustand global state (auth/session)
│   │   ├── hooks.ts             # useFetch, useDebounced
│   │   ├── bits.tsx             # InitialsAvatar, LogoMark, ErrorBox, etc.
│   │   ├── crud/                # CRUD components (not yet implemented)
│   │   ├── home-view.tsx        # Home page with search & filters
│   │   ├── pamphlet-card.tsx    # Pamphlet display card
│   │   ├── pamphlet-view.tsx    # Single pamphlet + history + reviewers
│   │   ├── create-view.tsx      # Multi-step pamphlet creation wizard
│   │   ├── edit-view.tsx        # Author-only version publishing
│   │   ├── request-detail-view.tsx  # Merge request diff & review
│   │   ├── market-view.tsx      # Teaching marketplace
│   │   ├── book-view.tsx        # Slot booking flow
│   │   ├── classroom-view.tsx   # Live virtual classroom (socket.io)
│   │   ├── sessions-view.tsx    # Student & teacher session list
│   │   ├── courses-view.tsx     # Course listing + filters
│   │   ├── course-view.tsx      # Course detail + locked lessons
│   │   ├── learn-view.tsx       # Enrolled course list + progress
│   │   ├── learn-player-view.tsx # Video player + notes
│   │   ├── teach-view.tsx       # Teacher panel (slots, courses)
│   │   └── wallet-view.tsx      # Wallet + deposits
│   ├── lib/
│   │   ├── client.ts            # API fetch helper (api<T>)
│   │   ├── types.ts             # Shared TypeScript types
│   │   ├── constants.ts         # GRASSES, SUBJECTS, METHODS, etc.
│   │   ├── format.ts            # Persian formatters (faNumber, faDate, etc.)
│   │   ├── db.ts                # Prisma client setup
│   │   ├── auth.ts              # Server-side auth utilities
│   │   └── diff.ts              # Line diff logic for MRs
│   └── actions/                 # (Future: server actions)
├── mini-services/classroom-service/  # Socket.io real-time classroom
│   ├── package.json
│   └── index.ts                 # Socket handler (port 3003)
├── prisma/
│   ├── schema.prisma            # Database schema (User, Pamphlet, Wallet, etc.)
│   └── seed.ts                  # Demo data generator
├── public/
│   ├── videos/                  # Course video assets
│   └── courses/                 # Course cover images
├── db/                          # SQLite database (development)
├── upload/                      # Source docs from original (archived)
└── worklog.md                   # Detailed task/work log
```

### Data Models (Prisma Schema)

**User**: Authentication, profile, expertise tags
**Pamphlet**: Handout repository (fork lineage tracked via `forkedFromId`)
**PamphletVersion**: Version history with markdown content
**Review**: Reviews with helpful/unhelpful voting
**MergeRequest**: Pull requests with diff + review status
**Wallet**: User wallet with transactions
**TeacherSlot**: Scheduled teaching slots
**ClassSession**: Booked sessions with progress
**VideoCourse**: Video course catalog with lessons
**LessonProgress**: Student watch progress

**Key Convention**: Fork lineage created via `POST /pamphlets/[id]/fork` → copies taxonomy + latest content, name suffixed with " (فورک)".

### API Architecture

- **Base path**: `/api/v1`
- **Session auth**: Via `oeg_session` httpOnly cookie
- **Error handling**: Persian error messages with structure `{error: string}`
- **Pagination**: Cursor-based not used; use `page` + `pageSize` params (default 12, max 48)

### Supported Persian Content Localization

- **Font stack**: Vazirmatn (primary), JetBrains Mono (monospace/text), Darker Grotesque (fallback)
- **Date/number formatting**: Punycode-folds digits (faNumber), Jalali dates (Intl `fa-IR`), Persian words for months
- **Normalization**: `normalizePersian()` replaces ي with ی, strips ZWNJ/diacritics
- **Search**: LIKE queries with normalized Persian text on `title/description/subject/chapter/content`
- **Direction**: `dir="rtl"` on all pages and content containers, hover chevrons reversed

## Development Guidelines

### Creating New Views

Views are exported as default exports from `.tsx` files and consumed by `src/app/page.tsx`. Key patterns:

```typescript
// router.ts defines routes like #/pamphlet/{id}
// page.tsx switches on hash and renders the matching component export

<HomeView />
<PamphletView id={id} />
<MarketView query={params} />
```

### State Management

- **Use Zustand** for global session/auth state: `src/components/edu/store.ts`
- **Local state** with `useState` for view-specific data
- **Server state** via `useFetch` hook: `src/components/edu/hooks.ts`
- **No server actions**: All API calls via `api<T>()` client function

### API Communication

Use the centralized `api<T>()` helper:

```typescript
import { api } from '@/lib/client'

// GET list
const { data } = await api<PamphletSummary[]>('/pamphlets', { params: { grade: '10' } })

// POST create
await api<{id: string}>('/pamphlets', { method: 'POST', body: { title, ... } })

// GET single
const { detail } = await api<PamphletDetail>(`/pamphlets/${id}`)
```

**Error handling**: Persian messages extracted from `{error}` response or fallback per-status.

### Real-time Classroom

**Client connection pattern** (must be patched through gateway):

```typescript
import io from 'socket.io-client'

const socket = io("/?XTransformPort=3003", {
  auth: { ticket },
  transports: ['websocket'] // websocket-polling fallback
})

// Verify ticket in classroom-service/index.ts (independent of src/)
socket.on('room:welcome', ({ snapshot, members }) => { /* ... */ })
```

**Events**:
- `chat:relay` (client → server → broadcast) → `chat:new` (others)
- `board:stroke` → broadcast `board:stroke`
- `board:clear` → broadcast `board:cleared`
- `board:undo` → broadcast `board:undo{uid}`

### Styling Conventions

- **Brand palette**: Primary #DD614C (terracotta), Secondary #DAA144 (gold), Text #111827, Success #16A34A, Warning #D97706, Danger #DC2626
- **Border radius**: 0 (brutalist, sharp corners)
- **Typography**: Vazirmatn for UI, JetBrains Mono for code/math, Darker Grotesque for fallback
- **Layout**: RTL-first, sticky footer (`min-h-screen flex flex-col + mt-auto`), responsive mobile drawer

**Do not add blue/indigo colors** - this project uses a distinct warm color scheme.

### Testing Patterns

- **Backend**: Use Swagger/OpenAPI at `http://localhost:8000/docs` for manual testing
- **Frontend**: E2E verified in headless browser (VLM screenshots), runs `bun run lint` clean
- **Multi-session tests**: Use isolated browser windows/tabs for classroom socket testing (via Caddy gateway)

### Prisma Schema Management

**Development workflow**:

```bash
# Push changes to SQLite
bun prisma db push --accept-data-loss

# Generate client
bun prisma generate

# Reset and re-seed
bun prisma migrate reset --force
bun prisma/seed.ts

# Verify
bun prisma studio  # Visual DB explorer
```

**IMPORTANT**: Modified schema requires re-running `bun prisma/seed.ts` after each push to restore test data.

## Worklog Reference

The detailed worklog has been archived to `docs/archive/2026-10-pre-reconciliation/worklog-legacy.md` (PROMPT 1, 2026-10-30). Original reference: the worklog with task breakdowns covered:

- **Phase 1**: Pamphlet Hub (auth, CRUD, forks, MRs, reviews, contributions calculation)
- **Phase 2**: Teaching Marketplace (wallet, slots, sessions, courses, live classroom)
- **Key conventions documented**: API contracts, URL patterns, file ownership (backend vs frontend ownership), contribution scoring algorithm

When adding features, refer to the existing patterns in worklog entries for consistency.

## Documentation & Decisions (added 2026-10-30)

**Read `docs/DECISIONS.md` + `docs/adr/` before proposing changes.**

- Canonical docs now live in `docs/`: ARCHITECTURE (as-built), DECISIONS (index of 8 ADRs), ROADMAP, DEVELOPMENT, GIT-STRATEGY, DEPLOYMENT, BRAND, CODE_OF_CONDUCT. Root `README.md`, `SECURITY.md`, `CHANGELOG.md` added.
- The original planning docs (FastAPI/PostgreSQL/MinIO stack) are archived read-only in `docs/archive/2026-10-pre-reconciliation/` — do not treat them as current truth.
- When in doubt about stack choices, see the ADRs — **do not silently diverge.** To change a decision, write a new ADR and mark the old one SUPERSEDED.
- Agents/CLAUDE note: `upload/` no longer exists (archived); `worklog.md` is now `docs/archive/2026-10-pre-reconciliation/worklog-legacy.md`.

## Known Gaps & Future Phases

- **Phase 3**: Real file upload (PDF/LaTeX → MinIO), full-text search engine (Meilisearch)
- **Phase 4**: AI assistant (fine-tuned LLM), exam builder, WebRTC video/voice
- **Production security**: Change PostgreSQL `trust` auth to `scram-sha-256`, use strong SECRET_KEY, use proper secret management (Vault/K8s Secrets)
- **Real payment gateway**: Current wallet deposit uses mock Zarinpal-like UI
- **Kubernetes**: Dev uses Docker Compose; production would use Kubernetes with MinIO, PostgreSQL replicas, etc.

## Common Development Tasks

### Reset Development Database

```bash
bun prisma migrate reset --force
bun prisma/seed.ts
```

### Start Development Server

```bash
# Via start.sh (recommended - sets up db, bridge, mini-services)
./start.sh

# Or manual:
bun run db:push
NODE_ENV=production bun .next/standalone/server.js
bun --hot mini-services/classroom-service/index.ts  # Separate terminal
```

### Run Linter with Clean

```bash
bun run lint clean  # Deletes .next/dev/cache/.next/standalone
bun run lint
```

### Verify Browser E2E

1. Open two browser windows/tabs
2. Log in as `montajebii@montamooz.ir` and `hossein@montamooz.ir`
3. Navigate to classroom session MT4G8S (e.g., `#/session/MT4G8S`)
4. Test live chat + whiteboard in both sessions
5. Check console for errors

## Code Ownership Conventions

From worklog.md:
- **Backend files**: `src/app/api/**` (Task 2-a / 6-a)
- **Frontend view files**: `src/components/edu/*.tsx` (Task 2-b / 6-b)
- **Shared libs**: `src/lib/{constants,types,format,diff,auth}.ts` (Task 1 / 5)
- **Do NOT modify**: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (stable boundary)

New features should follow existing file ownership patterns.

## Development Environment Notes

- **Platform**: This is a sandbox adaptation of the planned FastAPI/PostgreSQL/MinIO/Next.js stack, using SQLite and running entirely in Node.js/Bun
- **Prerequisites**:
  - Bun runtime (`bun install`)
  - Node.js (if not using Bun)
  - Git version control
- **Running classroom-service**: `bun --hot mini-services/classroom-service/index.ts` (port 3003)
- **Caddy gateway**: Handles WebSocket forwarding via `XTransformPort=3003` (for browser WebSocket tests)

---

**Last Updated**: 2026-10-23
**Base Stack Decision**: Next.js 16 App Router + TypeScript + Tailwind CSS + Prisma + SQLite (sandbox adaptation of planned PostgreSQL/FastAPI stack)