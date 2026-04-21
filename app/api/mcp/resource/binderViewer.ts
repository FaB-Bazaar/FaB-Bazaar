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
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: var(--font-family-text, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
      font-size: var(--font-text-md-size, 14px);
      color: var(--color-text-primary, #1a1a1a);
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
      color: var(--color-text-secondary, #666);
      font-size: var(--font-text-sm-size, 12px);
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
      background: var(--color-background-secondary, #f4f4f5);
      border: 1px solid var(--color-border-primary, rgba(0,0,0,0.08));
      display: flex;
      flex-direction: column;
    }
    .card-art {
      aspect-ratio: 5 / 7;
      width: 100%;
      background: var(--color-background-tertiary, #e4e4e7);
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
      color: var(--color-text-secondary, #666);
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
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
    }
    .trade-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--color-accent-primary, #2563eb);
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .price {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: var(--color-text-primary, #1a1a1a);
    }
    .skeleton .card-art,
    .skeleton .card-body {
      background: linear-gradient(90deg,
        var(--color-background-secondary, #eee) 0%,
        var(--color-background-tertiary, #f5f5f5) 50%,
        var(--color-background-secondary, #eee) 100%);
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
      color: var(--color-text-secondary, #666);
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn {
      appearance: none;
      border: 1px solid var(--color-border-primary, rgba(0,0,0,0.12));
      background: var(--color-background-secondary, #fff);
      color: var(--color-text-primary, #1a1a1a);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: var(--font-text-sm-size, 12px);
      cursor: pointer;
    }
    .btn:hover { background: var(--color-background-tertiary, #eee); }
  </style>
</head>
<body>
  <div id="binder-app" class="wrap">
    <div class="header">
      <h2 class="title">Loading binder…</h2>
    </div>
    <div class="grid" id="skeleton-grid"></div>
  </div>
  <script>
    (function () {
      var host = window.parent;
      var IMG_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';
      var currentMode = 'inline';

      var FOIL_MAP = { s: 'NF', r: 'RF', c: 'CF', g: 'GF' };
      var EDITION_MAP = { f: '1st', a: 'A', u: 'UNL', n: '' };

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
            appInfo: { name: 'fab-bazaar-binder', version: '0.2.0' },
            appCapabilities: {
              availableDisplayModes: ['inline', 'fullscreen'],
            },
          },
        });
      }

      var nextId = 100;
      function requestDisplayMode(mode) {
        // We don't know the exact method name the host accepts, so try the
        // common variants from the MCP Apps spec drafts. Whichever one the
        // host implements wins; the rest get ignored / errored.
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
        if (data) render(data);
      });

      function escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function escapeAttr(s) {
        return escapeHtml(s);
      }

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

      function render(data) {
        var root = document.getElementById('binder-app');
        if (!root) return;

        var binder = data.binder || {};
        var cards = Array.isArray(data.cards) ? data.cards : [];
        var pagination = data.pagination || {};

        var total = pagination.total != null ? pagination.total
                  : pagination.totalCards != null ? pagination.totalCards
                  : cards.length;
        var page = pagination.page || 1;
        var limit = pagination.limit || cards.length || 1;
        var totalPages = pagination.totalPages
          || (total && limit ? Math.max(1, Math.ceil(total / limit)) : 1);

        var header =
          '<div class="header">' +
            '<h2 class="title">' + escapeHtml(binder.name || binder.slug || 'Binder') + '</h2>' +
            '<div class="meta">' +
              escapeHtml(cards.length + ' of ' + total + ' cards · page ' + page + ' of ' + totalPages) +
              (cards.length > 0
                ? ' <button class="btn" id="expand-btn" type="button">Expand</button>'
                : '') +
            '</div>' +
          '</div>';

        if (cards.length === 0) {
          root.innerHTML = header + '<div class="empty">No cards to show.</div>';
          sendSize();
          return;
        }

        var tiles = cards.map(function (c) {
          var name = c.display_name || c.name || '';
          var qty = c.quantity != null ? c.quantity : c.qty;
          var foil = mapFoil(c.foiling != null ? c.foiling : c.foil);
          var edition = mapEdition(c.edition);
          var setCode = String(c.set || '').toUpperCase();
          var collector = c.collector_number != null ? c.collector_number : c.collectorNumber;
          var cardId = collector ? (setCode + collector) : '';
          var priceRaw = c.tcg_low != null ? c.tcg_low : c.price;
          var price = priceRaw == null ? '—' : '$' + Number(priceRaw).toFixed(2);
          var art = cardArtUrl(c);
          var artStyle = art ? 'background-image:url(' + escapeAttr(art) + ')' : '';

          var subLeft = [foil, edition, cardId].filter(Boolean).join(' · ');

          return '<div class="card">' +
            (qty != null && qty !== '' ? '<span class="qty-badge">' + escapeHtml(qty) + '×</span>' : '') +
            (c.forTrade ? '<span class="trade-badge">TRADE</span>' : '') +
            '<div class="card-art" style="' + artStyle + '" role="img" aria-label="' + escapeAttr(name) + '"></div>' +
            '<div class="card-body">' +
              '<div class="card-name">' + escapeHtml(name) + '</div>' +
              '<div class="card-sub">' +
                '<span>' + escapeHtml(subLeft) + '</span>' +
                '<span class="price">' + escapeHtml(price) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');

        root.innerHTML = header + '<div class="grid">' + tiles + '</div>';

        var btn = document.getElementById('expand-btn');
        if (btn) {
          btn.addEventListener('click', function () {
            var next = currentMode === 'fullscreen' ? 'inline' : 'fullscreen';
            requestDisplayMode(next);
          });
        }

        sendSize();
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
