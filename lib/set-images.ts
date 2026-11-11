// lib/set-images.ts or constants/set-images.ts

const CLOUDFLARE_IMAGE_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

/** Public URL for a set logo stored by id (sets.image_id). */
export const setLogoUrl = (imageId: string): string => `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public`;

// Map set codes to their Cloudflare image IDs
export const SET_IMAGES: Record<string, string> = {
  'wtr': '662cd0af-99ab-4841-bf69-95340c122700', // Welcome to Rathe
  'arc': '1ddbff85-ebe1-48c5-3f4f-a07e76b10d00', // Arcane Rising
  'cru': '73447dd1-5812-4c90-ec79-a33b018c2600', // Crucible of War
  'mon': 'ed110d5d-d334-4d1b-fdd0-90457a7ae200', // Monarch
  'ele': '6c47e6cb-7ce0-4219-9c81-5a80557b7f00', // Tales of Aria
  'evr': '403c910a-bbfc-4670-8ade-e430b7518100', // Everfest
  'upr': 'f5c4b4f6-1cb8-4f78-c5d0-835c80bfa700', // Uprising
  'dyn': '71642461-5479-4dd2-a6e9-de3b41c62900', // Dynasty
  '1hp': '232cc691-4946-4f29-a908-52e327666600', // History Pack 1
  'out': 'e73606b1-8199-4656-dfb7-8653bc4d1900', // Outsiders
  'dtd': 'dea06055-da1c-41a9-75a8-7d8625e81000', // Dusk till Dawn
  'evo': '9ff80bea-f761-4401-5f0e-51292a525600', // Bright Lights
  'hvy': 'ae2ce1ba-6a99-49f8-44b6-8fe78f318d00', // Heavy Hitters
  'mst': '5a675dac-4b79-495e-f1d2-85c897a72700', // Part the Mistveil
  'ros': 'b04d7f29-f907-4b1f-6707-2593dc6f2f00', // Rosetta
  'hnt': '71eef9e0-d486-4e22-2b73-5d71146cd200', // The Hunted
  'sea': 'ecd78249-2a7f-415a-2c6c-89980e745400', // High Seas
  'omn': '3f1d8a2c-0223-47ce-22e3-6db46e976b00', // Omens of the Third Age
  'mpg': '3dd6c60e-cdb6-4bf4-7bc4-989156e13700', // Mastery Pack Guardian
  'mpw': 'set-mpw-logo', // Mastery Pack Warrior
  'sup': 'e252874d-eeb0-41b9-7d17-19c117f17e00', // Super Slam
  'tcc': '9b38dc29-0c62-44b5-f9ee-7f094dfa2000', // Round the Table: TCC X LSS
  'smp': '8e5b5a22-4290-43cf-ab73-22b6ec5f5f00', // Smash Palace
  'gem': '3ef5e82d-b660-47f0-79ae-3f0345545c00', // Gem Pack
  'fab': '733780de-03aa-4a4a-c754-e0d5771cf300', // Promos
  'pen': '1b879518-bef3-4abc-5b89-a4fb27ff7500', // Compendium of Rathe
  'anq': '1b879518-bef3-4abc-5b89-a4fb27ff7500', // Antiquities of Rathe
  'iar': 'set-iar-logo', // Usurp the Shadow Throne
  'ama': 'set-ama-logo', // Armory Deck: Malice
  'amo': 'set-amo-logo', // Armory Deck: Dr. Mortimer
  'mpa': 'set-mpa-logo', // Mastery Pack Assassin
  'tnp': 'set-tnp-logo', // Tournament Pack
  'obk': 'set-obk-logo-20261111002304', // Outbreak
  'aur': 'set-aur-logo', // 1st Strike
  'ast': 'set-aur-logo', // Armory Deck: Aurora (LSS uses the same Aurora wordmark for it)
  'ter': 'set-ter-logo', // First Strike: Terra
  'jdg': 'set-jdg-logo', // Judge Promos (the Judges of Rathe programme mark)
  'ako': 'set-ako-logo', // Armory Deck: Kayo
  'asb': 'set-asb-logo', // Armory Deck: Boltyn
  'aaz': 'set-aaz-logo', // Armory Deck: Azalea
  'aio': 'set-aio-logo', // Armory Deck: Dash
  'ajv': 'set-ajv-logo', // Armory Deck: Jarl Vetreidi
  'amx': 'set-amx-logo', // Armory Deck: Maxx Nitro
  'agb': 'set-agb-logo', // Armory Deck: Gravy Bones
  'asr': 'set-asr-logo', // Armory Deck: Ira
  'avs': 'set-avs-logo', // Armory Deck Legends: Viserai
  'aps': 'set-aps-logo', // Armory Deck: Pleiades
  'arr': 'set-arr-logo', // Armory Deck: Rhinar
  'aac': 'set-aac-logo', // Armory Deck: Arakni
  'aha': 'set-aha-logo', // Armory Deck Origins: Hala
  'azs': 'set-azs-logo', // Armory Deck: Zyggy
  'aol': 'set-aol-logo', // Armory Deck: Olympia
  'amg': 'set-amg-logo', // Armory Deck: Min
  '2hp': 'set-2hp-logo', // History Pack Vol.2
  'rap': 'set-rap-logo', // Archive Pack - Rosetta
  'spw': 'set-spw-logo', // Smash Palace: Chorus of Steel
  'dvr': 'set-dvr-logo', // Classic Battles: Rhinar vs Dorinthea
  'rvd': 'set-dvr-logo', // Classic Battles: Rhinar vs Dorinthea - Rhinar
  // LSS made one "History Pack 1 Blitz Decks" logo for all six decks.
  '1hb': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Bravo
  '1hd': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Dash
  '1ht': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Dorinthea
  '1hk': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Kano
  '1hr': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Rhinar
  '1hv': 'set-1hp-blitz-logo', // Historic Pack 1 Blitz Deck: Viserai
  // The 2019 hero decks never had a logo: these are the product boxes, cut out.
  'bvo': 'set-bvo-logo', // Hero Deck: Bravo
  'tea': 'set-tea-logo', // Hero Deck: Dorinthea
  'ksu': 'set-ksu-logo', // Hero Deck: Katsu
  'rnr': 'set-rnr-logo', // Hero Deck: Rhinar
  // Silver Age decks have no per-hero logo: they all share the format's wordmark.
  'sar': 'set-silver-age-logo', // Silver Age Deck: Arakni
  'saz': 'set-silver-age-logo', // Silver Age Deck: Azalea
  'sbr': 'set-silver-age-logo', // Silver Age Deck: Bravo
  'sda': 'set-silver-age-logo', // Silver Age Deck: Dash
  'sdo': 'set-silver-age-logo', // Silver Age Deck: Dorinthea
  'sen': 'set-silver-age-logo', // Silver Age Deck: Enigma
  'sfa': 'set-silver-age-logo', // Silver Age Deck: Fai
  'siy': 'set-silver-age-logo', // Silver Age Deck: Iyslander
  'ska': 'set-silver-age-logo', // Silver Age Deck: Kayo
  'svi': 'set-silver-age-logo', // Silver Age Deck: Viserai
  'sba': 'set-silver-age-logo', // Silver Age Deck: Briar
  'sbl': 'set-silver-age-logo', // Silver Age Deck: Boltyn
  'sbz': 'set-silver-age-logo', // Silver Age Deck: Blaze
  'sgb': 'set-silver-age-logo', // Silver Age Deck: Gravy Bones
  'sly': 'set-silver-age-logo', // Silver Age Deck: Lyath Goldmane
  'sat': 'set-silver-age-logo', // Silver Age Deck: Prism
  'sbw': 'set-silver-age-logo', // Silver Age Deck: Viserai (2026-09)
};

