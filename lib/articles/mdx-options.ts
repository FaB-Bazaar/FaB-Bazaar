import remarkGfm from 'remark-gfm';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';

/**
 * MDX options for article / hero-guide text blocks. GFM turns bare URLs into
 * links (and enables tables / strikethrough) — without it an author's pasted
 * link rendered as plain text.
 */
export const ARTICLE_MDX_OPTIONS: MDXRemoteProps['options'] = {
  mdxOptions: { remarkPlugins: [remarkGfm] },
};
