/**
 * The public URL an article is served from.
 *
 * Hero guides render at /heroes/<publicId>; everything else at
 * /articles/<publicId>. Both routes are ISR-cached, so publishing has to bust
 * the RIGHT one — busting the other leaves the live page serving whatever it
 * held while the article was a draft, which is a 404.
 *
 * Keyed on publicId, never slug: the routes resolve by publicId.
 */
export function publicArticlePath(publicId: string, contentType?: string | null): string {
  return `/${contentType === 'hero' ? 'heroes' : 'articles'}/${publicId}`;
}
