// Response projection configurations - printing_id is ALWAYS included for MCP compatibility
export const RESPONSE_PROJECTIONS = {
  summary: {
    printing_id: 1,
    name: 1,
    display_name: 1,
    printing_card_id: 1,
    set: 1,
    edition: 1,
    foiling: 1,
    rarity: 1,
    color: 1,
    tcg_low: 1,
    tcg_mid: 1,
    tcg_high: 1,
    tcg_market: 1,
    tcgplayer_url: 1,
    power: 1,
    cost: 1,
    defense: 1,
    image_url: 1,
    type_text_display: 1,
    'printing_data.id': 1
  },

  // browse_bulk: served by GET /api/printings/browse (direct Drizzle query, Redis-cached).
  // This definition is kept as documentation only — the Postgres service does not
  // read RESPONSE_PROJECTIONS; it always returns all columns via buildSelectFields().
  // See lib/client/browse-cache.ts for the authoritative field list.
  browse_bulk: {
    // Identity
    printing_id: 1,
    card_unique_id: 1,

    // Display (from cards table via JOIN)
    display_name: 1,
    type_text_display: 1,
    color: 1,
    image_url: 1,
    printing_card_id: 1,   // maps to printings.collector_number

    // Filtering — game stats (cards table)
    types: 1,
    pitch: 1,
    power: 1,
    cost: 1,
    defense: 1,
    keywords: 1,

    // Filtering — class boolean flags (cards table)
    is_generic: 1,
    is_guardian: 1,
    is_warrior: 1,
    is_ninja: 1,
    is_wizard: 1,
    is_brute: 1,
    is_ranger: 1,
    is_runeblade: 1,
    is_necromancer: 1,
    is_mechanologist: 1,

    // Printing attributes (printings table)
    set: 1,
    edition: 1,
    foiling: 1,
    rarity: 1,

    // Price (printings table)
    tcg_low: 1,
    tcg_market: 1,
    tcgplayer_url: 1,
  },
  gameplay: {
    printing_id: 1,
    name: 1,
    display_name: 1,  
    printing_card_id: 1,
    text: 1,
    type_text: 1,
    color: 1,
    
    // Card classification arrays
    types: 1,
    classes: 1,
    talents: 1,
    traits: 1,
    keywords: 1,
    abilities: 1,
    text_keywords: 1,
    
    // Stats
    power: 1,
    cost: 1,
    defense: 1,
    pitch: 1,
    health: 1,
    intelligence: 1,
    
    // Stat text versions
    power_text: 1,
    cost_text: 1,
    defense_text: 1,
    pitch_text: 1,
    
    // Printing specific information 
    set: 1,
    edition: 1,
    foiling: 1,
    rarity: 1,
    tcg_low: 1,
    tcg_market: 1,
    
    // Format legality
    blitz_legal: 1,
    cc_legal: 1,
    commoner_legal: 1,
    ll_legal: 1,
    blitz_banned: 1,
    cc_banned: 1,
    commoner_banned: 1,
    ll_banned: 1,
    blitz_suspended: 1,
    cc_suspended: 1,
    commoner_suspended: 1,
    ll_restricted: 1,
    
    // Boolean flags for quick filtering
    is_action: 1,
    is_attack: 1,
    is_defense_reaction: 1,
    is_instant: 1,
    is_equipment: 1,
    is_weapon: 1,
    is_hero: 1,
    is_mentor: 1,
    is_token: 1,
    
    // Class boolean flags
    is_generic: 1,
    is_brute: 1,
    is_guardian: 1,
    is_mechanologist: 1,
    is_ranger: 1,
    is_runeblade: 1,
    is_assassin: 1,
    is_warrior: 1,
    is_ninja: 1,
    is_wizard: 1,
    is_merchant: 1,
    is_bard: 1,
    is_adjudicator: 1,
    is_illusionist: 1,
    is_thief: 1,
    is_shapeshifter: 1,
    is_necromancer: 1,
    
    // Talent/essence boolean flags
    has_chaos: 1,
    has_light: 1,
    has_royal: 1,
    has_draconic: 1,
    has_lightning: 1,
    has_shadow: 1,
    has_earth: 1,
    has_mystic: 1,
    has_revered: 1,
    has_ice: 1,
    has_reviled: 1,
    has_pirate: 1,
    has_elemental: 1,
    
    // Combination flags
    is_generic_only: 1,
    has_class_and_talent: 1,
    has_class_only: 1,
    has_talent_only: 1,
    
    image_url: 1,
    played_horizontally: 1,
    expansion_slot: 1
  },
  
  
  identifiers: {
    printing_id: 1,
    name: 1,
    display_name: 1,  
    printing_card_id: 1,
    card_unique_id: 1,
    set: 1,
    edition: 1,
    foiling: 1
  },
  
  mcp_response: {
    printing_id: 1,
    name: 1,
    display_name: 1,
    set: 1,
    edition: 1,
    foiling: 1,
    rarity: 1,
    color: 1,
    tcg_market: 1
  }
} as const;