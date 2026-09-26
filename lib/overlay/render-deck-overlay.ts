import type { DeckOverlayModel, OverlayCard } from './deck-overlay';

export interface OverlayOptions {
  layout: 'spotlight' | 'list' | 'pages';
  intervalSec: number;
  /** Include the sideboard (inventory) page in the pages layout. Default true. */
  showInventory?: boolean;
}

const LAYOUTS: readonly OverlayOptions['layout'][] = ['spotlight', 'list', 'pages'];
const DEFAULT_INTERVAL_SEC = 6;
const MIN_INTERVAL_SEC = 3;
const MAX_INTERVAL_SEC = 60;

export function parseOverlayOptions(params: URLSearchParams): OverlayOptions {
  const requestedLayout = params.get('layout') as OverlayOptions['layout'];
  const layout = LAYOUTS.includes(requestedLayout) ? requestedLayout : 'spotlight';
  const requested = Number.parseInt(params.get('interval') ?? '', 10);
  const intervalSec = Number.isFinite(requested)
    ? Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, requested))
    : DEFAULT_INTERVAL_SEC;
  return { layout, intervalSec, showInventory: params.get('inventory') !== '0' };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Card art is only ever rendered from https URLs (stored image_url values are Cloudflare Images). */
function safeImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** JSON for an inline <script> block: `<` is escaped so card names can't close the tag. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const PITCH_COLORS: Record<string, string> = { '1': '#e0413a', '2': '#f2c14e', '3': '#3d8bfd', null: '#8a93a8' };

const BASE_CSS = `
  :root { --navy: #222738; --navy-deep: #0f1320; --gold: #e5c685; --gold-bright: #f2c14e; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; }
  body { font-family: "Outfit", "Avenir Next", "Helvetica Neue", sans-serif; color: #fff; }
  .panel {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    background: linear-gradient(160deg, rgba(34, 39, 56, 0.94), rgba(15, 19, 32, 0.94));
    border: 3px solid var(--gold); border-radius: 16px; overflow: hidden;
  }
  .header { padding: 4vmin 5vmin 2vmin; }
  .hero-name { font-weight: 600; font-size: 4.2vmin; color: var(--gold); text-transform: uppercase; letter-spacing: 0.08em; }
  .deck-name { font-weight: 800; font-size: 6.5vmin; line-height: 1.1; margin-top: 0.6vmin; }
  .footer { padding: 2vmin 5vmin 3vmin; font-weight: 800; font-size: 4vmin; text-align: center; }
  .footer span { color: var(--gold-bright); }
  .pip { display: inline-block; width: 1.1em; height: 1.1em; border-radius: 50%; vertical-align: -0.15em; }
`;

