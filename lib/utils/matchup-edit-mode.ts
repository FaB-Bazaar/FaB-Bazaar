export function findExistingMatchupToEdit<T extends { heroId: string }>(
  matchups: T[],
  formHeroId: string,
  editingHeroId: string | null,
): T | null {
  if (!formHeroId) return null;
  if (editingHeroId !== null) return null;
  return matchups.find((m) => m.heroId === formHeroId) ?? null;
}
