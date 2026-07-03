#!/usr/bin/env python3
# One-shot port transform: rig (scratchpad webcam-qr-test.html) -> fab-table
# public/table.html. Every replacement asserts it matched exactly once so a
# rig/page drift fails the port loudly instead of shipping subtle breakage.
# Kept in-repo as documentation of the delta between rig and product page.
import re
import sys

PATH = 'public/table.html'
html = open(PATH).read()
count = 0


def sub(pattern, repl, n=1, flags=0):
    global html, count
    new, hits = re.subn(pattern, repl, html, count=n, flags=flags)
    if hits != n:
        print(f'FAIL ({hits}/{n} matches): {pattern[:80]}')
        sys.exit(1)
    html = new
    count += 1


# --- identity: role/room from path, side from server, pairing token -----------
sub(
    r"const params = new URLSearchParams\(location\.search\);\n"
    r"const ROLE = params\.get\('role'\) === 'display' \? 'display' : 'camera';\n",
    "const params = new URLSearchParams(location.search);\n"
    "const pathParts = location.pathname.split('/').filter(Boolean); // ['r', roomId, 'cam'?]\n"
    "const ROLE = pathParts[2] === 'cam' ? 'camera' : 'display';\n"
    "const ROOM = pathParts[1];\n"
    "const PAIR = params.get('pair'); // camera devices authenticate with this\n"
    "const DEBUG_UI = params.get('debug') === '1';\n"
    "let SIDE = null; // seat is assigned by the server (welcome event)\n",
)
sub(
    r"const ROOM = params\.get\('room'\) \|\| 'test';\n"
    r"const SIDE = params\.get\('side'\) \|\| '1';   // player 1 / player 2 at this table\n",
    "",
)

# --- transport: relay endpoints with pairing auth ------------------------------
sub(
    r"fetch\('/api/events', \{\n"
    r"    method: 'POST',\n"
    r"    headers: \{ 'Content-Type': 'application/json' \},\n"
    r"    body: JSON\.stringify\(\{ room: ROOM, cid: CID, build: BUILD, \.\.\.ev \}\),\n"
    r"  \}\)\.catch\(\(\) => \{\}\);",
    "fetch(`/api/rooms/${ROOM}/events${PAIR ? `?pair=${encodeURIComponent(PAIR)}` : ''}`, {\n"
    "    method: 'POST',\n"
    "    headers: { 'Content-Type': 'application/json' },\n"
    "    body: JSON.stringify({ cid: CID, build: BUILD, ...ev }),\n"
    "  }).catch(() => {});",
)
sub(
    r"const es = new EventSource\('/api/stream\?room=' \+ encodeURIComponent\(ROOM\)\);",
    "const es = new EventSource(`/api/rooms/${ROOM}/stream${PAIR ? `?pair=${encodeURIComponent(PAIR)}` : ''}`);",
)

# --- welcome event assigns the seat -------------------------------------------
sub(
    r"  switch \(ev\.type\) \{\n    case 'card':",
    "  switch (ev.type) {\n    case 'welcome': SIDE = ev.side; break;\n    case 'card':",
)

# --- cards: embedded map -> lazy resolver against the printing proxy ----------
sub(
    r"const PRINTINGS = \{.*?\};\n",
    "// Card identity resolves lazily via the server's printing proxy (which\n"
    "// fronts fabbazaar's immutable printing lookup). Unresolved cards render\n"
    "// on the next tick after their fetch lands.\n"
    "const CARDS = new Map();\n"
    "const CARD_FETCHES = new Set();\n"
    "function card(pid) {\n"
    "  if (CARDS.has(pid)) return CARDS.get(pid);\n"
    "  if (!CARD_FETCHES.has(pid)) {\n"
    "    CARD_FETCHES.add(pid);\n"
    "    fetch(`/api/printing/${pid}`)\n"
    "      .then(r => (r.ok ? r.json() : null))\n"
    "      .then(j => {\n"
    "        const d = j && j.data;\n"
    "        if (!d) return;\n"
    "        CARDS.set(pid, {\n"
    "          name: d.display_name || d.name,\n"
    "          img: d.image_url,\n"
    "          pitch: d.pitch ?? null,\n"
    "          num: d.collector_number,\n"
    "          types: d.types || [],\n"
    "          text: d.text || '',\n"
    "          cost: d.cost, power: d.power, defense: d.defense,\n"
    "          life: d.life, intellect: d.intellect,\n"
    "          tcg_low: d.tcg_low,\n"
    "        });\n"
    "      })\n"
    "      .catch(() => CARD_FETCHES.delete(pid)); // transient failure: retry on next sighting\n"
    "  }\n"
    "  return undefined;\n"
    "}\n",
    flags=re.S,
)
sub(r"PRINTINGS\[([A-Za-z_][\w.]*)\]", r"card(\1)", n=9)

