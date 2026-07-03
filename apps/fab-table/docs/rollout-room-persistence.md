# Rollout runbook — room persistence across a graceful restart

**Goal:** a deploy of fab-table stops dropping live games. On a graceful restart
the process flushes room state to a small volume; the next process reloads it and
every device reconnects and replays — the game "freezes" for a beat, no loss.

**Who drives this:** the `fab-table-ops` agent (advisory — it never touches the
VPS; it prescribes commands and reads back what you paste). All commands below run
on the VPS in `/opt/fabbazaar`.

---

## Why this is low-risk

- **Inert by default.** Persistence only activates when `ROOMS_SNAPSHOT_PATH` is
  set (compose sets it to `/data/rooms.json`). Unset ⇒ today's pure in-memory
  behavior. A botched rollout leaves the feature *dormant*, never broken.
- **Crash-only preserved.** The snapshot is best-effort: an ungraceful kill/OOM
  just skips it and the next process starts empty — no correctness dependency.
- **Main site untouched.** No `nextjs` image/config change; the fab-table image
  and `/data` volume are self-contained (no DB, no Redis, no shared state).

## What changed

| Layer | Change |
|---|---|
| `lib/rooms.js` | `serialize()` (excludes live sockets) + `initial` rehydrate |
| `server.js` | boot-load snapshot; `SIGTERM`/`SIGINT` flush (`writeFileSync`) |
| `Dockerfile` | `mkdir -p /data && chown node:node /data` (fresh volume inherits node ownership) |
| `docker-compose.yml` | `ROOMS_SNAPSHOT_PATH: /data/rooms.json` + `fab_table_data:/data` volume |

---

## Preconditions

1. New fab-table image is built and pushed (the `deploy-fab-table.yml` workflow
   does this on a push touching `apps/fab-table/**`).
2. **The updated `docker-compose.yml` must be present on the VPS.** This is the
   one ordering subtlety — see the branch point below.

### Branch point: how the compose change reaches the VPS

- **(A) Committed to git (default).** Any push to `main` triggers the *main*
  `deploy.yml` — already true of **every** commit, not special to this one. It runs
  the full standard production deploy: backup, `git reset --hard origin/main` (lands
  the new compose file), DB migrations, rebuild+push `nextjs:latest`, `docker compose
  pull nextjs` + `up -d --no-deps nextjs` (recreates nextjs **only if** the rebuilt
  `latest` digest changed — app code here is unchanged, but this is not *guaranteed*
  to skip), and an unconditional `docker compose restart caddy`. So it's the routine
  deploy blast radius — no larger than any normal push, but **NOT inert**. After it
  finishes, recreate fab-table (Step 2) so it picks up the new volume+env: the two
  workflows share the self-hosted runner but have **no shared concurrency group**, so
  their order isn't guaranteed — the fab-table workflow may have recreated against the
  old compose before the file landed, which is why Step 2 is load-bearing.
- **(B) Out-of-band.** Edit `/opt/fabbazaar/docker-compose.yml` directly (add the
  `ROOMS_SNAPSHOT_PATH` env + `volumes: - fab_table_data:/data` + the top-level
  `fab_table_data:` volume), so nothing triggers the main pipeline. Reconcile with
  git later to avoid drift.

Either way, **verify the file on the VPS before recreating** (Step 1).

---

## Steps

### 1. Confirm the compose file on the VPS has the new config

```bash
cd /opt/fabbazaar
grep -n "ROOMS_SNAPSHOT_PATH\|fab_table_data" docker-compose.yml
```

✅ **Expect:** three hits — the env var, the service volume mount, and the
top-level `fab_table_data:` volume. If missing, resolve the branch point above
first; do **not** proceed.

### 2. Recreate only fab-table (with the new image, volume, and env)

```bash
# The deploy workflows already docker-login on this runner, so creds are cached.
# Do NOT run a bare `docker login ghcr.io` — with no -u/--password-stdin it hangs
# waiting for input. Only re-auth (via the workflow) if `pull` returns "unauthorized".
docker compose pull fab-table
docker compose up -d --no-deps fab-table
```

✅ **Expect:** `fabbazaar-fab-table` recreated. `--no-deps` guarantees no other
service is touched.

### 3. Confirm the volume is present and writable by the unprivileged user

```bash
docker exec fabbazaar-fab-table ls -ld /data
docker exec fabbazaar-fab-table sh -c 'touch /data/_wtest && echo WRITABLE && rm /data/_wtest'
```

