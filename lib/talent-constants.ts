// lib/talent-constants.ts - Centralized talent management

/**
 * Official FAB Talents List
 * Update this list when new talents are introduced
 */
// NOTE: 'pirate' is a CLASS (see migration 0065), not a talent — filter it via
// classes, not talents. revered/reviled are Mystic talents (Part the Mistveil).
export const OFFICIAL_TALENTS = [
    'mystic',
    'light',
    'draconic',
    'ice',
    'elemental',
    'earth',
    'lightning',
    'chaos',
    'shadow',
    'royal',
    'revered',
    'reviled'
  ] as const;
  
  export type TalentType = typeof OFFICIAL_TALENTS[number];
  
  /**
   * Talent abbreviations and aliases for user-friendly search
   * Add new abbreviations here as needed
   */
  export const TALENT_ABBREVIATIONS: Record<string, TalentType> = {
    // Single letter abbreviations
    'l': 'light',
    'i': 'ice',
    'e': 'earth',
    'd': 'draconic',
    's': 'shadow',
    'c': 'chaos',
    'r': 'royal',
    'm': 'mystic',

    // Two letter abbreviations
    'el': 'elemental',
    'li': 'lightning',
    'dr': 'draconic',
    'sh': 'shadow',
    'ro': 'royal',
    'my': 'mystic',
    'ch': 'chaos',

    // Common aliases
    'elem': 'elemental',
    'electric': 'lightning',
    'bolt': 'lightning',
    'thunder': 'lightning',
    'dragon': 'draconic',
    'draco': 'draconic',
    'drake': 'draconic',
    'dark': 'shadow',
    'darkness': 'shadow',
    'night': 'shadow',
    'king': 'royal',
    'queen': 'royal',
    'noble': 'royal',
    'crown': 'royal',
    'magic': 'mystic',
    'magical': 'mystic',
    // 'arcane' intentionally NOT mapped — it's a Wizard/Runeblade (class) concept
    // / arcane damage, not the Mystic talent.
    'void': 'chaos',
    'random': 'chaos',
    'earth': 'earth',
    'ground': 'earth',
    'stone': 'earth',
    'rock': 'earth',
    'frost': 'ice',
    'cold': 'ice',
    'freeze': 'ice',
    'frozen': 'ice',
    'fire': 'lightning', // Commonly confused
    'flame': 'lightning'  // Commonly confused
  };
  
  /**
   * Talent to boolean field mapping for database queries
   */
  export const TALENT_TO_BOOLEAN_FIELD: Record<TalentType, string> = {
    'light': 'has_light',
    'ice': 'has_ice', 
    'earth': 'has_earth',
    'lightning': 'has_lightning',
    'shadow': 'has_shadow',
    'draconic': 'has_draconic',
    'elemental': 'has_elemental',
    'chaos': 'has_chaos',
    'royal': 'has_royal',
    'mystic': 'has_mystic',
    'revered': 'has_revered',
    'reviled': 'has_reviled'
  };
  
  /**
   * Talent descriptions for help text and UI
   */
  export const TALENT_DESCRIPTIONS: Record<TalentType, string> = {
    'light': 'Light essence - healing and protection effects',
    'ice': 'Ice essence - freezing and control effects', 
    'earth': 'Earth essence - defensive and blocking effects',
    'lightning': 'Lightning essence - aggressive and storm effects',
    'shadow': 'Shadow essence - dark and corrupting effects',
    'draconic': 'Draconic talent - dragon-themed cards and effects',
    'elemental': 'Elemental talent - nature-based magic and effects',
    'chaos': 'Chaos talent - unpredictable and random effects',
    'royal': 'Royal talent - nobility and leadership theme',
    'mystic': 'Mystic talent - arcane knowledge and wisdom',
    'revered': 'Revered talent - introduced with Guardian & Brute heroes',
    'reviled': 'Reviled talent - introduced with Guardian & Brute heroes'
  };
  
  /**
   * Talent combinations that commonly appear together
   */
  export const COMMON_TALENT_COMBINATIONS = [
    ['earth', 'ice'],           // Oldhim combinations
    ['ice', 'lightning'],       // Some elemental combinations
    ['earth', 'lightning'],     // Other elemental combinations
    ['draconic', 'royal'],      // Dragon nobility themes
    ['mystic', 'light'],        // Holy magic themes
    ['chaos', 'shadow'],        // Dark chaos themes
    ['revered', 'reviled']      // Mystic light/shadow (Part the Mistveil)
  ] as const;

  /**
 * Utility functions for talent processing
 */