# --- life: seat-keyed room state, not per-device localStorage ------------------
sub(
    r"const life = \(\(\) => \{\n"
    r"  try \{ return JSON\.parse\(localStorage\.getItem\('fab-life'\)\) \|\| \{ me: 40, opp: 40 \}; \}\n"
    r"  catch \(e\) \{ return \{ me: 40, opp: 40 \}; \}\n"
    r"\}\)\(\);",
    "const life = { 1: 40, 2: 40 }; // keyed by seat; the room snapshot restores it",
)
sub(
    r"function renderLife\(\) \{\n"
    r"  for \(const side of \['me', 'opp'\]\) lifeEls\[side\]\.textContent = life\[side\];\n"
    r"  localStorage\.setItem\('fab-life', JSON\.stringify\(life\)\);\n"
    r"\}",
    "function mySeat() { return SIDE || '1'; }\n"
    "function oppSeat() { return mySeat() === '1' ? '2' : '1'; }\n"
    "function renderLife() {\n"
    "  lifeEls.me.textContent = life[mySeat()];\n"
    "  lifeEls.opp.textContent = life[oppSeat()];\n"
    "}",
)
sub(
    r"    const side = btn\.dataset\.side;\n"
    r"    life\[side\] \+= Number\(btn\.dataset\.delta\) \* step;\n"
    r"    renderLife\(\);\n"
    r"    publish\(\{ type: 'life', side, value: life\[side\] \}\);",
    "    const seat = btn.dataset.side === 'me' ? mySeat() : oppSeat();\n"
    "    life[seat] += Number(btn.dataset.delta) * step;\n"
    "    renderLife();\n"
    "    publish({ type: 'life', seat, value: life[seat] });",
)
sub(
    r"    case 'life':   life\[ev\.side\] = ev\.value; renderLife\(\); break;",
    "    case 'life':   if (ev.seat) { life[ev.seat] = ev.value; renderLife(); } break;",
)
sub(
    r"    const bumpLife = \(side, d\) => \{\n"
    r"      life\[side\] \+= d;\n"
    r"      renderLife\(\);\n"
    r"      publish\(\{ type: 'life', side, value: life\[side\] \}\);\n"
    r"    \};",
    "    const bumpLife = (who, d) => {\n"
    "      const seat = who === 'me' ? mySeat() : oppSeat();\n"
    "      life[seat] += d;\n"
    "      renderLife();\n"
    "      publish({ type: 'life', seat, value: life[seat] });\n"
    "    };",
)

# --- hero: room snapshot is the source of truth, not localStorage --------------
sub(r"let heroPid = localStorage\.getItem\('fab-hero'\) \|\| null;", "let heroPid = null;")
sub(r"  heroPid = pid;\n  localStorage\.setItem\('fab-hero', pid\);", "  heroPid = pid;")
sub(
    r"  heroPid = null;\n  localStorage\.removeItem\('fab-hero'\);",
    "  heroPid = null;",
)

# --- gate camera work until the server has assigned a seat ---------------------
sub(
    r"function sendHello\(\) \{\n  let zoomCaps = null;",
    "function sendHello() {\n  if (!SIDE) { setTimeout(sendHello, 300); return; } // wait for welcome\n  let zoomCaps = null;",
)
sub(
    r"  async function tick\(\) \{\n"
    r"    // Landscape is required",
    "  async function tick() {\n"
    "    if (!SIDE) { setTimeout(tick, 300); return; } // seat not assigned yet\n"
    "    // Landscape is required",
)

# --- header: player-facing by default, full diagnostics behind ?debug=1 --------
sub(
    r"      const connected = \[\.\.\.pcs\.values\(\)\]\.filter\(p => p\.connectionState === 'connected'\)\.length;\n"
    r"      statsEl\.innerHTML =\n"
    r"        `<b>\$\{BUILD\}</b> · role <b>display</b> · side <b>\$\{SIDE\}</b> · room <b>\$\{ROOM\}</b> · ` \+\n"
    r"        `cameras <b>\$\{connected\}/\$\{pcs\.size\} connected</b> · events <b>\$\{rxCount\}</b>`;",
    "      const connected = [...pcs.values()].filter(p => p.connectionState === 'connected').length;\n"
    "      statsEl.innerHTML = DEBUG_UI\n"
    "        ? `<b>${BUILD}</b> · side <b>${SIDE}</b> · room <b>${ROOM}</b> · cameras <b>${connected}/${pcs.size}</b> · events <b>${rxCount}</b>`\n"
    "        : `${connected > 0 ? '<b>●</b> live' : '○ waiting for cameras'}`;",
)
sub(
    r"    statsEl\.innerHTML =\n"
    r"      `<b>\$\{BUILD\}</b> · role <b>camera</b> · room <b>\$\{ROOM\}</b> · ` \+\n"
    r"      `decoder <b>\$\{DETECTOR_NAME\}\$\{codes === null \? ' \(idle\)' : ''\}</b> · ` \+\n"
    r"      `camera <b>\$\{video\.videoWidth\}×\$\{video\.videoHeight\}</b> · ` \+\n"
    r"      `in frame <b>\$\{lastFrameCodes\.length\}</b> · ` \+\n"
    r"      `decodes <b>\$\{detections\}</b> · ` \+\n"
    r"      `detect latency <b>\$\{lastLatency\}ms</b>`;",
    "    statsEl.innerHTML = DEBUG_UI\n"
    "      ? `<b>${BUILD}</b> · decoder <b>${DETECTOR_NAME}${codes === null ? ' (idle)' : ''}</b> · <b>${video.videoWidth}×${video.videoHeight}</b> · in frame <b>${lastFrameCodes.length}</b> · decodes <b>${detections}</b> · ${lastLatency}ms`\n"
    "      : `<b>●</b> scanning · ${lastFrameCodes.length} in view`;",
)

# --- branding -------------------------------------------------------------------
sub(r"<title>FaB QR Webcam Test</title>", "<title>FaB Table</title>")
sub(r"<h1>FaB QR Webcam Test</h1>", "<h1>FaB Table</h1>")

open(PATH, 'w').write(html)
print(f'OK: {count} transforms applied')