function documentShell(title: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · FaB Bazaar overlay</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function header(model: DeckOverlayModel): string {
  const hero = model.hero?.name ?? model.heroName;
  return `<div class="header">
    ${hero ? `<div class="hero-name">${escapeHtml(hero)}</div>` : ''}
    <div class="deck-name">${escapeHtml(model.name)}</div>
  </div>`;
}

const FOOTER = `<div class="footer">fabbazaar<span>.app</span></div>`;

function pip(pitch: number | null): string {
  return `<span class="pip" style="background:${PITCH_COLORS[String(pitch)]}"></span>`;
}

function renderList(model: DeckOverlayModel): string {
  const css = `
    .body { flex: 1; min-height: 0; overflow: hidden; padding: 0 5vmin; font-size: 3.6vmin; }
    .body.two-col { column-count: 2; column-gap: 4vmin; }
    .equipment { color: #c9cfdc; margin-bottom: 0.7em; line-height: 1.35; }
    .group { margin-bottom: 0.7em; break-inside: avoid; }
    .group h2 { font-size: 1.05em; font-weight: 800; display: flex; align-items: center; gap: 0.4em;
      border-bottom: 2px solid rgba(229, 198, 133, 0.35); padding-bottom: 0.2em; margin-bottom: 0.3em; }
    .group h2 .count { color: var(--gold); margin-left: auto; }
    .group li { list-style: none; display: flex; gap: 0.55em; line-height: 1.45; }
    .group .qty { color: var(--gold-bright); font-weight: 800; min-width: 2.5ch; text-align: right; }
  `;
  const equipment = model.equipment.length
    ? `<div class="equipment">${model.equipment.map(c => escapeHtml(c.name)).join(' · ')}</div>`
    : '';
  const groups = model.pitchGroups
    .map(group => `<section class="group" data-pitch="${group.pitch ?? 0}">
      <h2>${pip(group.pitch)}${group.label}<span class="count">${group.count}</span></h2>
      <ul>${group.cards
        .map(card => `<li><span class="qty">${card.quantity}</span><span class="name">${escapeHtml(card.name)}</span></li>`)
        .join('')}</ul>
    </section>`)
    .join('');

  // A full 60-card list doesn't fit most browser-source sizes: shrink the text until it
  // fits, then fall back to two columns. Re-run once web fonts load (they change metrics).
  const fitScript = `
    (function () {
      var body = document.querySelector('.body');
      function fit() {
        body.classList.remove('two-col');
        body.style.fontSize = '';
        var size = parseFloat(getComputedStyle(body).fontSize), min = size * 0.6;
        var overflows = function () { return body.scrollHeight > body.clientHeight + 1; };
        while (overflows() && size > min) { size -= 0.5; body.style.fontSize = size + 'px'; }
        if (overflows()) {
          body.classList.add('two-col');
          size = parseFloat(getComputedStyle(body).fontSize) * 1.25;
          body.style.fontSize = size + 'px';
          while (overflows() && size > 6) { size -= 0.5; body.style.fontSize = size + 'px'; }
        }
      }
      fit();
      if (document.fonts) document.fonts.ready.then(fit);
      window.addEventListener('resize', fit);
    })();
  `;

  return documentShell(
    model.name,
    css,
    `<div class="panel">${header(model)}<div class="body">${equipment}${groups}</div>${FOOTER}</div>
    <script>${fitScript}</script>`
  );
}

function renderSpotlight(model: DeckOverlayModel, intervalSec: number): string {
  const css = `
    .stage { position: relative; flex: 1; margin: 0 5vmin; }
    .stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
      opacity: 0; transition: opacity 600ms ease; filter: drop-shadow(0 1.5vmin 3vmin rgba(0,0,0,.6)); }
    .stage img.shown { opacity: 1; }
    .caption { text-align: center; font-weight: 800; font-size: 4.4vmin; padding: 2vmin 5vmin 0; min-height: 7vmin; }
    .caption .qty { color: var(--gold-bright); }
    .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #c9cfdc; font-size: 4vmin; }
  `;
  const cards = model.spotlight
    .map((card: OverlayCard) => ({ ...card, imageUrl: safeImageUrl(card.imageUrl) }))
    .filter(card => card.imageUrl);

  if (cards.length === 0) {
    return documentShell(
      model.name,
      css,
      `<div class="panel">${header(model)}<div class="empty">No card art yet</div>${FOOTER}</div>`
    );
  }

  const script = `
    (function () {
      var cards = JSON.parse(document.getElementById('cards').textContent);
      var stage = document.querySelector('.stage');
      var caption = document.querySelector('.caption');
      var imgs = [document.createElement('img'), document.createElement('img')];
      imgs.forEach(function (img) { img.alt = ''; stage.appendChild(img); });
      var i = 0, front = 0;
      function show() {
        var card = cards[i % cards.length];
        var next = imgs[1 - front];
        next.onload = function () {
          next.classList.add('shown');
          imgs[front].classList.remove('shown');
          front = 1 - front;
        };
        next.src = card.imageUrl;
        caption.textContent = '';
        if (card.quantity > 1 && card.pitch !== undefined) {
          var qty = document.createElement('span');
          qty.className = 'qty';
          qty.textContent = card.quantity + '\\u00d7 ';
          caption.appendChild(qty);
        }
        caption.appendChild(document.createTextNode(card.name));
        new Image().src = cards[(i + 1) % cards.length].imageUrl;
        i++;
      }
      show();
      setInterval(show, Number(stage.dataset.interval) * 1000);
    })();
  `;

  return documentShell(
    model.name,
    css,
    `<div class="panel">${header(model)}
      <div class="stage" data-interval="${intervalSec}"></div>
      <div class="caption"></div>
      ${FOOTER}
    </div>
    <script type="application/json" id="cards">${inlineJson(cards)}</script>
    <script>${script}</script>`
  );
}

/**
 * One pitch group per page (then the sideboard), cycling — reads well in narrow sources
 * like a side panel where the full list would be too small. Equipment is left out.
 */
function renderPages(model: DeckOverlayModel, intervalSec: number, showInventory: boolean): string {
  const css = `
    .pages { position: relative; flex: 1; min-height: 0; margin: 0 5vmin; }
    .page { position: absolute; inset: 0; overflow: hidden; font-size: 6vmin;
      opacity: 0; transition: opacity 500ms ease; }
    .page.shown { opacity: 1; }
    .page h2 { font-size: 1.1em; font-weight: 800; display: flex; align-items: center; gap: 0.4em;
      border-bottom: 2px solid rgba(229, 198, 133, 0.35); padding-bottom: 0.25em; margin-bottom: 0.35em; }
    .page h2 .count { color: var(--gold); margin-left: auto; }
    .page li { list-style: none; display: flex; align-items: center; gap: 0.5em; line-height: 1.4; }
    .page .qty { color: var(--gold-bright); font-weight: 800; min-width: 1.4ch; text-align: right; }
    .page li .pip { width: 0.7em; height: 0.7em; flex: none; }
    .dots { display: flex; justify-content: center; gap: 1.5vmin; padding-top: 2vmin; }
    .dots span { width: 2vmin; height: 2vmin; border-radius: 50%; background: rgba(229, 198, 133, 0.35); }
    .dots span.on { background: var(--gold-bright); }
  `;
  const row = (card: OverlayCard, withPip: boolean) =>
    `<li><span class="qty">${card.quantity}</span>${withPip ? pip(card.pitch) : ''}<span class="name">${escapeHtml(card.name)}</span></li>`;

  const pages: { key: string; heading: string; count: number; rows: string[] }[] = model.pitchGroups.map(group => ({
    key: group.label,
    heading: `${pip(group.pitch)}${group.label}`,
    count: group.count,
    rows: group.cards.map(card => row(card, false)),
  }));
  if (showInventory && model.inventoryCount > 0) {
    pages.push({
      key: 'Inventory',
      heading: 'Inventory',
      count: model.inventoryCount,
      rows: model.inventoryGroups.flatMap(group => group.cards.map(card => row(card, true))),
    });
  }

  const body = pages
    .map((page, i) => `<section class="page${i === 0 ? ' shown' : ''}" data-page="${escapeHtml(page.key)}">
      <h2>${page.heading}<span class="count">${page.count}</span></h2>
      <ul>${page.rows.join('')}</ul>
    </section>`)
    .join('');
  const dots = pages.length > 1 ? `<div class="dots">${pages.map((_, i) => `<span${i === 0 ? ' class="on"' : ''}></span>`).join('')}</div>` : '';

  // Shrink any page whose list is taller than the space, then rotate through them.
  const script = `
    (function () {
      var root = document.querySelector('.pages');
      var pages = [].slice.call(document.querySelectorAll('.page'));
      var dots = [].slice.call(document.querySelectorAll('.dots span'));
      function fit() {
        pages.forEach(function (page) {
          page.style.fontSize = '';
          var size = parseFloat(getComputedStyle(page).fontSize);
          while (page.scrollHeight > page.clientHeight + 1 && size > 7) { size -= 0.5; page.style.fontSize = size + 'px'; }
        });
      }
      fit();
      if (document.fonts) document.fonts.ready.then(fit);
      window.addEventListener('resize', fit);
      if (pages.length < 2) return;
      var i = 0;
      setInterval(function () {
        pages[i].classList.remove('shown'); dots[i].classList.remove('on');
        i = (i + 1) % pages.length;
        pages[i].classList.add('shown'); dots[i].classList.add('on');
      }, Number(root.dataset.interval) * 1000);
    })();
  `;

  return documentShell(
    model.name,
    css,
    `<div class="panel">${header(model)}
      <div class="pages" data-interval="${intervalSec}">${body}</div>
      ${dots}
      ${FOOTER}
    </div>
    <script>${script}</script>`
  );
}

export function renderDeckOverlayHtml(model: DeckOverlayModel, options: OverlayOptions): string {
  if (options.layout === 'list') return renderList(model);
  if (options.layout === 'pages') return renderPages(model, options.intervalSec, options.showInventory ?? true);
  return renderSpotlight(model, options.intervalSec);
}
