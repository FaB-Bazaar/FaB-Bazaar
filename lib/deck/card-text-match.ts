// Deck page "Card text" highlight (Cmd+K → X): does a card's rules text contain
// the typed word or phrase? For effects that aren't official keywords —
// discard, Gate to I'arathael, Corrupted Corpse, banish… Plain substring match,
// so "discard" catches both a discard cost and "your opponent discards".

const normalize = (s: string) => s.replace(/\*+/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function cardTextMatches(text: string | null | undefined, query: string): boolean {
  const needle = normalize(query);
  if (!needle || !text) return false;
  return normalize(text).includes(needle);
}
