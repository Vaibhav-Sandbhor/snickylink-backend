# SnickyLink Backend

Node.js/Express + PostgreSQL (Prisma) + Redis + Socket.IO backend built to match the
`SNICKYLINK_Ready_To_Compile` frontend: Community, Chat, Snicks (gamification), Leaderboards, Profile.

## Stack
- **Express** — REST API
- **PostgreSQL + Prisma** — data + schema/migrations
- **Redis** — presence (online/offline) for chat
- **Socket.IO** — realtime chat, typing indicators, read receipts
- **JWT** — short-lived access tokens + rotating hashed refresh tokens
- **Zod** — request validation

## Setup

```bash
cd snickylink-backend
npm install
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL, JWT secrets
npx prisma migrate dev --name init
npm run seed                 # mission templates + demo couple + demo posts
npm run dev                   # http://localhost:4000
```

Demo login (created by seed): `luna@demo.snickylink.app` / `password123`
(paired with `atlas@demo.snickylink.app`, same password)

## Project layout
```
src/
  config/       env, prisma client, redis client
  middleware/   requireAuth, requireCouple, error handler
  routes/       one file per feature area
  services/     business logic, called by routes
  sockets/      Socket.IO chat namespace
  utils/        jwt, XP/level math
prisma/
  schema.prisma
  seed.ts
```

## Auth flow
1. `POST /api/auth/register` → creates user, returns `accessToken` (15m) + `refreshToken` (30d)
2. `POST /api/auth/login` → same, plus `coupleId` if already paired
3. `POST /api/auth/refresh` → rotates refresh token, issues a new pair
4. `POST /api/auth/logout` → revokes the refresh token

Attach `Authorization: Bearer <accessToken>` on every other request.
Refresh tokens are stored **hashed** in the DB so a DB leak alone can't be replayed.

## Couple pairing
- `POST /api/couple/invite` → generates a `SNICK-XXXXXX` invite code for the calling user
- `POST /api/couple/join { inviteCode }` → pairs the second user, returns a fresh access token carrying the new `coupleId`
- `GET /api/couple/me` → current pairing status

Most other endpoints require the caller to already be paired (`requireCouple` middleware).

## Endpoints by frontend section

**Community** (`/api/community`)
- `GET /posts?tab=For+you|Stories|Deep+talks&cursor=...` — cursor-paginated feed
- `POST /posts` — create a post (supports `isAnonymous`)
- `POST /posts/:id/vote { value: 1 | -1 }`, `DELETE /posts/:id/vote`
- `POST /posts/:id/comments { body }`
- `POST /posts/:id/save` — toggle save

**Chat** (`/api/chat`, + Socket.IO)
- `GET /messages?cursor=...` — history, cursor-paginated
- `POST /messages/read` — mark partner's messages as read
- Socket events: `chat:message`, `chat:typing`, `chat:read`, `presence:update`
  (connect with `io(URL, { auth: { accessToken } })`)

**Snicks** (`/api/snicks`) — the mission/gamification map
- `GET /` — lazily assigns today's daily/weekly/monthly/deep missions, then lists them
- `POST /:missionId/complete { method, payload? }` — verifies + awards XP, bumps streak and the relevant "pillar" (communication/connection/effort/trust)

**Leaderboards** (`/api/leaderboard`)
- `GET /?scope=city|country|global&timeframe=week|month|alltime`

**Profile** (`/api/profile`)
- `GET /` — level, XP progress to next level, streak, four pillars, partner info
- `PATCH /` — update couple name, theme (light/night), city/country

## Gamification model
- `MissionTemplate` — the catalog (daily/weekly/monthly/deep/location/emotional), each with an XP reward and a required verification method (self-report, photo upload, location check-in, or partner confirmation)
- `CoupleMission` — a template assigned to a specific couple on a specific day
- Completing a mission: logs an `XpLog` entry, adds XP to the couple, recalculates `level` (escalating curve, see `utils/leveling.ts`), updates `streak` (day-based), and nudges one of the four pillar scores
- Leaderboards read `couple.xp` for all-time, or sum `XpLog` entries in the last 7/30 days for weekly/monthly ranking — no separate cron job needed

## Notes
- No backend source was included in the uploaded frontend zip, so this was built to match the UI's data shapes (posts, snicks, leaderboard rows, profile pillars) rather than reverse-engineered from existing code.
- Wire up the frontend by pointing API calls at `http://localhost:4000/api` and the socket at `http://localhost:4000`.
