import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * fab-creator-spotlight - Content creator profile feature component
 *
 * @element fab-creator-spotlight
 *
 * @attr {string} image-url - URL of the creator's profile image
 * @attr {string} name - Creator's name (used in simple mode)
 * @attr {string} bio - Creator's bio text (used in simple mode)
 * @attr {string} links - JSON string of links array (used in simple mode)
 *
 * @slot header - Custom header content (advanced mode)
 * @slot links - Custom links content (advanced mode)
 *
 * @example Simple mode (attributes):
 * ```html
 * <fab-creator-spotlight
 *   image-url="https://example.com/avatar.jpg"
 *   name="Creator Name"
 *   bio="Bio text here"
 *   links='[{"href":"https://patreon.com/creator","label":"Patreon","icon":"patreon"}]'>
 * </fab-creator-spotlight>
 * ```
 *
 * @example Advanced mode (slots):
 * ```html
 * <fab-creator-spotlight image-url="https://example.com/avatar.jpg">
 *   <div slot="header">
 *     <h3>Creator Name</h3>
 *     <p>Custom bio with <strong>formatting</strong></p>
 *   </div>
 *   <div slot="links">
 *     <a href="...">Patreon</a>
 *     <a href="...">Discord</a>
 *   </div>
 * </fab-creator-spotlight>
 * ```
 */
@customElement('fab-creator-spotlight')
export class FabCreatorSpotlight extends LitElement {
  static styles = css`
    :host {
      /* CSS Variables for theming */
      --fab-spotlight-bg-start: #dbeafe;
      --fab-spotlight-bg-end: #e0e7ff;
      --fab-spotlight-border: #cbd5e1;
      --fab-spotlight-text: #0f172a;
      --fab-spotlight-text-muted: #475569;
      --fab-spotlight-avatar-bg: #ffffff;
      --fab-spotlight-link-bg: #ffffff;
      --fab-spotlight-link-text: #3b82f6;
      --fab-spotlight-link-border: #cbd5e1;
      --fab-spotlight-link-hover-bg: #f1f5f9;

      display: block;
      margin: 2rem 0;
    }

    .spotlight {
      background: linear-gradient(to right, var(--fab-spotlight-bg-start), var(--fab-spotlight-bg-end));
      border: 1px solid var(--fab-spotlight-border);
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .avatar {
      flex-shrink: 0;
      background: var(--fab-spotlight-avatar-bg);
      border-radius: 9999px;
      padding: 0.25rem;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .avatar img {
      width: 4.375rem;
      height: 4.375rem;
      border-radius: 9999px;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 4.375rem;
      height: 4.375rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-placeholder svg {
      width: 2.5rem;
      height: 2.5rem;
      color: #6366f1;
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    /* Simple mode styles */
    .name {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fab-spotlight-text);
    }

    .bio {
      margin: 0 0 1rem 0;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
      line-height: 1.5;
    }

    .links-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .link-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--fab-spotlight-link-bg);
      color: var(--fab-spotlight-link-text);
      border: 1px solid var(--fab-spotlight-link-border);
      border-radius: 0.375rem;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .link-button:hover {
      background: var(--fab-spotlight-link-hover-bg);
    }

    .link-button svg {
      width: 1rem;
      height: 1rem;
    }

    /* Slot styles */
    ::slotted([slot="header"]) {
      margin-bottom: 1rem;
    }

    ::slotted([slot="header"] h3) {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fab-spotlight-text);
    }

    ::slotted([slot="header"] p) {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
      line-height: 1.5;
    }
  `;

  @property({ attribute: 'image-url' }) imageUrl = '';
  @property() name = '';
  @property() bio = '';
  @property() links = ''; // JSON string

  render() {
    // Check if using slot mode or attribute mode
    const hasSlots = this.querySelector('[slot]');

    return html`
      <div class="spotlight">
        <div class="content">
          <div class="avatar">
            ${this.imageUrl ? html`
              <img src="${this.imageUrl}" alt="${this.name || 'Creator avatar'}" />
            ` : html`
              <div class="avatar-placeholder">
                ${this.renderUserIcon()}
              </div>
            `}
          </div>
          <div class="info">
            ${hasSlots ? this.renderSlotMode() : this.renderAttributeMode()}
          </div>
        </div>
      </div>
    `;
  }

  private renderSlotMode() {
    return html`
      <slot name="header"></slot>
      <slot name="links"></slot>
    `;
  }

  private renderAttributeMode() {
    const linkArray = this.parseLinks();

    return html`
      ${this.name ? html`<h3 class="name">${this.name}</h3>` : ''}
      ${this.bio ? html`<p class="bio">${this.bio}</p>` : ''}
      ${linkArray.length > 0 ? html`
        <div class="links-container">
          ${linkArray.map(link => html`
            <a
              href="${link.href}"
              class="link-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${this.renderLinkIcon(link.icon)}
              ${link.label}
            </a>
          `)}
        </div>
      ` : ''}
    `;
  }

  private parseLinks(): Array<{ href: string; label: string; icon?: string }> {
    if (!this.links) return [];
    try {
      return JSON.parse(this.links);
    } catch (e) {
      console.error('Failed to parse links JSON:', e);
      return [];
    }
  }

  private renderUserIcon() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    `;
  }

  private renderLinkIcon(icon?: string) {
    // Map icon names to SVG icons
    switch (icon) {
      case 'patreon':
        return html`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        `;
      case 'discord':
        return html`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        `;
      case 'guide':
      case 'decklist':
        return html`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        `;
      default:
        return html`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" x2="21" y1="14" y2="3"/>
          </svg>
        `;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fab-creator-spotlight': FabCreatorSpotlight;
  }
}
