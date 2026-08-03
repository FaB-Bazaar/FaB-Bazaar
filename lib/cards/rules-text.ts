/**
 * Parse rendered FaB rules text (card_translations.text, surfaced as the
 * search API's `text` field) into a structure the UI can map to JSX.
 *
 * Markup handled:
 *   {br} / newline  → paragraph break
 *   {p}{d}{r}…      → glyph token segments (renderer picks the image/fallback)
 *   **bold**        → bold segment (may contain tokens)
 *   _italic_        → italic segment (reminder text)
 */

export type RulesSegment =
  | { type: 'text'; value: string }
  | { type: 'icon'; token: string }
  | { type: 'bold'; children: RulesSegment[] }
  | { type: 'italic'; children: RulesSegment[] };

export type RulesParagraph = RulesSegment[];

const TOKEN = /\{([a-z]+)\}/gi;

/** Split a run of text into plain-text and {token} segments. */
function parseTokens(text: string): RulesSegment[] {
  const out: RulesSegment[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'icon', token: m[1].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

// **bold** or _italic_ spans; non-greedy, single-line.
const EMPHASIS = /\*\*(.+?)\*\*|_(.+?)_/g;

function parseInline(text: string): RulesSegment[] {
  const out: RulesSegment[] = [];
  let last = 0;
  EMPHASIS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMPHASIS.exec(text)) !== null) {
    if (m.index > last) out.push(...parseTokens(text.slice(last, m.index)));
    if (m[1] !== undefined) out.push({ type: 'bold', children: parseTokens(m[1]) });
    else out.push({ type: 'italic', children: parseTokens(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...parseTokens(text.slice(last)));
  return out;
}

/** Parse full rules text into paragraphs of segments. Empty input → []. */
export function parseRulesText(text: string): RulesParagraph[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\{br\}|\n/gi)
    .map((para) => para.trim())
    .filter(Boolean)
    .map(parseInline);
}
