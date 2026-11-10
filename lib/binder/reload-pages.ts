// Reload every page of a paginated list that is already on screen, so a change
// (add / edit / delete) refreshes the data without dropping the pages the
// viewer scrolled through. Pure: the caller supplies the page fetch.

type Pagination = { page: number; totalPages: number };
type PageData<C, P extends Pagination, M> = { cards: C[]; pagination: P; metadata?: M };

const idOf = (card: unknown): string | undefined => {
  const c = card as { id?: string; _id?: string } | null;
  return c?.id || c?._id;
};

export async function reloadLoadedPages<C, P extends Pagination, M>(
  fetchPage: (page: number) => Promise<PageData<C, P, M>>,
  loadedPages: number,
): Promise<PageData<C, P, M>> {
  // Page 1 first: it says how many pages exist now (a delete can remove one).
  const first = await fetchPage(1);
  const last = Math.max(1, Math.min(loadedPages, first.pagination.totalPages));
  const rest = await Promise.all(
    Array.from({ length: last - 1 }, (_, i) => fetchPage(i + 2)),
  );
  const pages = [first, ...rest];

  // A change can shift a card across a page boundary between two requests.
  const seen = new Set<string>();
  const cards: C[] = [];
  for (const p of pages) {
    for (const card of p.cards) {
      const id = idOf(card);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      cards.push(card);
    }
  }

  return { cards, pagination: pages[pages.length - 1].pagination, metadata: first.metadata };
}
