/**
 * Select which LSS prints a single import pass should process: those in the
 * target language, optionally narrowed to one set.
 *
 * The set filter is what keeps a foreign-exclusive backfill (e.g. `--set=2hp`)
 * from spilling into the OTHER sets a card appears in — many cards carry
 * de/fr/it/es prints across dozens of sets, and without this guard an
 * `--allow-foreign-only --lang=de,fr,it,es` run would touch them all.
 */
export function selectPrintsForImport<
  T extends { print_language: string; print_set: { set_code: string } },
>(prints: T[], lang: string, setFilter: string | null): T[] {
  const set = setFilter ? setFilter.toLowerCase() : null;
  return prints.filter(
    (p) =>
      p.print_language === lang &&
      (!set || p.print_set.set_code.toLowerCase() === set),
  );
}
