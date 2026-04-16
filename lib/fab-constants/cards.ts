// lib/fab-constants/cards.ts
// Card name abbreviations, types, colors, and equipment subtypes

export const CARD_NAME_ABBREVIATIONS = {
  // Command and Conquer variations
  'cnc': 'Command and Conquer',
  'c&c': 'Command and Conquer',
  'cac': 'Command and Conquer',
  'command': 'Command and Conquer',

  // Art of War variations
  'art': 'Art of War',
  'aow': 'Art of War',

  // Other popular cards
  'es': 'Enlightened Strike',
  'enlightened': 'Enlightened Strike',
  'cod': 'Call of Duty',
  'scar': 'Scar for a Scar',
  'sfas': 'Scar for a Scar',
  'warmongers': "Warmonger's Diplomacy",
  'sink': 'Sink Below',
  'shelter': 'Shelter From the Storm',

  // Community nicknames — common names that bear no resemblance to official card names
  'cheeto': 'Kayo, Underhanded Cheat',
  'cheetos': 'Kayo, Underhanded Cheat',
  'ooh': 'Ooh La La',
  'cata': 'Cataclysm',
} as const;

export const CARD_TYPES = [
  'attack', 'action', 'defense', 'defense reaction', 'weapon',
  'equipment', 'instant', 'aura', 'arrow', 'ally', 'mentor',
  'token', 'hero', 'resource'
] as const;

export const COLORS = [
  'red', 'blue', 'yellow'
] as const;

/**
 * Color display configuration for card colors
 * Includes badge labels, CSS classes, and exact hex values from actual cards
 */
export const COLOR_STYLES = {
  red: {
    label: 'R',
    hex: '#DC2626', // Standard red
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  },
  yellow: {
    label: 'Y',
    hex: '#FCE447', // Exact color from card border
    className: 'bg-[#FCE447] text-black dark:bg-[#FCE447] dark:text-black'
  },
  blue: {
    label: 'U',
    hex: '#3B82F6', // Standard blue
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
  },
  generic: {
    label: 'G',
    hex: '#6B7280', // Gray
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
} as const;

export const EQUIPMENT_SUBTYPES = [
  'head', 'chest', 'arms', 'legs', 'off hand', '1h', '2h',
  'sword', 'axe', 'bow', 'gun', 'orb', 'staff', 'claw',
  'dagger', 'hammer', 'katana', 'scythe'
] as const;

export type CardNameAbbreviation = keyof typeof CARD_NAME_ABBREVIATIONS;
export type CardType = typeof CARD_TYPES[number];
export type Color = typeof COLORS[number];
