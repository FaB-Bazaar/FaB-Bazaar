import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { watchTheme, unwatchTheme } from './utils/theme';
import { resolveDecklistViewMode } from './utils/decklist-view';
import { deckToSections, diffDecklists, type DeckCard, type DeckSection, type PitchColor, type DecklistChange } from './utils/deck-sections';


interface HudFilter {
  stat: string;
  value: number;
}

// HUD chip definitions
const COST_CHIPS = [0, 1, 2, 3, 4, 5]; // 5 = "5+"
const POWER_CHIPS = [3, 4, 5, 6, 7];   // 7 = "7+"
const DEFENSE_CHIPS = [0, 2, 3, 4];    // 0 = no defense

/**
 * fab-decklist-block - Compact card grid decklist representation
 *
 * Displays deck cards in a visual grid with card images, quantities, and section headers.
 * Includes an interactive HUD filter bar for highlighting cards by cost, power, and defense.
 *
 * @element fab-decklist-block
 *
 * @attr {string} deck-id - Optional deck public ID to fetch from API
 * @attr {string} sections - JSON string of deck sections (manual mode, no HUD)
 * @attr {string} export-url - Optional link to full decklist
 * @attr {string} notes - Optional deck notes
 * @attr {string} title - Optional custom title (default: "Decklist")
 * @attr {string} article-public-id - Allows private deck access in articles
 * @attr {string} hero-public-id - Allows private deck access in heroes
 */
