# Contributing to FaB Bazaar

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org) (v18+)
- A Discord application for OAuth login (see below)

### One-command setup

```bash
git clone <repo-url>
cd FaB-Bazaar
bash dev-setup.sh
```

The script will:
1. Check prerequisites
2. Generate all secrets and write `.env.local`
3. Walk you through Discord OAuth setup
4. Start Docker (postgres + redis)
5. Run all database migrations
6. Import card data (cards, printings, sets, curated lists, articles)
7. Install npm dependencies

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Discord OAuth setup

You need your own Discord application — do not share or commit credentials.

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it anything (e.g. `FabBazaar Dev`)
3. **General Information** tab → copy the **Public Key**
4. **OAuth2** tab:
   - Copy the **Client ID**
   - Click **Reset Secret** → copy the **Client Secret**
   - Under **Redirects**, add: `http://localhost:3000/api/auth/callback/discord`
   - Set **Default Authorization Link** scopes to: `identify`, `email`
5. **Bot** tab *(optional — only needed for bot/admin features)*:
   - Click **Reset Token** → copy the **Bot Token**
   - Enable **Privileged Gateway Intents**: Server Members, Message Content

The `dev-setup.sh` script prompts for these values and writes them to `.env.local`.

---

### What's in the local database

After setup your local database contains:

| Data | Source |
|---|---|
| Cards & printings | Seeded from `seeds/cards.sql.gz` |
| Ban lists | Seeded from `seeds/cards.sql.gz` |
| Published articles | Seeded (attributed to a placeholder user) |
| Published curated lists | Seeded (attributed to a placeholder user) |
| Approved venues/stores | Seeded (public fields only — no contact info) |
| User accounts | Empty — create your own by logging in via Discord |

---

### Common commands

```bash
npm run dev              # Start the dev server
npm run db:seed          # Re-run migrations + re-import card data
npm run db:dump-seed     # Regenerate seeds/cards.sql.gz from local DB (maintainers only)
npm run test             # Run all tests
npx vitest run           # Run tests once (CI mode)
```

### Picking up new migrations

After a `git pull` that includes new migrations, run:

```bash
npm run db:seed
```

`run-migrations.sh` tracks which migrations have already been applied and only runs new ones — it's safe to re-run at any time.

### Picking up a new card set

When a new FaB set is released and ingested, maintainers will regenerate and commit `seeds/cards.sql.gz`. After a `git pull`:

```bash
npm run db:seed
```

---

### Project structure

```
app/              Next.js App Router (pages, API routes)
components/       React components
lib/
  auth/           Authentication (NextAuth, multi-auth middleware)
  postgres/       Drizzle schema, migrations, DB connection
  services/       Service layer — all DB access goes through here
  fab-constants/  Card metadata (sets, foilings, rarities, heroes)
scripts/          Dev tooling (migrations, seed, backups)
seeds/            Compressed seed data for local setup
pipeline/         Card data ingestion (Python)
```

### Key rules

- **Never query the database directly** — use services from `@/lib/services`
- **Never run `npm run db:generate`** — migrations are written by hand; see `lib/postgres/migrations/`
- **Never commit `.env.local`** — it's git-ignored for a reason
- **Never hardcode secrets** — all config via `process.env.*`
- See `CLAUDE.md` for full architecture notes and gotchas
