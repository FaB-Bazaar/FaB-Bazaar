# fab-table — webcam play for FaB Bazaar

Play Flesh and Blood over webcam: QR stickers inside sleeves (printed from any
fabbazaar.app deck page → More → QR sticker sheet), a phone as the playmat
camera, and a live table HUD that identifies cards as they're played. Video is
peer-to-peer WebRTC; this service only relays small JSON game events.

**Deliberately boring:** no framework, no database, one dependency. Rooms live
in memory (bounded buffers, TTL-swept), sessions are HMAC-signed cookies, and
the process is crash-only — safe to kill at any moment. Identity comes from
fabbazaar's OAuth server; card data comes from fabbazaar's public printing API
(cached immutably). Deploys are isolated from the main app by a path-filtered
workflow, and the container is hard-capped (256MB / 0.5 CPU) so a runaway can
only ever OOM itself.

## Architecture

```
phone (camera page) ──getUserMedia + zxing-wasm──> QR detections
   │  POST /api/rooms/:id/events?pair=<token>          │ WebRTC (P2P video)
   ▼                                                   ▼
fab-table relay ──SSE──> desktop (display page: HUD, hover targets, splash)
   │
   └──> fabbazaar.app  (OAuth identity · /api/printings/:id card data)
```

- **Roles**: `/r/:id` is the display (sign-in required, seats assigned by the
  server); `/r/:id/cam?pair=…` is a camera (authenticated by the pairing token
  from the QR shown on the display — phones never see a login screen).
- **Errors are verbose by design**: every error response carries `code`,
  `requestId`, and `context`; logs are structured JSON lines with full stacks
  and cause chains. `GET /healthz` reports build/uptime/rooms/rss;
  `GET /api/rooms/:id/dump` (member-only) returns the room's bounded event
  buffer for diagnosis.

## Local dev

```bash
cd apps/fab-table
npm install && npm test
SESSION_SECRET=dev PORT=8787 FABBAZAAR_URL=http://localhost:3000 node server.js
```

Sign-in requires OAuth client credentials for the target fabbazaar instance
(`OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`); without them you can still forge a
session for testing — see `signSession` in `lib/auth.js`.

## Deploy (first time)

1. **DNS**: A record `play.fabbazaar.app` → the VPS (proxied via Cloudflare
   like the apex). Verify the origin cert covers `*.fabbazaar.app`.
2. **OAuth client** (against prod fabbazaar):
   ```bash
   curl -s https://fabbazaar.app/oauth/register -X POST \
     -H 'Content-Type: application/json' \
     -d '{"client_name":"FaB Table","redirect_uris":["https://play.fabbazaar.app/auth/callback"]}'
   ```
   Put the returned credentials in `/opt/fabbazaar/.env`:
   ```
   FAB_TABLE_SESSION_SECRET=<openssl rand -hex 32>
   FAB_TABLE_OAUTH_CLIENT_ID=...
   FAB_TABLE_OAUTH_CLIENT_SECRET=...
   ```
3. Merge to main: the main deploy ships the compose service + Caddy vhost;
   the `deploy-fab-table` workflow builds and starts the container.

## Physical setup (the part software can't do)

- Mount the phone **landscape** above the mat (the page blocks portrait).
- Zoom until the mat fills the frame, then drag the playmat zone.
- Matte sleeves; 20mm stickers at ~60cm, 24mm if the camera sits higher.