@customElement('fab-decklist-block')
export class FabDecklistBlock extends LitElement {
  static styles = css`
    /* ===== HOST SETUP ===== */
    :host {
      display: block;
      margin: 2rem 0;
    }

    /* ===== LIGHT MODE (default) ===== */
    .decklist {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* ===== VIEW TOGGLE ===== */
    .view-toggle {
      display: inline-flex;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      overflow: hidden;
    }

    .view-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.3125rem 0.625rem;
      background: transparent;
      border: none;
      cursor: pointer;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }

    .view-btn + .view-btn {
      border-left: 1px solid #e2e8f0;
    }

    .view-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    .view-btn:focus-visible {
      outline: 2px solid #60a5fa;
      outline-offset: -2px;
    }

    .view-btn.active {
      background: #0f172a;
      color: white;
    }

    .view-btn svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    .export-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .export-link:hover {
      opacity: 0.7;
    }

    .export-icon {
      width: 1rem;
      height: 1rem;
    }

    .export-icon svg {
      width: 100%;
      height: 100%;
    }

    .content {
      padding: 1rem;
    }

    /* ===== HUD FILTER BAR ===== */
    .hud {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.375rem 0.625rem;
      margin-bottom: 1rem;
      background: rgba(15, 23, 42, 0.08);
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 0.5rem;
      font-size: 0.625rem;
    }

    .hud-label {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      flex-shrink: 0;
    }

    .hud-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Cost chips: icon with number overlaid */
    .hud-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      border: none;
      background: rgba(15, 23, 42, 0.12);
      cursor: pointer;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #1e293b;
      transition: background 0.1s, opacity 0.1s;
      line-height: 1;
    }

    .hud-chip:hover:not(.zero) {
      background: rgba(15, 23, 42, 0.2);
    }

    .hud-chip.active {
      background: #f59e0b;
      color: white;
      box-shadow: 0 0 0 1px #d97706;
    }

    .hud-chip.zero {
      opacity: 0.3;
      cursor: default;
    }

    /* Cost chip: icon with number centered on top */
    .hud-cost-icon-wrap {
      position: relative;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .hud-cost-icon-wrap img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }

    .hud-cost-icon-wrap span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.5rem;
      font-weight: 800;
      color: white;
      text-shadow: 0 0 3px rgba(0,0,0,1), 0 0 1px rgba(0,0,0,1);
      line-height: 1;
    }

    /* Stat icon (power/defense/pitch) */
    .hud-stat-icon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .hud-divider {
      width: 1px;
      height: 14px;
      background: rgba(15, 23, 42, 0.15);
      flex-shrink: 0;
    }

    .hud-clear {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 0.625rem;
      font-weight: 500;
      color: #94a3b8;
      transition: color 0.1s;
      margin-left: auto;
    }

    .hud-clear:hover {
      color: #64748b;
    }

    /* ===== SECTION STYLES ===== */
    .section {
      margin-bottom: 1rem;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem 0.5rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.375rem;
    }

    .pitch-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .pitch-dot.red { background: #ef4444; }
    .pitch-dot.yellow { background: #eab308; }
    .pitch-dot.blue { background: #3b82f6; }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .section-title.library {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .section-count {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* ===== CARD GRID ===== */
    .cards-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    /* ===== CARD ITEM (grid view) ===== */
    .card-item {
      width: 72px;
      flex-shrink: 0;
      transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
    }

    .card-item.dimmed {
      opacity: 0.18;
      filter: grayscale(1);
      transform: scale(0.95);
    }

    .card-item.highlighted .card-image-wrapper {
      box-shadow: 0 0 0 2px #f59e0b, 0 0 14px rgba(245, 158, 11, 0.55);
    }

    .card-image-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border-radius: 4px;
      overflow: hidden;
      background: #080c14;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }

    .card-image-wrapper:hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      z-index: 1;
    }

    .card-item.highlighted .card-image-wrapper:hover {
      box-shadow: 0 0 0 2px #f59e0b, 0 6px 18px rgba(245, 158, 11, 0.6);
    }

    /* Top slice: name banner + artwork (~top 55% of card) */
    .card-image-top {
      width: 100%;
      height: 55px;
      object-fit: cover;
      object-position: top;
      display: block;
      flex-shrink: 0;
    }

    /* Bottom slice: type/stats frame (~bottom 13% of card) */
    .card-image-bottom {
      width: 100%;
      height: 13px;
      object-fit: cover;
      object-position: bottom;
      display: block;
      flex-shrink: 0;
    }

    /* Fallback: single full card (cardback or no-image) */
    .card-image {
      width: 100%;
      height: 69px;
      object-fit: cover;
      display: block;
    }

    /* Hover name overlay — sits over the top slice only */
    .card-name-hover {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 55px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0 3px 4px;
      background: linear-gradient(transparent 30%, rgba(0, 0, 0, 0.85));
      color: white;
      font-size: 0.5rem;
      font-weight: 600;
      text-align: center;
      line-height: 1.2;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }

    .card-image-wrapper:hover .card-name-hover {
      opacity: 1;
    }

    .quantity-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }

    .foil-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 3px;
      backdrop-filter: blur(4px);
    }

    .foil-badge.nf {
      background: rgba(100, 116, 139, 0.85);
      color: white;
    }

    .foil-badge.rf {
      background: rgba(234, 179, 8, 0.9);
      color: #1e293b;
    }

    .foil-badge.cf {
      background: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4);
      color: white;
    }

    /* ===== LIST VIEW =====
       Lane-row pattern ported from the deck page: rail · thumb · qty · name · cost.
       Rows are real buttons (keyboard reachable) with a 38px min tap target. */
    .cards-list {
      display: flex;
      flex-direction: column;
    }

    .list-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      min-height: 38px;
      padding: 0 0.5rem 0 0;
      margin: 0;
      border: none;
      background: none;
      font: inherit;
      text-align: left;
      border-radius: 3px;
      overflow: hidden;
      transition: background 0.1s, opacity 0.2s, filter 0.2s;
      cursor: pointer;
    }

    .list-row:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .list-row:focus-visible {
      outline: 2px solid #60a5fa;
      outline-offset: -2px;
    }

    .list-row.dimmed {
      opacity: 0.2;
      filter: grayscale(1);
    }

    .list-row.highlighted {
      background: rgba(245, 158, 11, 0.1);
    }

    /* Pitch rail — colored bar keyed to the section's pitch; neutral when unknown. */
    .list-rail {
      align-self: stretch;
      width: 3px;
      flex-shrink: 0;
      background: #cbd5e1;
    }

    .list-rail.red { background: #ef4444; }
    .list-rail.yellow { background: #eab308; }
    .list-rail.blue { background: #3b82f6; }

    .list-row.highlighted .list-rail {
      background: #f59e0b;
    }

    .list-card-thumb {
      width: 24px;
      height: 34px;
      border-radius: 2px;
      object-fit: cover;
      object-position: top;
      flex-shrink: 0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    .list-card-qty {
      font-size: 0.875rem;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #475569;
      min-width: 1.5rem;
      text-align: right;
      flex-shrink: 0;
    }

    .list-card-name {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .list-cost-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: #475569;
      flex-shrink: 0;
    }

    /* Only show foil badge for non-NF cards */
    .list-foil-badge {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .list-foil-badge.nf {
      display: none;
    }

    .list-foil-badge.rf {
      background: rgba(234, 179, 8, 0.2);
      color: #92400e;
    }

    .list-foil-badge.cf {
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15));
      color: #6d28d9;
    }

    /* ===== NOTES ===== */
    .notes {
      background: #fef3c7;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0.5rem 0.5rem;
    }

    .notes-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }

    .notes-text {
      font-size: 0.875rem;
      color: #1e293b;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* ===== LOADING STATE ===== */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #64748b;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.75rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ===== DARK MODE ===== */
    :host([dark]) .decklist {
      background: #1e293b;
      border-color: #334155;
    }

    :host([dark]) .header {
      border-bottom-color: #334155;
    }

    :host([dark]) .title {
      color: #f1f5f9;
    }

    :host([dark]) .view-toggle {
      border-color: #334155;
    }

    :host([dark]) .view-btn {
      color: #94a3b8;
    }

    :host([dark]) .view-btn + .view-btn {
      border-left-color: #334155;
    }

    :host([dark]) .view-btn:hover {
      background: #0f172a;
      color: #f1f5f9;
    }

    :host([dark]) .view-btn.active {
      background: #f1f5f9;
      color: #0f172a;
    }

    :host([dark]) .hud {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.08);
    }

    :host([dark]) .hud-label {
      color: #94a3b8;
    }

    :host([dark]) .hud-chip {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
    }

    :host([dark]) .hud-chip:hover:not(.zero) {
      background: rgba(255, 255, 255, 0.14);
    }

    :host([dark]) .hud-divider {
      background: rgba(255, 255, 255, 0.1);
    }

    :host([dark]) .hud-clear {
      color: #64748b;
    }

    :host([dark]) .hud-clear:hover {
      color: #94a3b8;
    }

    :host([dark]) .section-header {
      border-bottom-color: #334155;
    }

    :host([dark]) .section-title {
      color: #f1f5f9;
    }

    :host([dark]) .section-count {
      color: #94a3b8;
    }

    :host([dark]) .card-image-wrapper {
      background: #0f172a;
    }

    :host([dark]) .list-row:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    :host([dark]) .list-row.highlighted {
      background: rgba(245, 158, 11, 0.12);
    }

    :host([dark]) .list-card-name {
      color: #e2e8f0;
    }

    :host([dark]) .list-card-qty {
      color: #94a3b8;
    }

    :host([dark]) .list-rail {
      background: #475569;
    }

    :host([dark]) .list-rail.red { background: #ef4444; }
    :host([dark]) .list-rail.yellow { background: #eab308; }
    :host([dark]) .list-rail.blue { background: #3b82f6; }
    :host([dark]) .list-row.highlighted .list-rail { background: #f59e0b; }

    :host([dark]) .list-cost-badge {
      background: rgba(255, 255, 255, 0.06);
      border-color: #334155;
      color: #cbd5e1;
    }

    :host([dark]) .list-foil-badge.rf {
      background: rgba(234, 179, 8, 0.2);
      color: #fcd34d;
    }

    :host([dark]) .list-foil-badge.cf {
      color: #a78bfa;
    }

    :host([dark]) .notes {
      background: #422006;
    }

    :host([dark]) .notes-title {
      color: #f1f5f9;
    }

    :host([dark]) .notes-text {
      color: #e2e8f0;
    }

    :host([dark]) .loading {
      color: #94a3b8;
    }

    :host([dark]) .loading-spinner {
      border-color: #334155;
      border-top-color: #60a5fa;
    }

    /* ===== SYSTEM DARK MODE (fallback) ===== */
    :host([dark]) .decklist { background: #1e293b; border-color: #334155; }
    :host([dark]) .header { border-bottom-color: #334155; }
    :host([dark]) .title { color: #f1f5f9; }
    :host([dark]) .view-toggle { border-color: #334155; }
    :host([dark]) .view-btn { color: #94a3b8; }
    :host([dark]) .view-btn + .view-btn { border-left-color: #334155; }
    :host([dark]) .view-btn:hover { background: #0f172a; color: #f1f5f9; }
    :host([dark]) .view-btn.active { background: #f1f5f9; color: #0f172a; }
    :host([dark]) .hud { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
    :host([dark]) .hud-chip { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: #cbd5e1; }
    :host([dark]) .hud-chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
    :host([dark]) .hud-divider { background: rgba(255,255,255,0.1); }
    :host([dark]) .hud-group-icon { filter: invert(1); opacity: 0.6; }
    :host([dark]) .section-header { border-bottom-color: #334155; }
    :host([dark]) .section-title { color: #f1f5f9; }
    :host([dark]) .section-count { color: #94a3b8; }
    :host([dark]) .card-image-wrapper { background: #0f172a; }
    :host([dark]) .list-row:hover { background: rgba(255,255,255,0.04); }
    :host([dark]) .list-row.highlighted { background: rgba(245,158,11,0.12); }
    :host([dark]) .list-card-name { color: #e2e8f0; }
    :host([dark]) .list-card-qty { color: #94a3b8; }
    :host([dark]) .list-rail { background: #475569; }
    :host([dark]) .list-rail.red { background: #ef4444; }
    :host([dark]) .list-rail.yellow { background: #eab308; }
    :host([dark]) .list-rail.blue { background: #3b82f6; }
    :host([dark]) .list-row.highlighted .list-rail { background: #f59e0b; }
    :host([dark]) .list-cost-badge { background: rgba(255,255,255,0.06); border-color: #334155; color: #cbd5e1; }
    :host([dark]) .list-foil-badge.nf { background: rgba(100,116,139,0.3); color: #94a3b8; }
    :host([dark]) .list-foil-badge.rf { background: rgba(234,179,8,0.2); color: #fcd34d; }
    :host([dark]) .list-foil-badge.cf { color: #a78bfa; }
    :host([dark]) .notes { background: #422006; }
    :host([dark]) .notes-title { color: #f1f5f9; }
    :host([dark]) .notes-text { color: #e2e8f0; }
    :host([dark]) .loading { color: #94a3b8; }
    :host([dark]) .loading-spinner { border-color: #334155; border-top-color: #60a5fa; }

    /* ===== CARD OVERLAY ===== */
    .card-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.88);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      animation: overlayIn 0.15s ease;
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .card-overlay-img {
      max-height: 88vh;
      max-width: min(88vw, 320px);
      border-radius: 10px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
      pointer-events: none;
      animation: overlayImgIn 0.15s ease;
    }

    @keyframes overlayImgIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    /* Snapshot tabs: the article's frozen list / the deck today / the diff.
       Classic tabs — the open one takes the panel colour and joins it. */
    .snap-tabs {
      display: flex;
      flex-wrap: wrap;
      padding: 0 1rem;
      border-bottom: 1px solid #fde047;
    }
    .snap-tab {
      margin-bottom: -1px;
      padding: 0.375rem 0.75rem;
      background: none;
      border: 1px solid transparent;
      border-bottom: 0;
      border-radius: 0.25rem 0.25rem 0 0;
      font: inherit;
      font-size: 0.875rem;
      color: #64748b;
      cursor: pointer;
    }
    .snap-tab:hover { color: #0f172a; }
    .snap-tab[aria-selected='true'] {
      background: #fefce8;
      border-color: #fde047;
      color: #0f172a;
      font-weight: 600;
    }
    .snap-tab:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
    .snap-note { margin: 0.5rem 0; font-size: 0.875rem; color: #64748b; }
    .changes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
    .change-title { margin: 0 0 0.25rem; font-size: 0.875rem; font-weight: 600; color: #0f172a; }
    .change-list { list-style: none; margin: 0; padding: 0; font-size: 0.875rem; color: #0f172a; }
    .change-list li { display: flex; align-items: center; gap: 0.375rem; padding: 0.125rem 0; }
    :host([dark]) .snap-tabs { border-bottom-color: #334155; }
    :host([dark]) .snap-tab { color: #94a3b8; }
    :host([dark]) .snap-tab:hover { color: #f1f5f9; }
    :host([dark]) .snap-tab[aria-selected='true'] { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host([dark]) .snap-note { color: #94a3b8; }
    :host([dark]) .change-title, :host([dark]) .change-list { color: #f1f5f9; }

  `;

