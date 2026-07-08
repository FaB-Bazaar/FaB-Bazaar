// FaB rules-token glyphs in Volzar's markdown answers.
//
// Card rules text quoted by the model carries {p}/{d}/{r}/{h}/{i} token markup
// (power, defense, resource, life, intellect). The card tables already swap
// them for glyph images (renderRulesText); this rehype plugin does the same
// for the model's own markdown — prose, lists, and GFM table cells alike.
// It also converts a literal "<br>" in text to a real <br> element: models
// use it for line breaks inside table cells, and without rehype-raw (which we
// deliberately don't enable) it renders as visible text.

/** {token} → glyph image. Shared with the card tables' rules-text renderer. */
export const RULE_TOKEN_ICON: Record<string, { src: string; alt: string }> = {
  p: { src: '/fab/symbols/power.png', alt: 'power' },
  d: { src: '/fab/symbols/block.png', alt: 'defense' },
  r: { src: '/fab/symbols/resource.png', alt: 'resource' },
  h: { src: '/fab/symbols/health.png', alt: 'life' },
  i: { src: '/fab/symbols/intelligence.png', alt: 'intellect' },
};

const TOKEN_OR_BR = /(\{[pdrhi]\})|(<br\s*\/?>)/gi;

// Elements whose text must stay verbatim (mirrors card-linkify's SKIP_TAGS).
const SKIP_TAGS = new Set(['code', 'pre', 'a']);

/**
 * rehype plugin: walk the tree and replace rules tokens in text nodes with
 * `<ruleicon data-token="p">` elements (react-markdown maps them to glyph
 * imgs) and literal `<br>` text with real `br` elements.
 */
export function rehypeRuleGlyphs() {
  const transform = (node: any): void => {
    if (!node || !Array.isArray(node.children)) return;
    const out: any[] = [];
    for (const child of node.children) {
      // Raw inline HTML survives as `raw` nodes (react-markdown renders them
      // as literal text without rehype-raw) — convert a lone <br> to the real
      // element and leave every other raw node alone.
      if (child?.type === 'raw' && /^<br\s*\/?>$/i.test(child.value?.trim?.() ?? '')) {
        out.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
        continue;
      }
      if (child?.type === 'text' && TOKEN_OR_BR.test(child.value)) {
        TOKEN_OR_BR.lastIndex = 0;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = TOKEN_OR_BR.exec(child.value)) !== null) {
          if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
          if (m[1]) {
            out.push({
              type: 'element',
              tagName: 'ruleicon',
              properties: { dataToken: m[1].slice(1, -1).toLowerCase() },
              children: [],
            });
          } else {
            out.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
          }
          last = m.index + m[0].length;
        }
        if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
        TOKEN_OR_BR.lastIndex = 0;
      } else {
        if (!(child?.type === 'element' && SKIP_TAGS.has(child.tagName))) {
          transform(child);
        }
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: any) => transform(tree);
}
