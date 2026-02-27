# FaB Bazaar — Docker Deployment

## Architecture

Three containers, all on the same Docker network (`fab-bazaar_default`):

```
Internet
    │
    ▼
┌─────────────────┐
│  fabbazaar-nextjs│  :3000 (public)
│  Next.js 15      │
└────────┬────────┘
         │ internal Docker network
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐   ┌──────────────────┐
│fabbazaar-    │   │ fabbazaar-redis   │
│postgres      │   │ Redis 7           │
│PostgreSQL 16 │   │                   │
└──────────────┘   └──────────────────┘
```

- **nextjs** — the only container with a public-facing port (`0.0.0.0:3000`)
- **postgres** — accessible only within the Docker network and from the host machine at `127.0.0.1:5432` (for local dev tools)
- **redis** — accessible only within the Docker network and from the host machine at `127.0.0.1:6379` (for local dev tools)

The nextjs container reaches postgres and redis by their service names (`postgres:5432`, `redis:6379`) over the internal Docker network, not through the host.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- `.env.local` file in the project root (copy from `.env.example` and fill in values)

---

## Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Key variables to configure in `.env.local`:

```bash
# PostgreSQL
POSTGRES_USER=fabbazaar
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=fabbazaar_dev

# Redis
REDIS_PASSWORD=your-secure-password

# Auth
NEXTAUTH_SECRET=generate-with-openssl-rand-hex-32
AUTH_SECRET=same-as-nextauth-secret
JWT_SECRET=generate-with-openssl-rand-hex-32

# Discord OAuth (from https://discord.com/developers/applications)
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_PUBLIC_KEY=your-public-key
```

The following are automatically overridden by `docker-compose.yml` and do not
need to match your local values:

| Variable | Overridden to |
|---|---|
| `POSTGRES_URL` | Uses `postgres` service name |
| `REDIS_URL` | Uses `redis` service name |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

---

## Discord OAuth Setup

In the [Discord Developer Portal](https://discord.com/developers/applications),
add the following redirect URI to your application:

```
http://localhost:3000/api/auth/callback/discord
```

For a production deployment behind a real domain, replace `localhost:3000` with
your actual domain (e.g. `https://fabbazaar.com/api/auth/callback/discord`) and
update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` accordingly in `docker-compose.yml`.

---

## First-Time Setup

### 1. Create the persistent volumes

```bash
docker volume create fab-bazaar-re-main_postgres_data
docker volume create fabbazaar_redis_data
```

### 2. Start postgres and redis

```bash
docker compose --env-file .env.local up postgres redis -d
```

### 3. Run database migrations

With the postgres container running, apply your Drizzle migrations from the host:

```bash
npm run db:migrate
```

### 4. Build the Next.js image

```bash
docker compose --env-file .env.local build nextjs
```

### 5. Start everything

```bash
docker compose --env-file .env.local up -d
```

---

## Day-to-Day Commands

### Start all containers
```bash
docker compose --env-file .env.local up -d
```

### Stop all containers
```bash
docker compose down
```

### View logs
```bash
# All containers
docker compose logs -f

# Just Next.js
docker logs -f fabbazaar-nextjs

# Just postgres
docker logs -f fabbazaar-postgres
```

### Rebuild and restart Next.js after code changes
```bash
docker compose --env-file .env.local build nextjs && \
docker compose --env-file .env.local up nextjs -d --force-recreate
```

### Check container status
```bash
docker ps --filter "name=fabbazaar" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## Updating the App

After making code changes:

```bash
# Rebuild the image
docker compose --env-file .env.local build nextjs

# Restart with the new image (zero postgres/redis disruption)
docker compose --env-file .env.local up nextjs -d --force-recreate
```

Postgres and redis data persist across rebuilds via Docker volumes.

---

## Database Access (from host)

Since postgres is bound to `127.0.0.1:5432`, you can connect from the host
using any PostgreSQL client (psql, TablePlus, etc.):

```
Host:     127.0.0.1
Port:     5432
User:     fabbazaar
Password: (your POSTGRES_PASSWORD)
Database: fabbazaar_dev
```

Similarly, Redis is accessible at `127.0.0.1:6379` with your `REDIS_PASSWORD`.

---

## Production Considerations

Before going public, you should:

- [ ] Change all passwords (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, auth secrets)
- [ ] Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your real domain
- [ ] Remove postgres and redis `ports` bindings from `docker-compose.yml` (they're only needed for local dev tools)
- [ ] Put a reverse proxy (nginx, Caddy, Traefik) in front of the nextjs container to handle TLS/SSL
- [ ] Add the production domain to Discord's allowed redirect URIs