// GEM seasonal pack art, keyed by TCGplayer group id (`tcg_groups.group_id`,
// canonical from tcgcsv — same ids in every environment). The /sets/GEM hero
// image swaps to the selected season's wrapper art; unmapped groups fall back
// to the set image.
export const GEM_PACK_IMAGES: Record<number, string> = {
  24176: 'gem-pack-1',
  24334: 'gem-pack-2',
  24446: 'gem-pack-3',
  24620: 'gem-pack-4',
  24720: 'gem-pack-5',
};

export const getGemPackImageUrl = (groupId: number): string | null => {
  const imageId = GEM_PACK_IMAGES[groupId];
  return imageId ? `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public` : null;
};

// A logo registered at runtime (sets.image_id, published by the DB set overlay
// — lib/fab-constants/set-overlay.ts) wins over the compiled map. Read straight
// from the shared slot: this module can't import sets.ts (it imports us).
const overlayImageId = (code: string): string | undefined =>
  ((globalThis as Record<string, unknown>).__FAB_SET_OVERLAY__ as { images?: Record<string, string> } | undefined)?.images?.[code];

// Helper function to get set image URL
export const getSetImageUrl = (setCode: string): string => {
  const imageId = overlayImageId(setCode.toLowerCase()) ?? SET_IMAGES[setCode.toLowerCase()];
  if (!imageId) {
    // Fallback to a default image or return null
    return `${CLOUDFLARE_IMAGE_BASE}/default-set-placeholder/public`;
  }
  return `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public`;
};

// Helper function with fallback to text
export const getSetImageOrFallback = (setCode: string, setLabel: string): string => {
  const imageId = overlayImageId(setCode.toLowerCase()) ?? SET_IMAGES[setCode.toLowerCase()];
  return imageId ? `${CLOUDFLARE_IMAGE_BASE}/${imageId}/public` : '';
};