/**
 * Stable Metafy community and tier IDs for programmatic membership checks.
 * These are Metafy's UUIDs — do not use title strings for checks (they can change).
 */

export const METAFY_COMMUNITY_IDS = {
  FABBAZAAR: 'd357fde3-bc31-45ef-8744-c2ed9e223d08',
  TALISHAR: 'be5e01c0-02d1-4080-b601-c056d69b03f6',
} as const

export const METAFY_TIER_IDS = {
  FABBAZAAR_CORE_CONTRIBUTOR: 'ac86e128-327f-4256-9f9d-7625e82fa2d7',
  FABBAZAAR_FREE: '8b5a24e5-b9a6-4aac-abe6-91ffbac95cc8',
  TALISHAR_SEERS_OF_OPHIDIA: 'dba91896-f49b-4b9a-aca4-b71e7d95bc1b',
  TALISHAR_LIGHT_OF_SOL: '05334ee2-74b0-4cb2-ab1d-c44e3ea2feb8',
  TALISHAR_ARKNIGHT_SHARDS: '2bb0282d-5117-4b6f-9f1c-dc87e05eab2e',
  TALISHAR_CRACKED_BABBLERS: '76ed0d98-02ca-4643-a35b-49b2df2ef5a5',
  TALISHAR_SPONSORS_OF_TROPAL_DHANI: '9ba014fa-c05a-4674-abd6-9631527ce31b',
  TALISHAR_CHAMPION_OF_GRANDEUR: '67d78186-a60e-419f-b47e-aecefee47b55',
  TALISHAR_FYENDAL_SUPPORTERS: 'f4b77a5b-082a-456c-9696-c0c745bda7f4',
} as const

/**
 * Returns true if the user has any membership in Talishar's Community.
 */
export function hasTalisharMembership(
  communities: { communityId: string }[]
): boolean {
  return communities.some(c => c.communityId === METAFY_COMMUNITY_IDS.TALISHAR)
}

/**
 * Returns true if the user has any membership in FabBazaar's Community.
 */
export function hasFabBazaarMembership(
  communities: { communityId: string }[]
): boolean {
  return communities.some(c => c.communityId === METAFY_COMMUNITY_IDS.FABBAZAAR)
}

/**
 * Returns true if the user is a Core Contributor in FabBazaar's Community.
 */
export function isFabBazaarCoreContributor(
  communities: { communityId: string; tiers?: { id: string }[] | null }[]
): boolean {
  const fab = communities.find(c => c.communityId === METAFY_COMMUNITY_IDS.FABBAZAAR)
  return fab?.tiers?.some(t => t.id === METAFY_TIER_IDS.FABBAZAAR_CORE_CONTRIBUTOR) ?? false
}