export class TalentUtils {
    /**
     * Resolve a talent string to its canonical form
     */
    static resolveTalent(input: string): TalentType | null {
      const normalized = input.toLowerCase().trim();
      
      // Check if it's already a valid talent
      if (OFFICIAL_TALENTS.includes(normalized as TalentType)) {
        return normalized as TalentType;
      }
      
      // Check abbreviations
      const mapped = TALENT_ABBREVIATIONS[normalized];
      if (mapped) {
        return mapped;
      }
      
      return null;
    }
    
    /**
     * Get the boolean field name for a talent
     */
    static getTalentBooleanField(talent: TalentType): string {
      return TALENT_TO_BOOLEAN_FIELD[talent];
    }
  
    /**
     * Convert talent name to API filter field name
     */
    static getTalentFilterField(talent: TalentType): string {
        console.log('🔧 getTalentFilterField called with:', talent);
        
        const booleanField = TALENT_TO_BOOLEAN_FIELD[talent];
        console.log('🔧 Boolean field from mapping:', booleanField);
        
        // Fix: Properly convert has_light -> hasLight (with capital L)
        const result = booleanField.replace(/_(.)/g, (_, letter) => letter.toUpperCase());
        console.log('🔧 Final filter field result:', result);
        
        return result;
      }
  
    /**
     * Convert talents array to boolean filter object
     */
    static convertTalentsToFilters(talents: string[], exclude: boolean = false): Record<string, boolean> {
      console.log('🔧 convertTalentsToFilters called with:', { talents, exclude });
      
      const filters: Record<string, boolean> = {};
      
      talents.forEach(talentInput => {
        console.log('🔧 Processing talent input:', talentInput);
        
        const resolvedTalent = this.resolveTalent(talentInput);
        console.log('🔧 Resolved talent:', resolvedTalent);
        
        if (resolvedTalent) {
          const filterField = this.getTalentFilterField(resolvedTalent);
          console.log('🔧 Filter field:', filterField);
          
          filters[filterField] = !exclude;
          console.log('🔧 Added to filters:', { [filterField]: !exclude });
        } else {
          console.warn(`Unknown talent: ${talentInput}`);
        }
      });
      
      console.log('🔧 Final filters object:', filters);
      return filters;
    }
    
    /**
     * Validate multiple talents
     */
    static validateTalents(talents: string[]): { valid: TalentType[]; invalid: string[] } {
      const valid: TalentType[] = [];
      const invalid: string[] = [];
      
      talents.forEach(talent => {
        const resolved = this.resolveTalent(talent);
        if (resolved) {
          valid.push(resolved);
        } else {
          invalid.push(talent);
        }
      });
      
      return { valid, invalid };
    }
    
    /**
     * Get help text for talent usage
     */
    static getHelpText(): string {
      const abbreviations = Object.entries(TALENT_ABBREVIATIONS)
        .slice(0, 11) // Show first 11 abbreviations
        .map(([abbr, talent]) => `${abbr}=${talent}`)
        .join(', ');
      
      return `
  TALENT FILTERS:
    talent:light - Cards with Light talent
    talent:i,e - Cards with Ice or Earth talents
    talent:draconic,royal - Cards with Draconic or Royal talents
    talent:!shadow - Exclude Shadow talent cards
  
  ABBREVIATIONS: ${abbreviations}
  
  VALID TALENTS: ${OFFICIAL_TALENTS.join(', ')}
      `.trim();
    }
  }
  
  
  export const TALENT_LIST = OFFICIAL_TALENTS;
