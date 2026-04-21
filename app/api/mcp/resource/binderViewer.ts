export const binderViewerResource = {
  uri: 'ui://binder/viewer.html',
  name: 'Binder viewer',
  description: 'Interactive binder grid rendered in the MCP host.',
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
  <title>Binder</title>
  <style>
    :root {
      color-scheme: light dark;
      /* Light mode defaults (used when host does not inject --color-* tokens) */
      --fb-bg: #ffffff;
      --fb-surface: #f4f4f5;
      --fb-surface-hover: #e4e4e7;
      --fb-text: #18181b;
      --fb-text-muted: #52525b;
      --fb-border: rgba(0,0,0,0.12);
      --fb-border-strong: rgba(0,0,0,0.24);
      --fb-accent: #2563eb;
      --fb-overlay: rgba(0,0,0,0.72);
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
    .wrap {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .title {
      font-size: var(--font-heading-lg-size, 20px);
      font-weight: 600;
      margin: 0;
    }
    .meta {
      color: var(--color-text-secondary, var(--fb-text-muted));
      font-size: var(--font-text-sm-size, 12px);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .controls input[type="search"],
    .controls select {
      appearance: none;
      border: 1px solid var(--color-border-primary, var(--fb-border-strong));
      background: var(--color-background-secondary, var(--fb-surface));
      color: var(--color-text-primary, var(--fb-text));
      padding: 6px 10px;
      border-radius: 6px;
      font-size: var(--font-text-sm-size, 13px);
      min-width: 0;
      outline: none;
    }
    .controls select {
      padding-right: 28px;
      background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
                        linear-gradient(135deg, currentColor 50%, transparent 50%);
      background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
      background-size: 5px 5px;
      background-repeat: no-repeat;
    }
    .controls input[type="search"]:focus,
    .controls select:focus {
      border-color: var(--color-accent-primary, var(--fb-accent));
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--fb-accent) 25%, transparent);
    }
    .controls input[type="search"] { flex: 1 1 180px; min-width: 140px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--color-border-primary, var(--fb-border-strong));
      border-radius: 999px;
      font-size: var(--font-text-sm-size, 13px);
      cursor: pointer;
      user-select: none;
      background: var(--color-background-secondary, var(--fb-surface));
      color: var(--color-text-primary, var(--fb-text));
    }
    .chip input { accent-color: var(--color-accent-primary, var(--fb-accent)); margin: 0; }
    .chip.active {
      background: var(--color-accent-primary, var(--fb-accent));
      color: #fff;
      border-color: var(--color-accent-primary, var(--fb-accent));
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .card {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: var(--color-background-secondary, var(--fb-surface));
      border: 1px solid var(--color-border-primary, var(--fb-border));
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }
    .card:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
      border-color: var(--color-border-primary, var(--fb-border-strong));
    }
    .card-art {
      aspect-ratio: 5 / 7;
      width: 100%;
      background: var(--color-background-tertiary, var(--fb-surface-hover));
      background-size: cover;
      background-position: center;
    }
    .card-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .card-name {
      font-size: var(--font-text-sm-size, 12px);
      font-weight: 600;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .card-sub {
      font-size: var(--font-text-xs-size, 11px);
      color: var(--color-text-secondary, var(--fb-text-muted));
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .qty-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      padding: 2px 6px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      backdrop-filter: blur(2px);
    }
    .trade-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--color-accent-primary, var(--fb-accent));
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .price {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--color-text-primary, var(--fb-text));
    }
    .skeleton .card-art,
    .skeleton .card-body {
      background: linear-gradient(90deg,
        var(--fb-surface) 0%,
        var(--fb-surface-hover) 50%,
        var(--fb-surface) 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skeleton .card-body { height: 48px; }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--color-text-secondary, var(--fb-text-muted));
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding-top: 4px;
    }
    .btn {
      appearance: none;
      border: 1px solid var(--color-border-primary, var(--fb-border-strong));
      background: var(--color-background-secondary, var(--fb-surface));
      color: var(--color-text-primary, var(--fb-text));
      padding: 6px 12px;
      border-radius: 6px;
      font-size: var(--font-text-sm-size, 13px);
      cursor: pointer;
    }
    .btn:hover { background: var(--color-background-tertiary, var(--fb-surface-hover)); }
    .btn[disabled] { opacity: 0.45; cursor: not-allowed; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--fb-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 100;
    }
    .modal-art {
      max-width: min(90vw, 480px);
      max-height: 90vh;
      aspect-ratio: 5 / 7;
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .modal-info {
      position: absolute;
      top: 16px;
      right: 16px;
      color: #fff;
      font-size: var(--font-text-sm-size, 13px);
      opacity: 0.8;
    }
    .count-pill {
      color: var(--color-text-secondary, var(--fb-text-muted));
      font-size: var(--font-text-xs-size, 11px);
    }
  </style>
</head>
<body>
  <div id="binder-app" class="wrap">
    <div class="header">
      <h2 class="title">Loading binder…</h2>
    </div>
    <div class="grid" id="skeleton-grid"></div>
  </div>
  <div id="modal-root"></div>
  <script>
    (function () {
      var host = window.parent;
      var IMG_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';
      var currentMode = 'inline';

      var FOIL_MAP = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
      var EDITION_MAP = { f: '1st', a: 'A', u: 'UNL', n: '' };
      var RARITY_MAP = {
        c: 'Common', r: 'Rare', s: 'Super Rare', m: 'Majestic',
        l: 'Legendary', f: 'Fabled', t: 'Token', b: 'Basic',
        v: 'Marvel', p: 'Promo',
      };

      var state = {
        data: null,
        search: '',
        sort: 'default',
        filters: { trade: false, rarity: '', foiling: '', set: '' },
      };

      var skelRoot = document.getElementById('skeleton-grid');
      if (skelRoot) {
        var skelHtml = '';
        for (var i = 0; i < 8; i++) {
          skelHtml += '<div class="card skeleton"><div class="card-art"></div><div class="card-body"></div></div>';
        }
        skelRoot.innerHTML = skelHtml;
      }

      function post(msg) {
        try { host.postMessage(msg, '*'); } catch (_) {}
      }

      function sendSize() {
        var h = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        post({
          jsonrpc: '2.0',
          method: 'ui/notifications/size-change',
          params: { height: h },
        });
      }

      function connect() {
        post({
          jsonrpc: '2.0',
          id: 1,
          method: 'ui/initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            appInfo: { name: 'fab-bazaar-binder', version: '0.3.0' },
            appCapabilities: {
              availableDisplayModes: ['inline', 'fullscreen'],
            },
          },
        });
      }

      var nextId = 100;
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
          var id = nextId++;
          console.log('[binder-viewer] trying displayMode request:', c.method, id);
          post({ jsonrpc: '2.0', id: id, method: c.method, params: c.params });
        });
      }

      function callGetBinder(args) {
        // Probe several method names for host-brokered tool calls — whichever
        // the host implements will fire, and the rest will error back.
        var payload = { name: 'get_binder', arguments: args };
        var candidates = [
          { method: 'tools/call', params: payload },
          { method: 'ui/call-tool', params: payload },
          { method: 'ui/tool-call', params: payload },
          { method: 'ui/tools/call', params: payload },
          { method: 'ui/invoke-tool', params: payload },
        ];
        candidates.forEach(function (c) {
          var id = nextId++;
          console.log('[binder-viewer] trying tool call:', c.method, id, args);
          post({ jsonrpc: '2.0', id: id, method: c.method, params: c.params });
        });
      }

      window.addEventListener('message', function (ev) {
        var msg = ev.data;
        if (!msg || msg.jsonrpc !== '2.0') return;
        console.log('[binder-viewer] message:', msg);

        if (msg.id === 1 && msg.result) {
          post({
            jsonrpc: '2.0',
            method: 'ui/notifications/initialized',
            params: {},
          });
          sendSize();
          return;
        }

        if (msg.method === 'ui/notifications/display-mode-change') {
          currentMode = (msg.params && msg.params.displayMode) || currentMode;
          sendSize();
          return;
        }

        var data =
          (msg.params && msg.params.structuredContent) ||
          (msg.result && msg.result.structuredContent) ||
          (msg.params && msg.params.toolResult && msg.params.toolResult.structuredContent);
        if (data) {
          state.data = data;
          render();
        }
      });

      function escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
      var escapeAttr = escapeHtml;

      function cardArtUrl(c) {
        if (c.image_url) return c.image_url;
        if (c.printingId) return IMG_BASE + '/' + encodeURIComponent(c.printingId) + '/public';
        return '';
      }

      function mapFoil(f) {
        if (!f) return '';
        var k = String(f).toLowerCase();
        return FOIL_MAP[k] != null ? FOIL_MAP[k] : f;
      }
      function mapEdition(e) {
        if (!e) return '';
        var k = String(e).toLowerCase();
        return EDITION_MAP[k] != null ? EDITION_MAP[k] : e;
      }

      function cardIdLabel(c) {
        var setCode = String(c.set || '').toUpperCase();
        var collectorRaw = c.collector_number != null ? c.collector_number : c.collectorNumber;
        if (!collectorRaw) return '';
        var collector = String(collectorRaw).toUpperCase();
        // collector_number already includes the set prefix in some feeds
        if (setCode && collector.indexOf(setCode) === 0) return collector;
        return setCode ? setCode + collector : collector;
      }

      function decorate(c) {
        var name = c.display_name || c.name || '';
        var qty = c.quantity != null ? c.quantity : c.qty;
        var foil = mapFoil(c.foiling != null ? c.foiling : c.foil);
        var edition = mapEdition(c.edition);
        var priceRaw = c.tcg_low != null ? c.tcg_low : c.price;
        return {
          raw: c,
          name: name,
          qty: qty,
          foilCode: foil,
          foilKey: String(c.foiling || c.foil || '').toLowerCase(),
          edition: edition,
          condition: c.condition || '',
          forTrade: !!c.forTrade,
          cardId: cardIdLabel(c),
          price: priceRaw == null ? null : Number(priceRaw),
          art: cardArtUrl(c),
          rarityKey: String(c.rarity || '').toLowerCase(),
          setKey: String(c.set || '').toLowerCase(),
        };
      }

      function applyFilters(cards) {
        var q = state.search.trim().toLowerCase();
        var f = state.filters;
        return cards.filter(function (c) {
          if (q && c.name.toLowerCase().indexOf(q) === -1) return false;
          if (f.trade && !c.forTrade) return false;
          if (f.rarity && c.rarityKey !== f.rarity) return false;
          if (f.foiling && c.foilKey !== f.foiling) return false;
          if (f.set && c.setKey !== f.set) return false;
          return true;
        });
      }

      function distinct(cards, key) {
        var seen = Object.create(null);
        cards.forEach(function (c) { if (c[key]) seen[c[key]] = true; });
        return Object.keys(seen).sort();
      }

      function hasActiveFilters() {
        var f = state.filters;
        return !!(f.trade || f.rarity || f.foiling || f.set || state.search.trim());
      }

      function applySort(cards) {
        var arr = cards.slice();
        switch (state.sort) {
          case 'name-asc':
            return arr.sort(function (a, b) { return a.name.localeCompare(b.name); });
          case 'price-desc':
            return arr.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
          case 'price-asc':
            return arr.sort(function (a, b) { return (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price); });
          case 'qty-desc':
            return arr.sort(function (a, b) { return (b.qty || 0) - (a.qty || 0); });
          default:
            return arr;
        }
      }

      function render() {
        var root = document.getElementById('binder-app');
        if (!root) return;
        var data = state.data;
        if (!data) return;

        var binder = data.binder || {};
        var cards = (Array.isArray(data.cards) ? data.cards : []).map(decorate);
        var pagination = data.pagination || {};

        var total = pagination.total != null ? pagination.total
                  : pagination.totalCards != null ? pagination.totalCards
                  : cards.length;
        var page = pagination.page || 1;
        var limit = pagination.limit || cards.length || 1;
        var totalPages = pagination.totalPages
          || (total && limit ? Math.max(1, Math.ceil(total / limit)) : 1);

        var filtered = applySort(applyFilters(cards));

        var header =
          '<div class="header">' +
            '<h2 class="title">' + escapeHtml(binder.name || binder.slug || 'Binder') + '</h2>' +
            '<div class="meta">' +
              '<span>' + escapeHtml(filtered.length + ' of ' + cards.length + ' shown · page ' + page + ' of ' + totalPages) + '</span>' +
              '<button class="btn" id="expand-btn" type="button">' + (currentMode === 'fullscreen' ? 'Collapse' : 'Expand') + '</button>' +
            '</div>' +
          '</div>';

        var rarities = distinct(cards, 'rarityKey');
        var foilings = distinct(cards, 'foilKey');
        var sets     = distinct(cards, 'setKey');

        var rarityOpts = '<option value="">All rarities</option>' +
          rarities.map(function (r) {
            var label = RARITY_MAP[r] || r.toUpperCase();
            return '<option value="' + escapeAttr(r) + '"' +
              (state.filters.rarity === r ? ' selected' : '') +
              '>' + escapeHtml(label) + '</option>';
          }).join('');
        var foilOpts = '<option value="">All foilings</option>' +
          foilings.map(function (f) {
            var label = FOIL_MAP[f] || f.toUpperCase();
            return '<option value="' + escapeAttr(f) + '"' +
              (state.filters.foiling === f ? ' selected' : '') +
              '>' + escapeHtml(label) + '</option>';
          }).join('');
        var setOpts = '<option value="">All sets</option>' +
          sets.map(function (s) {
            return '<option value="' + escapeAttr(s) + '"' +
              (state.filters.set === s ? ' selected' : '') +
              '>' + escapeHtml(s.toUpperCase()) + '</option>';
          }).join('');

        var controls =
          '<div class="controls">' +
            '<input type="search" id="search-input" placeholder="Search cards…" value="' + escapeAttr(state.search) + '" />' +
            '<select id="sort-select" title="Sort">' +
              option('default',    'Default order',   state.sort) +
              option('name-asc',   'Name A→Z',        state.sort) +
              option('price-desc', 'Price high→low',  state.sort) +
              option('price-asc',  'Price low→high',  state.sort) +
              option('qty-desc',   'Qty high→low',    state.sort) +
            '</select>' +
            chip('trade', 'For trade', state.filters.trade) +
            '<select id="rarity-select" title="Rarity">' + rarityOpts + '</select>' +
            '<select id="foiling-select" title="Foiling">' + foilOpts + '</select>' +
            '<select id="set-select" title="Set">' + setOpts + '</select>' +
            (hasActiveFilters() ? '<button class="btn" id="clear-btn" type="button">Clear</button>' : '') +
          '</div>';

        var body;
        if (filtered.length === 0) {
          body = '<div class="empty">' + (cards.length === 0 ? 'No cards to show.' : 'No cards match your filters.') + '</div>';
        } else {
          body = '<div class="grid">' + filtered.map(tile).join('') + '</div>';
        }

        var pager = totalPages > 1
          ? '<div class="pager">' +
              '<button class="btn" id="prev-btn" type="button"' + (page <= 1 ? ' disabled' : '') + '>‹ Prev</button>' +
              '<span class="count-pill">Page ' + page + ' of ' + totalPages + '</span>' +
              '<button class="btn" id="next-btn" type="button"' + (page >= totalPages ? ' disabled' : '') + '>Next ›</button>' +
            '</div>'
          : '';

        root.innerHTML = header + controls + body + pager;
        wireControls(binder, pagination);
        sendSize();
      }

      function option(value, label, current) {
        return '<option value="' + value + '"' + (current === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
      }

      function chip(key, label, active) {
        return '<label class="chip' + (active ? ' active' : '') + '" data-chip="' + key + '">' +
          '<input type="checkbox" data-filter="' + key + '"' + (active ? ' checked' : '') + ' />' +
          escapeHtml(label) +
        '</label>';
      }

      function tile(c) {
        var artStyle = c.art ? 'background-image:url(' + escapeAttr(c.art) + ')' : '';
        var subLeft = [c.foilCode, c.edition, c.cardId].filter(Boolean).join(' · ');
        var price = c.price == null ? '—' : '$' + c.price.toFixed(2);
        return '<div class="card" data-art="' + escapeAttr(c.art) + '" data-name="' + escapeAttr(c.name) + '" data-meta="' + escapeAttr(subLeft) + '">' +
          (c.qty != null && c.qty !== '' ? '<span class="qty-badge">' + escapeHtml(c.qty) + '×</span>' : '') +
          (c.forTrade ? '<span class="trade-badge">TRADE</span>' : '') +
          '<div class="card-art" style="' + artStyle + '" role="img" aria-label="' + escapeAttr(c.name) + '"></div>' +
          '<div class="card-body">' +
            '<div class="card-name">' + escapeHtml(c.name) + '</div>' +
            '<div class="card-sub">' +
              '<span>' + escapeHtml(subLeft) + '</span>' +
              '<span class="price">' + escapeHtml(price) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      function wireControls(binder, pagination) {
        var expandBtn = document.getElementById('expand-btn');
        if (expandBtn) {
          expandBtn.addEventListener('click', function () {
            requestDisplayMode(currentMode === 'fullscreen' ? 'inline' : 'fullscreen');
          });
        }

        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.addEventListener('input', function (e) {
            state.search = e.target.value;
            render();
            var el = document.getElementById('search-input');
            if (el) {
              el.focus();
              try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
            }
          });
        }

        var sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
          sortSelect.addEventListener('change', function (e) {
            state.sort = e.target.value;
            render();
          });
        }

        var filterInputs = document.querySelectorAll('[data-filter]');
        filterInputs.forEach(function (el) {
          el.addEventListener('change', function (e) {
            var key = e.target.getAttribute('data-filter');
            state.filters[key] = !!e.target.checked;
            render();
          });
        });

        ['rarity', 'foiling', 'set'].forEach(function (key) {
          var sel = document.getElementById(key + '-select');
          if (sel) {
            sel.addEventListener('change', function (e) {
              state.filters[key] = e.target.value;
              render();
            });
          }
        });

        var clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            state.search = '';
            state.filters = { trade: false, rarity: '', foiling: '', set: '' };
            render();
          });
        }

        var prev = document.getElementById('prev-btn');
        var next = document.getElementById('next-btn');
        var page = pagination.page || 1;
        var slug = (binder && binder.slug) || (state.data && state.data.binder && state.data.binder.slug);
        if (prev) prev.addEventListener('click', function () {
          if (page > 1 && slug) callGetBinder({ binderSlug: slug, page: page - 1, limit: pagination.limit || 100 });
        });
        if (next) next.addEventListener('click', function () {
          if (slug) callGetBinder({ binderSlug: slug, page: page + 1, limit: pagination.limit || 100 });
        });

        var tiles = document.querySelectorAll('.card[data-art]');
        tiles.forEach(function (el) {
          el.addEventListener('click', function () {
            openModal(
              el.getAttribute('data-art') || '',
              el.getAttribute('data-name') || '',
              el.getAttribute('data-meta') || ''
            );
          });
        });
      }

      function openModal(art, name, meta) {
        var mroot = document.getElementById('modal-root');
        if (!mroot) return;
        var artStyle = art ? 'background-image:url(' + escapeAttr(art) + ')' : '';
        mroot.innerHTML =
          '<div class="modal-backdrop" id="modal-backdrop">' +
            '<div class="modal-info">' + escapeHtml(name) + (meta ? ' · ' + escapeHtml(meta) : '') + '</div>' +
            '<div class="modal-art" style="' + artStyle + '" role="img" aria-label="' + escapeAttr(name) + '"></div>' +
          '</div>';
        var backdrop = document.getElementById('modal-backdrop');
        if (backdrop) {
          backdrop.addEventListener('click', function () {
            mroot.innerHTML = '';
            sendSize();
          });
        }
      }

      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () { sendSize(); });
        ro.observe(document.documentElement);
      }

      connect();
    })();
  </script>
</body>
</html>`;
  },
};
