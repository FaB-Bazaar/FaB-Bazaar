/**
 * Shared chip constants for card filter UIs.
 * Used by both QuickAddCardDialog (hero-constrained) and the global /search page (unconstrained).
 */

export interface ChipDef {
  label: string;
  value: string;
  apiType: string;
  active: string;
  dot: string;
  iconUrl?: string;
  iconPosition?: string;
}

export const TYPE_CHIPS: ChipDef[] = [
  // Row 1
  { label: 'Attack',    value: 'attack',            apiType: 'attack',           active: 'bg-red-900/50 border-red-600',          dot: 'bg-red-500',     iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/pW6r9LMKhrnznfDwMcHMN/public', iconPosition: 'center 24%' },
  { label: 'Action',    value: 'non-attack-action', apiType: 'action',           active: 'bg-emerald-900/50 border-emerald-600',  dot: 'bg-emerald-400', iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/h8tQqgptDmDQwpcKzqbmK/public', iconPosition: 'center 24%' },
  { label: 'Item',      value: 'item',              apiType: 'item',             active: 'bg-purple-900/50 border-purple-600',    dot: 'bg-purple-500',  iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/wdHRncG9CfjtMFCDPwcTk/public', iconPosition: 'center 24%' },
  // Row 2
  { label: 'Atk React', value: 'attack-reaction',   apiType: 'attack reaction',  active: 'bg-orange-900/50 border-orange-600',    dot: 'bg-orange-400',  iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/NrdPMgG8MdN8DrDNw8tJb/public', iconPosition: 'center 24%' },
  { label: 'Def React', value: 'defense-reaction',  apiType: 'defense reaction', active: 'bg-blue-900/50 border-blue-600',         dot: 'bg-blue-500',    iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/WqgkrnT9ctJ68JpPBhrM9/public', iconPosition: 'center 24%' },
  { label: 'Instant',   value: 'instant',           apiType: 'instant',          active: 'bg-cyan-900/50 border-cyan-600',         dot: 'bg-cyan-400',    iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/tFD8WWkJmgkHQtRrKNNkF/public', iconPosition: 'center 24%' },
  // Row 3
  { label: 'Equipment', value: 'equipment',         apiType: 'equipment',        active: 'bg-teal-900/50 border-teal-600',         dot: 'bg-teal-500',    iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/JrkdqCNm8TWbQzWPJjbTD/public', iconPosition: 'center 24%' },
  { label: 'Weapon',    value: 'weapon',            apiType: 'weapon',           active: 'bg-amber-900/50 border-amber-600',       dot: 'bg-amber-500',   iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/TD9rD9RPPzCrkwDLzngHb/public', iconPosition: 'center 24%' },
  { label: 'Block',     value: 'block',             apiType: 'block',            active: 'bg-slate-700 border-slate-500',          dot: 'bg-slate-400',   iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MMrN7PkNmgDDzGbKRdJ8f/public', iconPosition: 'center 24%' },
  // Row 4
  { label: 'Gem',       value: 'gem',               apiType: 'gem',              active: 'bg-pink-900/50 border-pink-600',          dot: 'bg-pink-400',    iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/JmtWDDGWhTCR9B9KKK8kz/public', iconPosition: 'center 24%' },
  { label: 'Ally',      value: 'ally',              apiType: 'ally',             active: 'bg-green-900/50 border-green-600',       dot: 'bg-green-500',   iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/GtjztF7LT8kPDQ8w7GkRw/public', iconPosition: 'center 24%' },
  { label: 'Evo',       value: 'evo',               apiType: 'evo',              active: 'bg-sky-900/50 border-sky-600',            dot: 'bg-sky-400',     iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/KWzQFrpNwFt9WkbRJTjnp/public', iconPosition: 'center 24%' },
];

export const GENERIC_CHIP: ChipDef = {
  label: 'Generic', value: 'generic', apiType: 'generic',
  active: 'bg-gray-700 border-gray-500', dot: 'bg-gray-400',
  iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/8TWrBzGKFPwKkCL9jtpRg/public', iconPosition: 'center 24%',
};

export const CLASS_ICONS: Record<string, { iconUrl: string; iconPosition?: string }> = {
  guardian:      { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/7K9gFgGrJnftB9n89wgJN/public', iconPosition: 'center 24%' },
  ninja:         { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/BTGB69BNhCLmkkzgkGBC6/public', iconPosition: 'center 24%' },
  warrior:       { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/TnWBzzDH9McMtddqbzCK9/public', iconPosition: 'center 24%' },
  brute:         { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/RcT68bt6fmP6HCwrrPPt8/public', iconPosition: 'center 24%' },
  runeblade:     { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/mQBL6JqLdWWWtLcrD8LJ7/public', iconPosition: 'center 24%' },
  mechanologist: { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/NBNg9HgWhmnLJz9zqRLJt/public', iconPosition: 'center 24%' },
  wizard:        { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/tQmMJWfTtcQd6pDDdDPNM/public', iconPosition: 'center 24%' },
  illusionist:   { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/qNQBQNb8DKFb9f76k7GkR/public', iconPosition: 'center 24%' },
  necromancer:   { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/bQFTt8tNcKTfdgCkgRn8n/public', iconPosition: 'center 24%' },
  ranger:        { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/MFjJBrkHcwQWT9FJKKgJm/public', iconPosition: 'center 24%' },
  pirate:        { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/RHGqMtCGmFKMkj6M7JCqd/public', iconPosition: 'center 24%' },
  draconic:      { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/PBWjkGRRd8LtwBftCHcfJ/public', iconPosition: 'center 24%' },
  light:         { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/DzzgKTRKQKffd7DHMWqjB/public', iconPosition: 'center 24%' },
  shadow:        { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/wkPdd78hBknCcmcBJfdhT/public', iconPosition: 'center 24%' },
  earth:         { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/Nmj6pwhDHtgGncCTktrLK/public', iconPosition: 'center 24%' },
  lightning:     { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/gchhRHddRfR7jpdc8T9LB/public', iconPosition: 'center 24%' },
  chaos:         { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/mRCB6tmCdLwgQwthtcq7G/public', iconPosition: 'center 24%' },
  reviled:       { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/LFwThrpfbjP7jPqPQfqQc/public', iconPosition: 'center 24%' },
  revered:       { iconUrl: 'http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/7phpCFbGLBMNw8h88JQr6/public', iconPosition: 'center 24%' },
};

export const ALL_CLASSES = [
  'guardian', 'warrior', 'ninja', 'wizard', 'brute',
  'ranger', 'runeblade', 'necromancer', 'mechanologist',
] as const;

export const PITCH_CHIPS = [
  { label: 'Red',    value: 1, active: 'bg-red-900/50 border-red-500',       dot: 'bg-red-500',    iconUrl: '/fab/symbols/pitch1.png' },
  { label: 'Yellow', value: 2, active: 'bg-yellow-900/50 border-yellow-500', dot: 'bg-yellow-400', iconUrl: '/fab/symbols/pitch2.png' },
  { label: 'Blue',   value: 3, active: 'bg-blue-900/50 border-blue-500',     dot: 'bg-blue-500',   iconUrl: '/fab/symbols/pitch3.png' },
];

export const KEYWORD_CHIPS: { label: string; value: string }[] = [
  { label: 'Go Again',       value: 'go again'       },
  { label: 'Dominate',       value: 'dominate'       },
  { label: 'Arcane Barrier', value: 'arcane barrier' },
  { label: 'Stealth',        value: 'stealth'        },
  { label: 'Phantasm',       value: 'phantasm'       },
  { label: 'Combo',          value: 'combo'          },
  { label: 'Intimidate',     value: 'intimidate'     },
  { label: 'Crush',          value: 'crush'          },
  { label: 'Ward',           value: 'ward'           },
  { label: 'Reprise',        value: 'reprise'        },
  { label: 'Blade Break',    value: 'blade break'    },
  { label: 'Boost',          value: 'boost'          },
  { label: 'Blood Debt',     value: 'blood debt'     },
  { label: 'Battleworn',     value: 'battleworn'     },
];

export const RARITY_OPTIONS = [
  { value: 'v', label: 'Marvel' },
  { value: 'f', label: 'Fabled' },
  { value: 'l', label: 'Legendary' },
  { value: 'm', label: 'Majestic' },
  { value: 'p', label: 'Promo' },
  { value: 's', label: 'Super Rare' },
  { value: 'r', label: 'Rare' },
  { value: 'c', label: 'Common' },
  { value: 't', label: 'Token' },
  { value: 'b', label: 'Basic' },
];

export const FOILING_OPTIONS = [
  { value: 's', label: 'Non-foil',    swatch: 'bg-gray-300 dark:bg-gray-500' },
  { value: 'r', label: 'Rainbow Foil', swatch: 'bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400' },
  { value: 'c', label: 'Cold Foil',   swatch: 'bg-gradient-to-br from-cyan-200 to-cyan-400' },
  { value: 'g', label: 'Gold Foil',   swatch: 'bg-gradient-to-br from-yellow-300 to-yellow-500' },
];

export const EDITION_OPTIONS = [
  { value: 'f', label: '1st Edition' },
  { value: 'a', label: 'Alpha' },
  { value: 'u', label: 'Unlimited' },
  { value: 'n', label: 'Normal' },
];
