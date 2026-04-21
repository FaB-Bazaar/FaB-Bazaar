export const binderViewerResource = {
  uri: 'ui://binder/viewer.html',
  name: 'Binder viewer',
  description: 'Interactive binder table rendered in the MCP host.',
  mimeType: 'text/html;profile=mcp-app',
  async handler(): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Binder</title>
</head>
<body>
  <div id="binder-app">Loading…</div>
  <script>
    (function () {
      var host = window.parent;

      var app = {
        connect: function () {
          try {
            host.postMessage({
              jsonrpc: '2.0',
              id: 1,
              method: 'ui/initialize',
              params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                appInfo: { name: 'fab-bazaar-binder', version: '0.1.0' },
                appCapabilities: {
                  availableDisplayModes: ['inline'],
                },
              },
            }, '*');
          } catch (_) {}
        },
      };

      window.addEventListener('message', function (ev) {
        var msg = ev.data;
        if (!msg || msg.jsonrpc !== '2.0') return;
        console.log('[binder-viewer] message:', msg);

        if (msg.id === 1 && msg.result) {
          try {
            host.postMessage({
              jsonrpc: '2.0',
              method: 'ui/notifications/initialized',
              params: {},
            }, '*');
          } catch (_) {}
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

      function render(data) {
        var root = document.getElementById('binder-app');
        if (!root) return;

        var binder = data.binder || {};
        var cards = Array.isArray(data.cards) ? data.cards : [];
        var pagination = data.pagination || {};

        var rows = cards.map(function (c) {
          var cells = [
            c.qty == null ? '' : String(c.qty),
            escapeHtml(c.foil),
            escapeHtml(c.name),
            escapeHtml(c.edition),
            escapeHtml(c.collectorNumber),
            escapeHtml(c.condition),
            c.forTrade ? '✅' : '❌',
            c.price == null ? '—' : '$' + Number(c.price).toFixed(2),
          ];
          return '<tr>' + cells.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>';
        }).join('');

        var totalPages = pagination.total && pagination.limit
          ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
          : 1;

        root.innerHTML =
          '<h2>' + escapeHtml(binder.name || binder.slug || 'Binder') + '</h2>' +
          '<p>' + cards.length + ' rows (page ' + (pagination.page || 1) + ' of ' + totalPages + ')</p>' +
          '<table border="1" cellspacing="0" cellpadding="4">' +
            '<thead><tr>' +
              '<th>Qty</th><th>Foil</th><th>Name</th><th>Edition</th>' +
              '<th>Card ID</th><th>Cond</th><th>Trade</th><th>Price</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>';
      }

      app.connect();
    })();
  </script>
</body>
</html>`;
  },
};
