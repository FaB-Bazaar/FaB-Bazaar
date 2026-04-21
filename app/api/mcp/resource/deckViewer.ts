export const deckViewerResource = {
  uri: 'ui://deck/viewer.html',
  name: 'Deck viewer',
  description: 'Interactive decklist rendered in the MCP host (get_deck).',
  mimeType: 'text/html;profile=mcp-app',
  _meta: {
    ui: {
      csp: {
        resourceDomains: ['https://imagedelivery.net'],
      },
    },
  },
  async handler(): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deck viewer</title>
  <style>
    :root {
      color-scheme: light dark;
      --fb-bg: #ffffff;
      --fb-surface: #f4f4f5;
      --fb-surface-hover: #e4e4e7;
      --fb-text: #18181b;
      --fb-text-muted: #52525b;
      --fb-border: rgba(0,0,0,0.12);
      --fb-border-strong: rgba(0,0,0,0.24);
      --fb-accent: #2563eb;
      --fb-overlay: rgba(0,0,0,0.72);
      --fb-pitch-1: #ef4444;
      --fb-pitch-2: #eab308;
      --fb-pitch-3: #3b82f6;
      --fb-pitch-0: #9ca3af;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --fb-bg: #0f0f10;
        --fb-surface: #1c1c1e;
        --fb-surface-hover: #2a2a2d;
        --fb-text: #f4f4f5;
        --fb-text-muted: #a1a1aa;
        --fb-border: rgba(255,255,255,0.10);
        --fb-border-strong: rgba(255,255,255,0.22);
        --fb-accent: #60a5fa;
        --fb-overlay: rgba(0,0,0,0.82);
        --fb-pitch-1: #f87171;
        --fb-pitch-2: #facc15;
        --fb-pitch-3: #60a5fa;
        --fb-pitch-0: #6b7280;
      }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: var(--font-family-text, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
      font-size: var(--font-text-md-size, 14px);
      color: var(--color-text-primary, var(--fb-text));
      background: var(--color-background-primary, transparent);
    }
    .wrap { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

    /* Hero HUD */
    .hud {
      display: grid;
      grid-template-columns: 88px 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 12px;
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 12px;
    }
    .hero-art {
      width: 88px; height: 120px;
      border-radius: 8px;
      overflow: hidden;
      background: var(--color-background-tertiary, var(--fb-surface-hover));
      flex-shrink: 0;
    }
    .hero-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .hud-meta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .deck-title { font-size: var(--font-heading-lg-size, 20px); font-weight: 700; margin: 0; line-height: 1.2; }
    .deck-subtitle { font-size: var(--font-text-sm-size, 13px); color: var(--color-text-secondary, var(--fb-text-muted)); }
    .pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill {
      display: inline-flex; align-items: center;
      padding: 2px 8px;
      font-size: var(--font-text-xs-size, 11px);
      background: var(--color-background-tertiary, var(--fb-surface-hover));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 9999px;
      color: var(--color-text-secondary, var(--fb-text-muted));
      white-space: nowrap;
    }
    .pill.accent { color: var(--color-accent-primary, var(--fb-accent)); border-color: var(--color-accent-primary, var(--fb-accent)); }
    .pill.trophy { color: #b45309; border-color: rgba(180,83,9,0.5); background: rgba(251,191,36,0.12); }
    @media (prefers-color-scheme: dark) { .pill.trophy { color: #fbbf24; } }
    .hud-numbers { text-align: right; display: flex; flex-direction: column; gap: 2px; align-items: flex-end; }
    .hud-num { font-size: var(--font-heading-sm-size, 18px); font-weight: 700; }
    .hud-num-label { font-size: 11px; color: var(--color-text-tertiary, var(--fb-text-muted)); text-transform: uppercase; letter-spacing: 0.04em; }

    .btn {
      appearance: none; cursor: pointer;
      padding: 6px 12px;
      font-size: var(--font-text-sm-size, 13px);
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid var(--color-border-primary, var(--fb-border-strong));
      background: var(--color-surface-primary, var(--fb-surface));
      color: var(--color-text-primary, var(--fb-text));
      transition: background 120ms, border-color 120ms;
    }
    .btn:hover { background: var(--color-surface-secondary, var(--fb-surface-hover)); }
    .btn:focus-visible { outline: 2px solid var(--color-accent-primary, var(--fb-accent)); outline-offset: 2px; }

    /* Tabs */
    .tabs {
      display: flex; gap: 2px;
      border-bottom: 1px solid var(--color-border-primary, var(--fb-border));
      padding: 0 2px;
    }
    .tab {
      appearance: none; background: none; border: none; cursor: pointer;
      padding: 10px 14px;
      font-size: var(--font-text-sm-size, 13px);
      color: var(--color-text-secondary, var(--fb-text-muted));
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 120ms, border-color 120ms;
    }
    .tab:hover { color: var(--color-text-primary, var(--fb-text)); }
    .tab.active {
      color: var(--color-text-primary, var(--fb-text));
      border-bottom-color: var(--color-accent-primary, var(--fb-accent));
      font-weight: 600;
    }
    .tab:focus-visible { outline: 2px solid var(--color-accent-primary, var(--fb-accent)); outline-offset: 2px; }

    /* Equipment strip */
    .equip-strip {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
    }
    .equip-slot {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 6px;
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 8px;
      cursor: pointer;
    }
    .equip-slot:hover { border-color: var(--color-accent-primary, var(--fb-accent)); }
    .equip-slot .thumb {
      width: 86px; height: 120px;
      border-radius: 6px; overflow: hidden;
      background: var(--color-background-tertiary, var(--fb-surface-hover));
    }
    .equip-slot .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .equip-slot .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary, var(--fb-text-muted)); }
    .equip-slot .name { font-size: var(--font-text-xs-size, 11px); text-align: center; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Section grids */
    .sections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }
    .section {
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 10px;
      overflow: hidden;
    }
    .section-header {
      padding: 8px 10px;
      font-size: var(--font-text-sm-size, 13px);
      font-weight: 600;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--color-border-primary, var(--fb-border));
    }
    .section-count {
      font-size: var(--font-text-xs-size, 11px);
      color: var(--color-text-tertiary, var(--fb-text-muted));
      font-weight: 500;
    }
    .section-body { display: flex; flex-direction: column; }

    /* Card row */
    .card-row {
      display: grid;
      grid-template-columns: 3px 28px 1fr auto auto;
      align-items: center;
      gap: 8px;
      padding: 4px 8px 4px 0;
      cursor: pointer;
      border-bottom: 1px solid var(--color-border-primary, var(--fb-border));
    }
    .card-row:last-child { border-bottom: none; }
    .card-row:hover { background: var(--color-background-tertiary, var(--fb-surface-hover)); }
    .card-row .pitch-bar { height: 100%; min-height: 28px; background: var(--fb-pitch-0); }
    .card-row[data-pitch="1"] .pitch-bar { background: var(--fb-pitch-1); }
    .card-row[data-pitch="2"] .pitch-bar { background: var(--fb-pitch-2); }
    .card-row[data-pitch="3"] .pitch-bar { background: var(--fb-pitch-3); }
    .card-row .qty {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      text-align: right;
      font-size: var(--font-text-sm-size, 13px);
      color: var(--color-text-secondary, var(--fb-text-muted));
    }
    .card-row .name {
      font-size: var(--font-text-sm-size, 13px);
      line-height: 1.3;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .card-row .cost {
      width: 22px; height: 22px; border-radius: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      background: var(--color-background-tertiary, var(--fb-surface-hover));
      border: 1px solid var(--color-border-primary, var(--fb-border));
    }
    .card-row .pitch-pip {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--fb-pitch-0);
      border: 1px solid var(--color-border-strong, var(--fb-border-strong));
    }
    .card-row[data-pitch="1"] .pitch-pip { background: var(--fb-pitch-1); }
    .card-row[data-pitch="2"] .pitch-pip { background: var(--fb-pitch-2); }
    .card-row[data-pitch="3"] .pitch-pip { background: var(--fb-pitch-3); }

    /* Pitch tab columns */
    .pitch-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }
    .stat-card {
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 10px;
      padding: 12px;
    }
    .stat-title { font-size: var(--font-text-sm-size, 13px); font-weight: 600; margin-bottom: 8px; }
    .bar-row { display: grid; grid-template-columns: 60px 1fr 36px; align-items: center; gap: 8px; padding: 3px 0; font-size: var(--font-text-xs-size, 11px); }
    .bar-track { height: 8px; background: var(--color-background-tertiary, var(--fb-surface-hover)); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--color-accent-primary, var(--fb-accent)); border-radius: 4px; }
    .bar-fill.p1 { background: var(--fb-pitch-1); }
    .bar-fill.p2 { background: var(--fb-pitch-2); }
    .bar-fill.p3 { background: var(--fb-pitch-3); }
    .bar-fill.p0 { background: var(--fb-pitch-0); }
    .bar-label { font-weight: 500; }
    .bar-count { text-align: right; font-variant-numeric: tabular-nums; color: var(--color-text-secondary, var(--fb-text-muted)); }

    /* Matchups */
    .matchup {
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 10px;
      padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .matchup-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .matchup-title { font-weight: 600; font-size: var(--font-text-md-size, 14px); }
    .matchup-notes { font-size: var(--font-text-sm-size, 13px); color: var(--color-text-secondary, var(--fb-text-muted)); white-space: pre-wrap; }
    .sideboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sb-col-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .sb-col-title.in { color: #16a34a; }
    .sb-col-title.out { color: #dc2626; }
    @media (prefers-color-scheme: dark) {
      .sb-col-title.in { color: #4ade80; }
      .sb-col-title.out { color: #f87171; }
    }
    .sb-list { list-style: none; margin: 0; padding: 0; font-size: var(--font-text-xs-size, 11px); color: var(--color-text-secondary, var(--fb-text-muted)); display: flex; flex-direction: column; gap: 2px; }

    /* Empty states */
    .empty {
      padding: 24px; text-align: center;
      color: var(--color-text-tertiary, var(--fb-text-muted));
      font-size: var(--font-text-sm-size, 13px);
    }

    /* Card modal */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: var(--fb-overlay);
      display: none; align-items: center; justify-content: center;
      z-index: 999; padding: 24px;
    }
    .modal-backdrop.show { display: flex; }
    .modal-img { max-width: min(80vw, 450px); max-height: 85vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }

    .hidden { display: none !important; }

    /* Fullscreen: reserve room for the host chat composer */
    body.is-fullscreen .wrap { padding-bottom: 180px; }

    /* View toggle */
    .view-toggle {
      display: inline-flex; gap: 2px; padding: 2px;
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 8px;
    }
    .view-toggle button {
      appearance: none; cursor: pointer; border: none;
      padding: 4px 10px; border-radius: 6px;
      font-size: var(--font-text-xs-size, 12px);
      color: var(--color-text-secondary, var(--fb-text-muted));
      background: transparent;
    }
    .view-toggle button.active {
      background: var(--color-surface-primary, var(--fb-surface-hover));
      color: var(--color-text-primary, var(--fb-text));
      font-weight: 600;
    }
    .decklist-toolbar {
      display: flex; align-items: center; justify-content: flex-end;
      margin-bottom: 10px;
    }

    /* Card tile grid (image view) */
    .card-tile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
    }
    .card-tile {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 6px 4px;
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      border-radius: 8px;
      cursor: pointer;
    }
    .card-tile:hover { border-color: var(--color-accent-primary, var(--fb-accent)); }
    .card-tile .thumb {
      width: 94px; height: 130px;
      border-radius: 6px; overflow: hidden;
      background: var(--color-background-tertiary, var(--fb-surface-hover));
    }
    .card-tile .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .card-tile .qty-badge {
      position: absolute; top: 4px; left: 4px;
      padding: 2px 6px; border-radius: 999px;
      font-size: 11px; font-weight: 700;
      background: rgba(0,0,0,0.75); color: #fff;
    }
    .card-tile .name {
      font-size: var(--font-text-xs-size, 11px);
      text-align: center; line-height: 1.2;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* Sideboard card row (reuses card-row visuals in matchups panel) */
    .sb-list .card-row { padding: 3px 6px; }
    .sb-list .card-row .qty { min-width: 22px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="hud" class="hud hidden">
      <div class="hero-art"><img id="hero-img" alt="" /></div>
      <div class="hud-meta">
        <h1 id="deck-name" class="deck-title">Loading…</h1>
        <div id="deck-subtitle" class="deck-subtitle"></div>
        <div id="pill-row" class="pill-row"></div>
      </div>
      <div class="hud-numbers">
        <div id="hud-cards" class="hud-num">—</div>
        <div class="hud-num-label">Cards</div>
        <div id="hud-value" class="hud-num" style="margin-top:6px;">—</div>
        <div class="hud-num-label">Est. Value</div>
        <button class="btn" id="expand-btn" type="button" style="margin-top:10px;">Expand</button>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab active" data-tab="decklist" role="tab">Decklist</button>
      <button class="tab" data-tab="pitch" role="tab">Pitch View</button>
      <button class="tab" data-tab="stats" role="tab">Stats</button>
      <button class="tab" data-tab="matchups" role="tab">Matchups <span id="matchup-badge" class="section-count"></span></button>
    </div>

    <section id="panel-decklist" class="panel">
      <div class="decklist-toolbar">
        <div class="view-toggle" role="tablist" aria-label="View mode">
          <button id="view-list" class="active" data-view="list" type="button">List</button>
          <button id="view-cards" data-view="cards" type="button">Cards</button>
        </div>
      </div>
      <div id="equip-strip" class="equip-strip"></div>
      <div id="decklist-sections" class="sections-grid"></div>
    </section>

    <section id="panel-pitch" class="panel hidden">
      <div id="pitch-columns" class="pitch-columns"></div>
    </section>

    <section id="panel-stats" class="panel hidden">
      <div id="stats-grid" class="stats-grid"></div>
    </section>

    <section id="panel-matchups" class="panel hidden">
      <div id="matchups-list"></div>
    </section>
  </div>

  <div id="modal" class="modal-backdrop" role="dialog" aria-label="Card image">
    <img id="modal-img" class="modal-img" alt="" />
  </div>

  <script>
    (function () {
      var host = window.parent;
      var IMG_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';
      var state = { data: null, activeTab: 'decklist', viewMode: 'list' };
      var currentMode = 'inline';
      var nextId = 100;

      function post(msg) { try { host.postMessage(msg, '*'); } catch (_) {} }

      function requestDisplayMode(mode) {
        var candidates = [
          { method: 'ui/request-display-mode', params: { displayMode: mode } },
          { method: 'ui/requestDisplayMode', params: { displayMode: mode } },
          { method: 'ui/request-display-mode', params: { mode: mode } },
          { method: 'ui/display-mode/request', params: { displayMode: mode } },
          { method: 'ui/set-display-mode', params: { displayMode: mode } },
          { method: 'ui/notifications/display-mode-change', params: { displayMode: mode } },
        ];
        candidates.forEach(function (c) {
          post({ jsonrpc: '2.0', id: nextId++, method: c.method, params: c.params });
        });
      }

      function updateExpandBtn() {
        var btn = document.getElementById('expand-btn');
        if (btn) btn.textContent = currentMode === 'fullscreen' ? 'Collapse' : 'Expand';
        document.body.classList.toggle('is-fullscreen', currentMode === 'fullscreen');
      }

      function sendSize() {
        var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        post({ jsonrpc: '2.0', method: 'ui/notifications/size-change', params: { height: h } });
      }

      function connect() {
        post({
          jsonrpc: '2.0', id: 1, method: 'ui/initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            appInfo: { name: 'fab-bazaar-deck-viewer', version: '0.1.0' },
            appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
          },
        });
      }

      window.addEventListener('message', function (ev) {
        var msg = ev.data;
        if (!msg || msg.jsonrpc !== '2.0') return;
        if (msg.id === 1 && msg.result) {
          post({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
          sendSize();
          return;
        }
        if (msg.method === 'ui/notifications/display-mode-change') {
          currentMode = (msg.params && msg.params.displayMode) || currentMode;
          updateExpandBtn();
          sendSize();
          return;
        }
        var data =
          (msg.params && msg.params.structuredContent) ||
          (msg.result && msg.result.structuredContent) ||
          (msg.params && msg.params.toolResult && msg.params.toolResult.structuredContent);
        if (data) { state.data = data; render(); }
      });

      function escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      function artUrl(c) {
        if (!c) return '';
        if (c.image_url) return c.image_url;
        if (c.printingId) return IMG_BASE + '/' + encodeURIComponent(c.printingId) + '/public';
        return '';
      }

      function rowHtml(c) {
        var qty = c.quantity || 1;
        var pitch = String(c.pitch || 0);
        var cost = c.cost == null ? '' : c.cost;
        return '<div class="card-row" data-pitch="' + escapeHtml(pitch) + '" data-printing="' + escapeHtml(c.printingId || '') + '">' +
               '<div class="pitch-bar"></div>' +
               '<div class="qty">' + escapeHtml(String(qty)) + '×</div>' +
               '<div class="name" title="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</div>' +
               (cost !== '' ? '<div class="cost">' + escapeHtml(String(cost)) + '</div>' : '<div></div>') +
               '<div class="pitch-pip" aria-hidden="true"></div>' +
               '</div>';
      }

      function equipSlotHtml(label, card) {
        if (!card) return '';
        var art = artUrl(card);
        return '<div class="equip-slot" data-printing="' + escapeHtml(card.printingId || '') + '">' +
               '<div class="thumb">' + (art ? '<img src="' + escapeHtml(art) + '" alt="' + escapeHtml(card.name) + '" />' : '') + '</div>' +
               '<div class="label">' + escapeHtml(label) + '</div>' +
               '<div class="name" title="' + escapeHtml(card.name) + '">' + escapeHtml(card.name) + '</div>' +
               '</div>';
      }

      function cardTileHtml(c) {
        var art = artUrl(c);
        var qty = c.quantity || 1;
        return '<div class="card-tile" data-printing="' + escapeHtml(c.printingId || '') + '">' +
               '<div class="qty-badge">' + escapeHtml(String(qty)) + '×</div>' +
               '<div class="thumb">' + (art ? '<img src="' + escapeHtml(art) + '" alt="' + escapeHtml(c.name) + '" loading="lazy" />' : '') + '</div>' +
               '<div class="name" title="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</div>' +
               '</div>';
      }

      var CATEGORY_ORDER = [
        'Attack Actions', 'Attack Reactions', 'Defense Reactions',
        'Non-Attack Actions', 'Instants', 'Actions', 'Items',
        'Allies', 'Resources', 'Other',
      ];
      var MAIN_TYPE_MATCH = [
        ['attack reaction', 'Attack Reactions'],
        ['defense reaction', 'Defense Reactions'],
        ['instant', 'Instants'],
        ['attack action', 'Attack Actions'],
        ['non-attack action', 'Non-Attack Actions'],
        ['action', 'Actions'],
        ['item', 'Items'],
        ['ally', 'Allies'],
        ['resource', 'Resources'],
      ];
      function primaryCategoryLabel(types) {
        var ts = (types || []).map(function (t) { return String(t).toLowerCase(); });
        for (var i = 0; i < MAIN_TYPE_MATCH.length; i++) {
          var needle = MAIN_TYPE_MATCH[i][0];
          var hit = ts.some(function (t) { return t.indexOf(needle) !== -1; });
          if (hit) return MAIN_TYPE_MATCH[i][1];
        }
        return 'Other';
      }

      function renderHud(deck) {
        var hud = document.getElementById('hud');
        hud.classList.remove('hidden');
        document.getElementById('deck-name').textContent = (deck.meta && deck.meta.name) || 'Untitled Deck';
        document.getElementById('deck-subtitle').textContent = state.data.subtitle || '';

        var heroImg = document.getElementById('hero-img');
        if (deck.heroCard) {
          var art = artUrl(deck.heroCard);
          heroImg.src = art;
          heroImg.alt = deck.heroCard.name;
        } else {
          heroImg.removeAttribute('src');
          heroImg.alt = '';
        }

        var pills = document.getElementById('pill-row');
        var parts = [];
        if (deck.meta && deck.meta.className) parts.push('<span class="pill accent">' + escapeHtml(deck.meta.className) + '</span>');
        (deck.meta && deck.meta.talents ? deck.meta.talents : []).forEach(function (t) {
          parts.push('<span class="pill">' + escapeHtml(t) + '</span>');
        });
        if (deck.meta && deck.meta.format) parts.push('<span class="pill">' + escapeHtml(deck.meta.format) + '</span>');
        if (deck.meta && deck.meta.event) {
          var eventLabel = deck.meta.event +
            (deck.meta.placing ? ' · ' + deck.meta.placing : '') +
            (deck.meta.eventDate ? ' · ' + deck.meta.eventDate : '');
          parts.push('<span class="pill trophy">🏆 ' + escapeHtml(eventLabel) + '</span>');
        }
        pills.innerHTML = parts.join('');

        document.getElementById('hud-cards').textContent = String((deck.meta && deck.meta.totalCards) || 0);
        var val = (deck.meta && deck.meta.estimatedValue) || 0;
        document.getElementById('hud-value').textContent = '$' + Number(val).toFixed(0);
      }

      function renderDecklist(deck) {
        var strip = document.getElementById('equip-strip');
        var equipHtml = '';
        if (deck.weapon) equipHtml += equipSlotHtml('Weapon', deck.weapon);
        ['head', 'chest', 'arms', 'legs', 'off-hand'].forEach(function (slot) {
          var items = (deck.equipment && deck.equipment[slot]) || [];
          items.forEach(function (c) { equipHtml += equipSlotHtml(slot, c); });
        });
        ((deck.equipment && deck.equipment.other) || []).forEach(function (c) {
          equipHtml += equipSlotHtml('Equipment', c);
        });
        strip.innerHTML = equipHtml;

        // Group maindeck by primary type
        var grouped = {};
        (deck.categories && deck.categories.maindeck ? deck.categories.maindeck : []).forEach(function (c) {
          var label = primaryCategoryLabel(c.types);
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push(c);
        });

        var sections = document.getElementById('decklist-sections');
        var bodyRenderer = state.viewMode === 'cards'
          ? function (cards) { return '<div class="card-tile-grid">' + cards.map(cardTileHtml).join('') + '</div>'; }
          : function (cards) { return cards.map(rowHtml).join(''); };

        var html = '';
        CATEGORY_ORDER.forEach(function (label) {
          var cards = grouped[label];
          if (!cards || !cards.length) return;
          var total = cards.reduce(function (s, c) { return s + (c.quantity || 1); }, 0);
          html += '<div class="section"><div class="section-header">' +
                  '<span>' + escapeHtml(label) + '</span>' +
                  '<span class="section-count">' + total + '</span>' +
                  '</div><div class="section-body">' +
                  bodyRenderer(cards) +
                  '</div></div>';
        });

        var inv = (deck.categories && deck.categories.inventory) || [];
        if (inv.length) {
          var invTotal = inv.reduce(function (s, c) { return s + (c.quantity || 1); }, 0);
          html += '<div class="section"><div class="section-header">' +
                  '<span>Inventory</span><span class="section-count">' + invTotal + '</span>' +
                  '</div><div class="section-body">' + bodyRenderer(inv) + '</div></div>';
        }
        var tokens = (deck.categories && deck.categories.tokens) || [];
        if (tokens.length) {
          var tokTotal = tokens.reduce(function (s, c) { return s + (c.quantity || 1); }, 0);
          html += '<div class="section"><div class="section-header">' +
                  '<span>Tokens</span><span class="section-count">' + tokTotal + '</span>' +
                  '</div><div class="section-body">' + bodyRenderer(tokens) + '</div></div>';
        }

        if (!html) html = '<div class="empty">This deck has no cards yet.</div>';
        sections.innerHTML = html;
      }

      function renderPitch(deck) {
        var cols = document.getElementById('pitch-columns');
        var buckets = { '3': [], '2': [], '1': [], '0': [] };
        (deck.categories && deck.categories.maindeck ? deck.categories.maindeck : []).forEach(function (c) {
          var p = String(c.pitch || 0);
          if (!buckets[p]) buckets[p] = [];
          buckets[p].push(c);
        });
        var labels = { '3': 'Blue (3)', '2': 'Yellow (2)', '1': 'Red (1)', '0': 'Non-pitch' };
        var html = '';
        ['3', '2', '1', '0'].forEach(function (p) {
          var cards = buckets[p];
          var total = cards.reduce(function (s, c) { return s + (c.quantity || 1); }, 0);
          if (!cards.length) return;
          html += '<div class="section"><div class="section-header">' +
                  '<span>' + escapeHtml(labels[p]) + '</span>' +
                  '<span class="section-count">' + total + '</span>' +
                  '</div><div class="section-body">' +
                  cards.map(rowHtml).join('') +
                  '</div></div>';
        });
        if (!html) html = '<div class="empty">No maindeck cards.</div>';
        cols.innerHTML = html;
      }

      function renderStats(deck) {
        var grid = document.getElementById('stats-grid');
        var s = deck.stats || {};
        var html = '';

        // Pitch distribution
        var pitchOrder = [['3', 'Blue (3)', 'p3'], ['2', 'Yellow (2)', 'p2'], ['1', 'Red (1)', 'p1'], ['0', 'Non-pitch', 'p0']];
        var pitchTotal = Object.values(s.byPitch || {}).reduce(function (a, b) { return a + b; }, 0);
        var pitchHtml = '';
        pitchOrder.forEach(function (p) {
          var count = (s.byPitch && s.byPitch[p[0]]) || 0;
          var pct = pitchTotal ? Math.round((count / pitchTotal) * 100) : 0;
          pitchHtml += '<div class="bar-row"><div class="bar-label">' + p[1] + '</div>' +
                       '<div class="bar-track"><div class="bar-fill ' + p[2] + '" style="width:' + pct + '%"></div></div>' +
                       '<div class="bar-count">' + count + '</div></div>';
        });
        html += '<div class="stat-card"><div class="stat-title">Pitch distribution</div>' + pitchHtml + '</div>';

        // Cost curve
        var costs = Object.keys(s.byCost || {}).sort(function (a, b) {
          if (a === 'x') return 1;
          if (b === 'x') return -1;
          return Number(a) - Number(b);
        });
        var costMax = Math.max.apply(null, Object.values(s.byCost || { 0: 0 }));
        var costHtml = '';
        costs.forEach(function (c) {
          var count = s.byCost[c];
          var pct = costMax ? Math.round((count / costMax) * 100) : 0;
          costHtml += '<div class="bar-row"><div class="bar-label">Cost ' + escapeHtml(c) + '</div>' +
                      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
                      '<div class="bar-count">' + count + '</div></div>';
        });
        if (costs.length) html += '<div class="stat-card"><div class="stat-title">Cost curve</div>' + costHtml + '</div>';

        // Type breakdown
        var typeEntries = Object.entries(s.byType || {}).sort(function (a, b) { return b[1] - a[1]; });
        var typeMax = typeEntries.length ? typeEntries[0][1] : 0;
        var typeHtml = '';
        typeEntries.forEach(function (e) {
          var pct = typeMax ? Math.round((e[1] / typeMax) * 100) : 0;
          typeHtml += '<div class="bar-row"><div class="bar-label">' + escapeHtml(e[0]) + '</div>' +
                      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
                      '<div class="bar-count">' + e[1] + '</div></div>';
        });
        if (typeEntries.length) html += '<div class="stat-card"><div class="stat-title">Type breakdown</div>' + typeHtml + '</div>';

        // Top keywords
        var kwEntries = Object.entries(s.byKeyword || {}).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
        if (kwEntries.length) {
          var kwMax = kwEntries[0][1];
          var kwHtml = '';
          kwEntries.forEach(function (e) {
            var pct = kwMax ? Math.round((e[1] / kwMax) * 100) : 0;
            kwHtml += '<div class="bar-row"><div class="bar-label" style="text-transform:capitalize">' + escapeHtml(e[0]) + '</div>' +
                      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
                      '<div class="bar-count">' + e[1] + '</div></div>';
          });
          html += '<div class="stat-card"><div class="stat-title">Top keywords</div>' + kwHtml + '</div>';
        }

        grid.innerHTML = html || '<div class="empty">No stats available.</div>';
      }

      function sideboardRowHtml(entry) {
        var pitch = String(entry.pitch || 0);
        return '<div class="card-row" data-pitch="' + escapeHtml(pitch) + '">' +
               '<div class="pitch-bar"></div>' +
               '<div class="qty">' + escapeHtml(String(entry.quantity || 1)) + '×</div>' +
               '<div class="name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</div>' +
               '<div></div>' +
               '<div class="pitch-pip" aria-hidden="true"></div>' +
               '</div>';
      }

      function sideboardTotal(list) {
        return (list || []).reduce(function (s, e) { return s + (e.quantity || 1); }, 0);
      }

      function renderMatchups(deck) {
        var list = document.getElementById('matchups-list');
        var ms = deck.matchups || [];
        if (!ms.length) {
          list.innerHTML = '<div class="empty">No matchups configured for this deck yet.</div>';
          return;
        }
        list.innerHTML = '<div class="stats-grid">' + ms.map(function (m) {
          var turn = m.turnOrder && m.turnOrder !== 'NoPreference'
            ? '<span class="pill accent">' + escapeHtml('Go ' + String(m.turnOrder).toLowerCase()) + '</span>'
            : '';
          var inList = (m.sideboard && m.sideboard.in) || [];
          var outList = (m.sideboard && m.sideboard.out) || [];
          var inCount = sideboardTotal(inList);
          var outCount = sideboardTotal(outList);
          var renderList = function (entries) {
            if (!entries.length) return '<div class="empty" style="padding:6px 0;">—</div>';
            return '<div class="sb-list">' + entries.map(sideboardRowHtml).join('') + '</div>';
          };
          return '<div class="matchup">' +
                 '<div class="matchup-head">' +
                 '<div class="matchup-title">vs ' + escapeHtml(m.heroDisplay || m.heroId) + '</div>' +
                 turn + '</div>' +
                 (m.notes ? '<div class="matchup-notes">' + escapeHtml(m.notes) + '</div>' : '') +
                 '<div class="sideboard-grid">' +
                 '<div><div class="sb-col-title in">In (' + inCount + ')</div>' + renderList(inList) + '</div>' +
                 '<div><div class="sb-col-title out">Out (' + outCount + ')</div>' + renderList(outList) + '</div>' +
                 '</div></div>';
        }).join('') + '</div>';
      }

      function render() {
        if (!state.data || !state.data.deck) return;
        var deck = state.data.deck;
        renderHud(deck);
        renderDecklist(deck);
        renderPitch(deck);
        renderStats(deck);
        renderMatchups(deck);
        var badge = document.getElementById('matchup-badge');
        badge.textContent = (deck.matchups && deck.matchups.length) ? '(' + deck.matchups.length + ')' : '';
        sendSize();
      }

      // Tabs
      document.querySelectorAll('.tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var target = btn.dataset.tab;
          document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === btn); });
          ['decklist', 'pitch', 'stats', 'matchups'].forEach(function (key) {
            document.getElementById('panel-' + key).classList.toggle('hidden', key !== target);
          });
          state.activeTab = target;
          sendSize();
        });
      });

      // Card modal
      var modal = document.getElementById('modal');
      var modalImg = document.getElementById('modal-img');
      function findCard(printingId) {
        if (!state.data || !printingId) return null;
        var d = state.data.deck || {};
        var pools = [].concat(
          d.heroCard ? [d.heroCard] : [],
          d.weapon ? [d.weapon] : [],
          ((d.equipment && d.equipment.head) || []),
          ((d.equipment && d.equipment.chest) || []),
          ((d.equipment && d.equipment.arms) || []),
          ((d.equipment && d.equipment.legs) || []),
          ((d.equipment && d.equipment['off-hand']) || []),
          ((d.equipment && d.equipment.other) || []),
          ((d.categories && d.categories.maindeck) || []),
          ((d.categories && d.categories.inventory) || []),
          ((d.categories && d.categories.benched) || []),
          ((d.categories && d.categories.tokens) || [])
        );
        for (var i = 0; i < pools.length; i++) {
          if (pools[i] && pools[i].printingId === printingId) return pools[i];
        }
        return null;
      }
      document.addEventListener('click', function (e) {
        var row = e.target.closest && e.target.closest('[data-printing]');
        if (row) {
          var c = findCard(row.dataset.printing);
          if (c) {
            modalImg.src = artUrl(c);
            modalImg.alt = c.name;
            modal.classList.add('show');
            return;
          }
        }
        if (e.target === modal || e.target === modalImg) {
          modal.classList.remove('show');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') modal.classList.remove('show');
      });

      // Expand / collapse button
      var expandBtn = document.getElementById('expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', function () {
          requestDisplayMode(currentMode === 'fullscreen' ? 'inline' : 'fullscreen');
        });
      }

      // View-mode toggle (list vs. card tiles) for the Decklist tab
      document.querySelectorAll('.view-toggle button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mode = btn.dataset.view === 'cards' ? 'cards' : 'list';
          if (state.viewMode === mode) return;
          state.viewMode = mode;
          document.querySelectorAll('.view-toggle button').forEach(function (b) {
            b.classList.toggle('active', b.dataset.view === mode);
          });
          if (state.data && state.data.deck) {
            renderDecklist(state.data.deck);
            sendSize();
          }
        });
      });

      window.addEventListener('resize', sendSize);
      connect();
    }());
  </script>
</body>
</html>`;
  },
};