✅ **Expect:** `/data` owned by `node`, and `WRITABLE` printed. (A *fresh* named
volume inherits the image's `node` ownership; Docker only seeds ownership when the
volume is **empty** — a pre-existing root-owned volume skips the seed, which is
exactly when the fix below is needed.)
❌ **If `Permission denied`:** the volume was created root-owned. Fix it, then
re-run Step 2:

```bash
VOL=$(docker volume ls -q | grep fab_table_data)   # resolves the project-prefixed name
docker run --rm -v "$VOL":/data alpine chown -R 1000:1000 /data   # 1000 = node
```

### 4. Health check

```bash
docker exec fabbazaar-fab-table node -e "fetch('http://localhost:8787/healthz').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))"
```

✅ **Expect:** JSON with `ok:true` and a `rooms` count. Note: `build` reports
`"latest"`, NOT a SHA (compose overrides `BUILD_SHA` with `${FAB_TABLE_VERSION:-latest}`
and the workflow never sets `FAB_TABLE_VERSION`), so it can't confirm which build
landed. To verify the running image, compare digests:
`docker inspect --format '{{.Image}}' fabbazaar-fab-table`.

### 5. REHEARSAL — prove survival with a throwaway game (do this before trusting it)

1. On a browser, open **https://play.fabbazaar.app**, start a table, and lock in a
   hero (optionally join from a phone camera to make it a real 2-seat game). Note
   the room URL. Leave the tab open.
2. Confirm the room is live:
   ```bash
   docker exec fabbazaar-fab-table node -e "fetch('http://localhost:8787/healthz').then(r=>r.json()).then(d=>console.log('rooms:',d.rooms))"
   ```
   ✅ **Expect:** `rooms: 1` (or more).
3. Trigger a graceful restart. `restart` is a faithful proxy — both it and the
   real deploy send SIGTERM (firing the flush) and both keep the named volume. The
   deploy's exact path recreates the container; to rehearse *that*, use
   `docker compose pull fab-table && docker compose up -d --no-deps fab-table` instead.
   ```bash
   docker compose restart fab-table
   ```
4. Inspect the logs:
   ```bash
   docker compose logs --tail=60 fab-table | grep -i "snapshot\|rehydrat"
   ```
   ✅ **Expect, in order:** `rooms snapshot written on shutdown ... "rooms":N`
   then `rooms snapshot found` / `rooms rehydrated from snapshot ... "count":N`.
5. Confirm state survived:
   ```bash
   docker exec fabbazaar-fab-table node -e "fetch('http://localhost:8787/healthz').then(r=>r.json()).then(d=>console.log('rooms:',d.rooms))"
   docker exec fabbazaar-fab-table sh -c 'wc -c </data/rooms.json'
   ```
   ✅ **Expect:** same `rooms` count as before; `rooms.json` non-empty.
6. Back in the browser: the table reconnects within a few seconds, hero + life
   intact. **This is the money check.**

If all six pass, real games will survive deploys. If any fail, real games are
unaffected (they behave like today) — diagnose with the agent before relying on it.

---

## Rollback (back to today's behavior)

`ROOMS_SNAPSHOT_PATH` is hardcoded in `docker-compose.yml` (not sourced from
`.env`), so it can't be toggled through the `FAB_TABLE_*` env path. The **durable**
rollback is to revert the commit in git and let the pipeline redeploy — a hand-edit
to `/opt/fabbazaar/docker-compose.yml` is silently reverted by the next `deploy.yml`
`git reset --hard origin/main`.

```bash
# In the repo, NOT on the VPS:
git revert <persistence-commit-sha> && git push
```

After redeploy, fab-table boots with `ROOMS_SNAPSHOT_PATH` unset ⇒ pure in-memory.
The volume can stay (harmless) or be removed later with `docker volume rm <name>`.
An emergency out-of-band compose edit + recreate works to stop it *now*, but treat
it as temporary and reconcile with git immediately, or the next main deploy undoes it.

---

## Notes for the agent

- Never connect to the VPS yourself — prescribe each command and interpret the
  pasted output against the ✅/❌ expectations above. Stop at the first mismatch.
- The container name is `fabbazaar-fab-table`; the compose service is `fab-table`.
- fab-table's port is **not** published to the host — use `docker exec … node -e fetch(…)`
  rather than a host `curl`.
- A restart drops SSE/WebRTC connections for ~1–5s; clients auto-reconnect (the
  display probes `/dump` to tell "table gone" from a blip). That reconnect window
  is the expected "freeze," not a bug.
- **On-disk contents:** `/data/rooms.json` now holds fabbazaar userIds (`members`)
  and display usernames (`presence`) — identity that was previously in-memory only.
  It's a `node`-owned file on the VPS-local volume, never exposed over HTTP, but
  note the change from the old fully-ephemeral posture.
