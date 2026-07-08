'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CardPreview } from './quick-actions';
import { rehypeLinkifyCards, type CardNameIndex } from './card-linkify';
import { rehypeRuleGlyphs, RULE_TOKEN_ICON } from './rule-glyphs';

interface MarkdownMessageProps {
  text: string;
  /** name → card index built from this session's search results. */
  index: CardNameIndex;
  /** printingId → preview, for resolving a linkified name back to its rail card. */
  previewsByPid: Map<string, CardPreview>;
  /** Hovering a linked card name previews it in the rail. */
  onHoverCard: (preview: CardPreview) => void;
}

/**
 * Renders Volzar's answer as GitHub-flavored markdown (tables, bold, lists) and
 * turns any known card name into a hover target that previews the card in the
 * rail — the same interaction the structured result rows already offer.
 */
export function MarkdownMessage({ text, index, previewsByPid, onHoverCard }: MarkdownMessageProps) {
  return (
    <div className="volzar-markdown text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[() => rehypeLinkifyCards(index), rehypeRuleGlyphs]}
        components={{
          // FaB rules token ({p}/{d}/{r}/{h}/{i}) → inline glyph image, same
          // treatment the card tables give quoted rules text.
          ruleicon: ({ node }: any) => {
            const icon = RULE_TOKEN_ICON[String(node?.properties?.dataToken ?? '')];
            if (!icon) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon.src} alt={icon.alt} title={icon.alt} className="inline-block h-3 w-3 mx-px align-[-0.125em]" />
            );
          },
          // Card-name hover target injected by rehypeLinkifyCards. `cardref` is
          // a custom tag our rehype plugin emits, hence the Components cast.
          cardref: ({ node, children }: any) => {
            const pid = node?.properties?.dataPid as string | undefined;
            const preview = pid ? previewsByPid.get(pid) : undefined;
            if (!preview) return <>{children}</>;
            return (
              <span
                tabIndex={0}
                onMouseEnter={() => onHoverCard(preview)}
                onFocus={() => onHoverCard(preview)}
                onClick={() => onHoverCard(preview)}
                className="cursor-default underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
              >
                {children}
              </span>
            );
          },
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 dark:text-blue-400 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded bg-muted p-2 my-2 text-xs font-mono">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-1.5 text-muted-foreground">{children}</blockquote>
          ),
        } as Components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
