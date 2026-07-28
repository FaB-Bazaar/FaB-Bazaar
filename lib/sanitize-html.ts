/**
 * HTML Sanitization utilities for safe rendering of web components
 *
 * Provides comprehensive HTML attribute escaping to prevent XSS attacks
 * when using dangerouslySetInnerHTML for rendering custom web components.
 */

// List of allowed custom web component tags
const ALLOWED_WEB_COMPONENTS = [
  'fab-intro',
  'fab-byline',
  'fab-section-header',
  'fab-key-takeaways',
  'fab-match-report',
  'fab-decklist-block',
  'fab-buylist-block',
  'fab-callout',
  'fab-video',
  'fab-opportunity-card',
  'fab-spotlight-card',
] as const;

type WebComponentTag = typeof ALLOWED_WEB_COMPONENTS[number];

/**
 * Escapes a string for safe use as an HTML attribute value
 * This provides comprehensive escaping to prevent attribute context breakouts
 *
 * Characters escaped:
 * - & → &amp; (must be first to avoid double-encoding)
 * - " → &quot; (prevent breaking out of double-quoted attributes)
 * - ' → &#x27; (prevent breaking out of single-quoted attributes)
 * - < → &lt; (prevent injecting tags)
 * - > → &gt; (prevent injecting tags)
 * - newlines → &#10;/&#13; (prevent attribute context breaks in some parsers)
 */
export function escapeAttr(value: string | undefined | null): string {
  if (value == null) return '';

  return String(value)
    .replace(/&/g, '&amp;')   // Must be first
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

/**
 * Type-safe builder for web component HTML strings
 * Automatically escapes all attribute values
 */
interface WebComponentAttrs {
  [key: string]: string | undefined | null;
}

export function buildWebComponent(
  tagName: WebComponentTag,
  attrs: WebComponentAttrs
): string {
  if (!ALLOWED_WEB_COMPONENTS.includes(tagName)) {
    throw new Error(`Unsupported web component tag: ${tagName}`);
  }

  const attrStrings = Object.entries(attrs)
    .filter(([_, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');

  return `<${tagName} ${attrStrings}></${tagName}>`;
}

/**
 * Creates sanitized inner HTML object for React's dangerouslySetInnerHTML
 *
 * Security: This function only allows specific web component tags
 * and escapes all attribute values to prevent XSS attacks.
 */
export function createSafeInnerHTML(
  tagName: WebComponentTag,
  attrs: WebComponentAttrs
): { __html: string } {
  return { __html: buildWebComponent(tagName, attrs) };
}