  @property({ attribute: 'deck-id' }) deckId = '';
  @property() sections = '';
  @property({ attribute: 'export-url' }) exportUrl = '';
  @property() notes = '';
  @property() title = 'Decklist';
  @property({ attribute: 'article-public-id' }) articlePublicId = '';
  @property({ attribute: 'hero-public-id' }) heroPublicId = '';
  /**
   * JSON { label, takenAt, title?, exportUrl?, sections } — the list frozen when
   * the article was written. Shown first; "Current list" / "What's changed"
   * load the live deck (deck-id) on demand.
   */
  @property() snapshot = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _deckData: {
    sections: DeckSection[];
    title?: string;
    exportUrl?: string;
    notes?: string;
  } | null = null;
  @state() private _viewMode: 'grid' | 'list' = 'grid';
  @state() private _highlightFilters: HudFilter[] = [];
  @state() private _overlayImage: string | null = null;
  @state() private _tab: 'snapshot' | 'current' | 'changes' = 'snapshot';
  private _snap: { label: string; takenAt?: string; title?: string; exportUrl?: string; sections: DeckSection[] } | null = null;
  // The sections the stat filter bar counts — whatever list is on screen.
  private _hudSections: DeckSection[] = [];

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._overlayImage = null;
  };

  private _lastFetchedDeckId = '';
  private _imageUrlById = new Map<string, string>();
  // Ids we've already looked up (hit or miss) — never retried, so a lookup that
  // returns nothing can't loop against the requestUpdate() below.
  private _attemptedImageIds = new Set<string>();

  override connectedCallback() {
    super.connectedCallback();
    watchTheme(this);
    document.addEventListener('keydown', this._onKeyDown);
    // Saved choice wins; otherwise phones read better as a list (deck-page parity).
    this._viewMode = resolveDecklistViewMode(
      localStorage.getItem('fab-decklist-view'),
      window.matchMedia('(max-width: 640px)').matches,
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    unwatchTheme(this);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('snapshot')) {
      try {
        const parsed = this.snapshot ? JSON.parse(this.snapshot) : null;
        this._snap = parsed && Array.isArray(parsed.sections) ? parsed : null;
      } catch {
        this._snap = null;
      }
    }
  }

  // With a snapshot the live deck is fetched only when a reader asks for it.
  protected firstUpdated() {
    if (this.deckId && !this._lastFetchedDeckId && !this.snapshot) {
      this._fetchDeck();
    }
  }

  protected updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('deckId') && this.deckId && this.deckId !== this._lastFetchedDeckId && !this.snapshot) {
      this._fetchDeck();
    }
  }

  private _setTab(tab: 'snapshot' | 'current' | 'changes') {
    this._tab = tab;
    this._highlightFilters = [];
    if (tab !== 'snapshot' && !this._deckData && !this._loading && this.deckId) this._fetchDeck();
  }

  private _setViewMode(mode: 'grid' | 'list') {
    this._viewMode = mode;
    localStorage.setItem('fab-decklist-view', mode);
  }

  private _toggleFilter(stat: string, value: number) {
    const idx = this._highlightFilters.findIndex(f => f.stat === stat && f.value === value);
    if (idx >= 0) {
      this._highlightFilters = this._highlightFilters.filter((_, i) => i !== idx);
    } else {
      this._highlightFilters = [...this._highlightFilters, { stat, value }];
    }
  }

  private _isFilterActive(stat: string, value: number): boolean {
    return this._highlightFilters.some(f => f.stat === stat && f.value === value);
  }

  private _matchesStat(card: DeckCard, stat: string, value: number): boolean {
    switch (stat) {
      case 'pitch':
        return card.pitch === value;
      case 'cost':
        if (card.cost === null) return false;
        return value === 5 ? card.cost >= 5 : card.cost === value;
      case 'power':
        if (card.power === null) return false;
        return value === 7 ? card.power >= 7 : card.power === value;
      case 'defense':
        if (value === 0) return card.defense === null || card.defense === 0;
        return card.defense === value;
      default:
        return false;
    }
  }

  private _matchesAllFilters(card: DeckCard): boolean {
    return this._highlightFilters.every(f => this._matchesStat(card, f.stat, f.value));
  }

  private _computeAllCards(): DeckCard[] {
    return this._hudSections.flatMap(s => s.cards);
  }

  // Count total copies (with quantity) matching a chip
  private _getChipCount(stat: string, value: number): number {
    return this._computeAllCards().reduce((sum, card) => {
      return sum + (this._matchesStat(card, stat, value) ? card.quantity : 0);
    }, 0);
  }

  private async _fetchDeck() {
    if (!this.deckId) return;

    this._loading = true;
    this._error = '';
    this._highlightFilters = [];
    this._lastFetchedDeckId = this.deckId;

    try {
      const params = new URLSearchParams();
      if (this.articlePublicId) {
        params.set('articlePublicId', this.articlePublicId);
      } else if (this.heroPublicId) {
        params.set('heroPublicId', this.heroPublicId);
      }

      const queryString = params.toString();
      const url = `/api/decks/${this.deckId}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch deck');
      }

      this._deckData = deckToSections(result.data);
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to fetch deck';
    } finally {
      this._loading = false;
    }
  }

  /**
   * Resolve the CDN url for a card. Images are keyed by printing characteristics,
   * not by printing_id, so the url must come from the printing row (deck API) or
   * from a lookup — an id-derived url 404s and falls back to the cardback.
   */
  private getCardImageUrl(card: Pick<DeckCard, 'printingId' | 'imageUrl'>): string {
    return card.imageUrl || this._imageUrlById.get(card.printingId) || '';
  }

  /**
   * Hand-authored `sections` JSON carries printing ids without image urls.
   * Look them up the same way fab-match-report does.
   */
  private async _fetchMissingImages(printingIds: string[]) {
    const missing = [...new Set(printingIds)].filter(
      (id) => id && !this._attemptedImageIds.has(id)
    );
    if (missing.length === 0) return;

    missing.forEach((id) => this._attemptedImageIds.add(id));
    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(missing.join(','))}&show=all&limit=${missing.length}`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        for (const p of printings) {
          if (p?.printing_id && p?.image_url) {
            this._imageUrlById.set(p.printing_id, p.image_url);
          }
        }
        this.requestUpdate();
      }
    } catch {
      // Leave the cardback fallback in place.
    }
  }

  private getFoilingClass(foiling?: string): string {
    if (!foiling) return 'nf';
    const f = foiling.toLowerCase();
    if (f.includes('rainbow') || f.includes('rf')) return 'rf';
    if (f.includes('cold') || f.includes('cf')) return 'cf';
    return 'nf';
  }

  private getFoilingText(foiling?: string): string {
    if (!foiling) return 'NF';
    const f = foiling.toLowerCase();
    if (f.includes('rainbow') || f.includes('rf')) return 'RF';
    if (f.includes('cold') || f.includes('cf')) return 'CF';
    return 'NF';
  }

  private renderHud() {
    const allCards = this._computeAllCards();
    if (allCards.length === 0) return null;

    // Pitch chips — just the dot icon
    const pitchChips = ([1, 2, 3] as const).map(v => {
      const count = this._getChipCount('pitch', v);
      const active = this._isFilterActive('pitch', v);
      return html`
        <button
          class="hud-chip ${active ? 'active' : ''} ${count === 0 ? 'zero' : ''}"
          @click="${() => count > 0 && this._toggleFilter('pitch', v)}"
          title="Pitch ${v} (${count} cards)"
        >
          <img class="hud-stat-icon" src="/fab/symbols/pitch${v}.png" alt="Pitch ${v}" />
        </button>
      `;
    });

    // Cost chips — icon with number overlaid
    const costChips = COST_CHIPS.map(v => {
      const label = v === 5 ? '5+' : String(v);
      const count = this._getChipCount('cost', v);
      const active = this._isFilterActive('cost', v);
      return html`
        <button
          class="hud-chip ${active ? 'active' : ''} ${count === 0 ? 'zero' : ''}"
          @click="${() => count > 0 && this._toggleFilter('cost', v)}"
          title="Cost ${label} (${count} cards)"
        >
          <div class="hud-cost-icon-wrap">
            <img src="/fab/symbols/cost.png" alt="Cost" />
            <span>${label}</span>
          </div>
        </button>
      `;
    });

    // Power chips — number left of icon
    const powerChips = POWER_CHIPS.map(v => {
      const label = v === 7 ? '7+' : String(v);
      const count = this._getChipCount('power', v);
      const active = this._isFilterActive('power', v);
      return html`
        <button
          class="hud-chip ${active ? 'active' : ''} ${count === 0 ? 'zero' : ''}"
          @click="${() => count > 0 && this._toggleFilter('power', v)}"
          title="Power ${label} (${count} cards)"
        >
          <span>${label}</span>
          <img class="hud-stat-icon" src="/fab/symbols/power.png" alt="Power" />
        </button>
      `;
    });

    // Defense chips — number left of icon
    const defenseChips = DEFENSE_CHIPS.map(v => {
      const count = this._getChipCount('defense', v);
      const active = this._isFilterActive('defense', v);
      return html`
        <button
          class="hud-chip ${active ? 'active' : ''} ${count === 0 ? 'zero' : ''}"
          @click="${() => count > 0 && this._toggleFilter('defense', v)}"
          title="Defense ${v} (${count} cards)"
        >
          <span>${v}</span>
          <img class="hud-stat-icon" src="/fab/symbols/block.png" alt="Defense" />
        </button>
      `;
    });

    return html`
      <div class="hud">
        <span class="hud-label">Highlight</span>
        <div class="hud-group">${pitchChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${costChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${powerChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${defenseChips}</div>
        ${this._highlightFilters.length > 0 ? html`
          <button class="hud-clear" @click="${() => { this._highlightFilters = []; }}">
            × clear
          </button>
        ` : ''}
      </div>
    `;
  }

  private renderGridView(cards: DeckCard[]) {
    const hasFilters = this._highlightFilters.length > 0;
    // Expand each card to individual copies (3x Boom Grenade → 3 tiles)
    const tiles = cards.flatMap(card =>
      Array.from({ length: card.quantity }, () => card)
    );
    return html`
      <div class="cards-grid">
        ${tiles.map(card => {
          const matched = hasFilters && this._matchesAllFilters(card);
          const dimmed = hasFilters && !this._matchesAllFilters(card);
          const imageUrl = this.getCardImageUrl(card);
          return html`
            <div class="card-item ${matched ? 'highlighted' : ''} ${dimmed ? 'dimmed' : ''}">
              <div class="card-image-wrapper" @click="${() => imageUrl && (this._overlayImage = imageUrl)}">
                ${imageUrl ? html`
                  <img
                    class="card-image-top"
                    src="${imageUrl}"
                    alt="${card.cardName}"
                    loading="lazy"
                    @error=${(e: Event) => {
                      (e.target as HTMLImageElement).src = '/cardback.webp';
                      const wrapper = (e.target as HTMLElement).closest('.card-image-wrapper');
                      const bottom = wrapper?.querySelector('.card-image-bottom') as HTMLImageElement | null;
                      if (bottom) bottom.style.display = 'none';
                    }}
                  />
                  <img
                    class="card-image-bottom"
                    src="${imageUrl}"
                    alt=""
                    loading="lazy"
                  />
                ` : html`
                  <img class="card-image" src="/cardback.webp" alt="${card.cardName}" />
                `}
                ${this.getFoilingText(card.foiling) !== 'NF' ? html`
                  <span class="foil-badge ${this.getFoilingClass(card.foiling)}">
                    ${this.getFoilingText(card.foiling)}
                  </span>
                ` : ''}
                <div class="card-name-hover">${card.cardName}</div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderListView(cards: DeckCard[]) {
    const hasFilters = this._highlightFilters.length > 0;
    return html`
      <div class="cards-list">
        ${cards.map(card => {
          const matched = hasFilters && this._matchesAllFilters(card);
          const dimmed = hasFilters && !this._matchesAllFilters(card);
          const imageUrl = this.getCardImageUrl(card);
          const railClass = card.pitch === 1 ? 'red' : card.pitch === 2 ? 'yellow' : card.pitch === 3 ? 'blue' : '';
          return html`
            <button
              type="button"
              class="list-row ${matched ? 'highlighted' : ''} ${dimmed ? 'dimmed' : ''}"
              data-testid="decklist-list-row"
              @click="${() => imageUrl && (this._overlayImage = imageUrl)}"
            >
              <span class="list-rail ${railClass}" data-testid="list-row-rail" aria-hidden="true"></span>
              ${imageUrl ? html`
                <img
                  class="list-card-thumb"
                  src="${imageUrl}"
                  alt=""
                  loading="lazy"
                  @error=${(e: Event) => {
                    (e.target as HTMLImageElement).src = '/cardback.webp';
                  }}
                />
              ` : html`
                <img class="list-card-thumb" src="/cardback.webp" alt="" />
              `}
              <span class="list-card-qty">${card.quantity}×</span>
              <span class="list-card-name">${card.cardName}</span>
              ${card.cost !== null ? html`
                <span class="list-cost-badge" data-testid="list-row-cost" title="Resource cost" aria-label="Costs ${card.cost}">
                  ${card.cost}
                </span>
              ` : ''}
              <span class="list-foil-badge ${this.getFoilingClass(card.foiling)}">
                ${this.getFoilingText(card.foiling)}
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  render() {
    if (this._snap) return this.renderSnapshotMode(this._snap);
    if (this._loading) {
      return html`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div class="loading">
            <div class="loading-spinner"></div>
            <span>Loading deck...</span>
          </div>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div style="color: #ef4444; padding: 1.5rem; text-align: center;">
            Error: ${this._error}
          </div>
        </div>
      `;
    }

    let sectionsData: DeckSection[] = [];
    let effectiveTitle = this.title;
    let effectiveExportUrl = this.exportUrl;
    let effectiveNotes = this.notes;
    const hasApiData = !!this._deckData;

    if (this._deckData) {
      sectionsData = this._deckData.sections;
      effectiveTitle = this.title !== 'Decklist' ? this.title : (this._deckData.title || 'Decklist');
      effectiveExportUrl = this.exportUrl || this._deckData.exportUrl || '';
      effectiveNotes = this.notes || this._deckData.notes || '';
    } else if (this.sections) {
      try {
        const parsed = JSON.parse(this.sections);
        sectionsData = parsed.map((section: any) => ({
          label: section.label,
          pitchColor: null as PitchColor,
          totalCards: section.cards?.length || 0,
          uniqueCards: section.cards?.length || 0,
          cards: (section.cards || []).map((card: any) => {
            if (typeof card === 'string') {
              const match = card.match(/^(\d+)x\s+(.+)$/);
              if (match) {
                return { cardName: match[2], printingId: '', quantity: parseInt(match[1], 10), pitch: null, cost: null, power: null, defense: null, types: [], keywords: [] };
              }
              return { cardName: card, printingId: '', quantity: 1, pitch: null, cost: null, power: null, defense: null, types: [], keywords: [] };
            }
            return {
              pitch: null, cost: null, power: null, defense: null, types: [], keywords: [],
              ...card,
              imageUrl: card.imageUrl || card.image_url || undefined,
              quantity: card.quantity || 1,
            };
          }),
        }));
        // Authored JSON only carries printing ids — resolve their image urls.
        const unresolved = sectionsData
          .flatMap(s => s.cards)
          .filter(c => c.printingId && !c.imageUrl)
          .map(c => c.printingId);
        if (unresolved.length > 0) this._fetchMissingImages(unresolved);
      } catch (e) {
        return html`<div style="color: #ef4444; padding: 1rem;">Error: Invalid sections data</div>`;
      }
    } else if (this.deckId) {
      return html``;
    } else {
      return html``;
    }

    if (sectionsData.length === 0) return html``;
    return this.renderBlock(sectionsData, effectiveTitle, effectiveExportUrl, effectiveNotes, hasApiData);
  }

  private renderBlock(
    sectionsData: DeckSection[],
    effectiveTitle: string,
    effectiveExportUrl: string,
    effectiveNotes: string,
    showHud: boolean,
    tabs: unknown = '',
    body: unknown = null,
  ) {
    this._hudSections = sectionsData;
    return html`
      <div class="decklist">
        <div class="header">
          <h3 class="title">${effectiveTitle}</h3>
          <div class="header-actions">
            <div class="view-toggle" role="group" aria-label="View mode">
              <button
                class="view-btn ${this._viewMode === 'grid' ? 'active' : ''}"
                @click="${() => this._setViewMode('grid')}"
                title="Grid view"
                aria-label="Grid view"
                aria-pressed="${this._viewMode === 'grid'}"
              >
                ${this.renderGridIcon()} Grid
              </button>
              <button
                class="view-btn ${this._viewMode === 'list' ? 'active' : ''}"
                @click="${() => this._setViewMode('list')}"
                title="List view"
                aria-label="List view"
                aria-pressed="${this._viewMode === 'list'}"
              >
                ${this.renderListIcon()} List
              </button>
            </div>
            ${effectiveExportUrl ? html`
              <a
                href="${effectiveExportUrl}"
                class="export-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Full List
                <span class="export-icon">${this.renderExternalLinkIcon()}</span>
              </a>
            ` : ''}
          </div>
        </div>
        ${tabs}
        <div class="content">
          ${body ?? html`${showHud ? this.renderHud() : ''}
          ${sectionsData.map(section => html`
            <div class="section">
              <div class="section-header">
                ${section.pitchColor ? html`<span class="pitch-dot ${section.pitchColor}"></span>` : ''}
                <h4 class="section-title ${section.pitchColor ? 'library' : ''}">${section.label}</h4>
                ${section.totalCards ? html`
                  <span class="section-count">
                    ${section.totalCards} ${section.totalCards === 1 ? 'card' : 'cards'}${section.uniqueCards && section.uniqueCards !== section.totalCards
                      ? html` • ${section.uniqueCards} unique`
                      : ''}
                  </span>
                ` : ''}
              </div>
              ${this._viewMode === 'list'
                ? this.renderListView(section.cards)
                : this.renderGridView(section.cards)}
            </div>
          `)}`}
          ${effectiveNotes ? html`
            <div class="notes">
              <div class="notes-title">Notes</div>
              <div class="notes-text">${effectiveNotes}</div>
            </div>
          ` : ''}
        </div>
      </div>
      ${this._overlayImage ? html`
        <div class="card-overlay" @click="${() => this._overlayImage = null}">
          <img
            class="card-overlay-img"
            src="${this._overlayImage}"
            alt="Card preview"
          />
        </div>
      ` : ''}
    `;
  }

  private renderSnapshotMode(snap: NonNullable<typeof this._snap>) {
    const title = this.title !== 'Decklist' ? this.title : (snap.title || 'Decklist');
    const exportUrl = this.exportUrl || snap.exportUrl || '';
    const tab = (id: 'snapshot' | 'current' | 'changes', label: string) => html`<button
      type="button" role="tab" class="snap-tab" aria-selected="${this._tab === id}"
      @click="${() => this._setTab(id)}">${label}</button>`;
    const tabs = html`<div class="snap-tabs" role="tablist" aria-label="Decklist version">
      ${tab('snapshot', snap.label || 'At the time of writing')}
      ${this.deckId ? html`${tab('current', 'Current list')}${tab('changes', "What's changed")}` : ''}
    </div>`;

    if (this._tab === 'snapshot') return this.renderBlock(snap.sections, title, exportUrl, this.notes, true, tabs);
    if (this._loading || !this._deckData) {
      const note = this._error ? `Couldn't load the current list: ${this._error}` : 'Loading the current list…';
      return this.renderBlock([], title, exportUrl, '', false, tabs, html`<p class="snap-note">${note}</p>`);
    }
    if (this._tab === 'current') return this.renderBlock(this._deckData.sections, title, exportUrl, this.notes, true, tabs);
    return this.renderBlock([], title, exportUrl, '', false, tabs, this.renderChanges(snap));
  }

  private renderChanges(snap: NonNullable<typeof this._snap>) {
    const { added, removed } = diffDecklists(snap.sections, this._deckData!.sections);
    const since = snap.label || 'the article';
    if (added.length === 0 && removed.length === 0) return html`<p class="snap-note">No changes since ${since}.</p>`;
    const dot = (p: number | null) => p === 1 ? 'red' : p === 2 ? 'yellow' : p === 3 ? 'blue' : '';
    const list = (items: DecklistChange[]) => html`<ul class="change-list">${items.map(c => html`
      <li>${dot(c.pitch) ? html`<span class="pitch-dot ${dot(c.pitch)}"></span>` : ''}${c.quantity}× ${c.cardName}</li>`)}</ul>`;
    return html`<div class="changes">
      <section aria-label="Added since the article"><h4 class="change-title">Added since ${since}</h4>${added.length ? list(added) : html`<p class="snap-note">Nothing added.</p>`}</section>
      <section aria-label="Removed since the article"><h4 class="change-title">Removed since ${since}</h4>${removed.length ? list(removed) : html`<p class="snap-note">Nothing removed.</p>`}</section>
    </div>`;
  }

  private renderGridIcon() {
    return html`
      <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="6" height="6" rx="1"/>
        <rect x="9" y="1" width="6" height="6" rx="1"/>
        <rect x="1" y="9" width="6" height="6" rx="1"/>
        <rect x="9" y="9" width="6" height="6" rx="1"/>
      </svg>
    `;
  }

  private renderListIcon() {
    return html`
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="4" x2="14" y2="4"/>
        <line x1="4" y1="8" x2="14" y2="8"/>
        <line x1="4" y1="12" x2="14" y2="12"/>
        <circle cx="1.5" cy="4" r="1" fill="currentColor" stroke="none"/>
        <circle cx="1.5" cy="8" r="1" fill="currentColor" stroke="none"/>
        <circle cx="1.5" cy="12" r="1" fill="currentColor" stroke="none"/>
      </svg>
    `;
  }

  private renderExternalLinkIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-decklist-block': FabDecklistBlock;
  }
}
