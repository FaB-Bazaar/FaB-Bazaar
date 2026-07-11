import type { MetadataRoute } from 'next';

// AI crawlers blocked in production — both model-training scrapers and AI
// answer/retrieval agents (competitors lifting the catalog via AI tools).
// Traditional search engines (Googlebot, Bingbot, Applebot, DuckDuckBot) stay
// welcome through the * rule. robots.txt is honor-system: reputable operators
// respect it; hard enforcement would live at the proxy, not here.
const AI_CRAWLERS = [
  // OpenAI
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  // Anthropic
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'Claude-Web',
  // Google AI (Googlebot for Search is NOT blocked)
  'Google-Extended', 'Google-CloudVertexBot',
  // Apple AI (Applebot for Siri/Spotlight search is NOT blocked)
  'Applebot-Extended',
  // Common Crawl (feeds many training sets)
  'CCBot',
  // Perplexity
  'PerplexityBot', 'Perplexity-User',
  // Meta
  'meta-externalagent', 'FacebookBot',
  // ByteDance
  'Bytespider',
  // Amazon
  'Amazonbot',
  // Cohere
  'cohere-ai', 'cohere-training-data-crawler',
  // Mistral
  'MistralAI-User',
  // Allen Institute for AI
  'AI2Bot',
  // You.com
  'YouBot',
  // DuckDuckGo AI answers (DuckDuckBot search is NOT blocked)
  'DuckAssistBot',
  // Data brokers / dataset builders
  'Diffbot', 'omgili', 'omgilibot', 'TimpiBot', 'img2dataset',
];

export default function robots(): MetadataRoute.Robots {
  // Dev/test serve an allow-all file: local tooling (Playwright, scanners run
  // against the dev server) must never trip over the production policy.
  if (process.env.NODE_ENV !== 'production') {
    return { rules: [{ userAgent: '*', allow: '/' }] };
  }

  return {
    rules: [
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: '/' })),
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/auth/', '/debug/'],
      },
    ],
    sitemap: 'https://fabbazaar.app/sitemap.xml',
  };
}
