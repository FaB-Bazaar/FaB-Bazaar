// Fetch card metadata for a list of cardIds (optimized for batch, with fallback)
export async function fetchCardMetadataMap(cardIds: string[]): Promise<Record<string, any>> {
  const map: Record<string, any> = {};
  if (cardIds.length === 0) return map;
  try {
    // Try to use a batch endpoint if available
    const res = await fetch(`/api/cards?ids=${cardIds.join(",")}`);
    if (res.ok) {
      const data = await res.json();
      // Assume data.cards is an array of card metadata objects with unique_id or _id
      for (const card of data.cards || []) {
        const id = card.unique_id || card._id || card.id;
        if (id) map[id] = card;
      }
      // If all cardIds are present, return early
      if (Object.keys(map).length === cardIds.length) return map;
    }
  } catch (err) {
    // Ignore and fallback to individual fetches
  }
  // Fallback: fetch individually for any missing cardIds
  await Promise.all(cardIds.map(async (cardId) => {
    if (map[cardId]) return;
    try {
      const res = await fetch(`/api/cards/${cardId}`);
      if (res.ok) {
        const data = await res.json();
        map[cardId] = data;
      }
    } catch {}
  }));
  return map;
} 