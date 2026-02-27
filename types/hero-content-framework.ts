// types/hero-content-framework.ts

// Base section type that all sections extend
export interface BaseSection {
    type: string;
    title: string;
    description?: string;
    order: number; // For controlling section order in output
  }
  
  // Different section types for different hero mechanics
  export interface CardCarouselSection extends BaseSection {
    type: 'card-carousel';
    cards: Array<{
      printingId: string;
      caption?: string;
    }>;
  }
  
  export interface InlineCardSection extends BaseSection {
    type: 'inline-cards';
    content: string; // Markdown text with card references
    cards: Array<{
      printingId: string;
      displayName?: string;
    }>;
  }
  
  export interface VideoSection extends BaseSection {
    type: 'video';
    videoId: string;
    videoTitle: string;
    description: string;
    creatorName: string;
    creatorUrl: string;
  }
  
  export interface TextSection extends BaseSection {
    type: 'text';
    content: string; // Pure markdown content
  }
  
  export interface TabSection extends BaseSection {
    type: 'tabs';
    tabs: Array<{
      label: string;
      content: string;
      cards?: Array<{
        printingId: string;
        caption?: string;
      }>;
    }>;
  }
  
  // Union type of all possible sections
  export type HeroSection = 
    | CardCarouselSection 
    | InlineCardSection 
    | VideoSection 
    | TextSection
    | TabSection;
  
  // Hero content configuration
  export interface HeroContentConfig {
    heroSlug: string;
    heroName: string;
    title: string;
    subtitle: string;
    
    // Introduction is always present
    introduction: {
      text: string;
      beginnerGuideUrl?: string;
    };
    
    // Dynamic sections based on hero needs
    sections: HeroSection[];
    
    // Resources slug for footer
    resourcesSlug: string;
  }
  
  export const SECTION_TEMPLATES = {
    // --- Necromancer (Gravy Bones) ---
    gravy: {
      coreAllies: { type: 'card-carousel', title: 'The Core Engine: Key Summons', order: 1 },
      utilityAllies: { type: 'card-carousel', title: 'Utility and Disruption Allies', order: 2 },
      wideBoard: { type: 'card-carousel', title: 'Wide Board & Supporting Cast', order: 3 }
    },
  
    // --- Mechanologists ---
    dashio: {
      coreEngine: { type: 'card-carousel', title: 'Core Mechanologist Engine', order: 1 },
      boostCards: { type: 'card-carousel', title: 'Boost Cards & Accelerators', order: 2 },
      itemsAndGadgets: { type: 'card-carousel', title: 'Items and Gadgets', order: 3 },
      keyEquipment: { type: 'card-carousel', title: 'Key Equipment', order: 4 }
    },
    dashie: {
      coreBoost: { type: 'card-carousel', title: 'Boost Core', order: 1 },
      items: { type: 'card-carousel', title: 'Item Setup', order: 2 },
      tekloPistol: { type: 'card-carousel', title: 'Teklo Pistol Loops', order: 3 }
    },
    maxx: {
      nitroEngine: { type: 'card-carousel', title: 'Nitro Engine & Setup', order: 1 },
      hyperBoosts: { type: 'card-carousel', title: 'Overcharged Boost Lines', order: 2 },
      hypeFinishers: { type: 'card-carousel', title: 'Maximum Velocity Finishers', order: 3 }
    },
    puffin: {
      pirateBoost: { type: 'card-carousel', title: 'Pirate Mechanologist Engine', order: 1 },
      gadgets: { type: 'card-carousel', title: 'Themed Gadgets', order: 2 },
      mobility: { type: 'card-carousel', title: 'Mobility & Surprise Attacks', order: 3 }
    },
    teklo: {
      tekloCore: { type: 'card-carousel', title: 'Teklovossen Core Engine', order: 1 },
      highTech: { type: 'card-carousel', title: 'High-Tech Items', order: 2 },
      controlShots: { type: 'card-carousel', title: 'Control Pistol Lines', order: 3 }
    },
  
    // --- Illusionists ---
    prism: {
      coreAuras: { type: 'card-carousel', title: 'Essential Auras', order: 1 },
      figments: { type: 'card-carousel', title: 'Figment Package', order: 2 },
      heralds: { type: 'card-carousel', title: 'Herald Support', order: 3 },
      lightCards: { type: 'card-carousel', title: 'Light Attacks & Actions', order: 4 }
    },
    prismaos: {
      coreAuras: { type: 'card-carousel', title: 'Aura Core (Awakener)', order: 1 },
      figments: { type: 'card-carousel', title: 'Awakened Figments', order: 2 },
      heralds: { type: 'card-carousel', title: 'Herald Attacks', order: 3 }
    },
    prismsoal: {
      arcLightAuras: { type: 'card-carousel', title: 'Arc Light Auras', order: 1 },
      figments: { type: 'card-carousel', title: 'Figments & Spirits', order: 2 },
      heraldLines: { type: 'card-carousel', title: 'Herald Combo Lines', order: 3 }
    },
    dromai: {
      dragons: { type: 'card-carousel', title: 'Dragon Summons', order: 1 },
      ashGen: { type: 'card-carousel', title: 'Ash Generation', order: 2 },
      redLine: { type: 'card-carousel', title: 'Aggro Red-Line Package', order: 3 }
    },
    enigma: {
      mysticAuras: { type: 'card-carousel', title: 'Mystic Auras', order: 1 },
      ancestries: { type: 'card-carousel', title: 'Ledger of Ancestry Cards', order: 2 },
      mysticAttacks: { type: 'card-carousel', title: 'Mystic Attack Actions', order: 3 }
    },
  
    // --- Ninjas ---
    katsu: {
      comboStarters: { type: 'card-carousel', title: 'Combo Starters', order: 1 },
      comboExtenders: { type: 'card-carousel', title: 'Combo Extenders', order: 2 },
      comboFinishers: { type: 'card-carousel', title: 'Combo Finishers', order: 3 },
      maskOfMomentum: { type: 'inline-cards', title: 'Mask of Momentum Lines', order: 4 }
    },
    ira: {
      redLine: { type: 'card-carousel', title: 'Efficient Red-Line Attacks', order: 1 },
      kodachis: { type: 'card-carousel', title: 'Ira Kodachi Pressure', order: 2 },
      defensiveTools: { type: 'card-carousel', title: 'Defensive Utility', order: 3 }
    },
    fai: {
      draconicChain: { type: 'card-carousel', title: 'Draconic Chain Links', order: 1 },
      phoenixFlame: { type: 'card-carousel', title: 'Phoenix Flame Synergies', order: 2 },
      wideGoWide: { type: 'card-carousel', title: 'Go-Wide Aggro Lines', order: 3 }
    },
    cindra: {
      royalBlade: { type: 'card-carousel', title: 'Royal Draconic Attacks', order: 1 },
      flameCombos: { type: 'card-carousel', title: 'Retribution Combos', order: 2 },
      finishers: { type: 'card-carousel', title: 'Draconic Finishers', order: 3 }
    },
    zen: {
      mysticStarters: { type: 'card-carousel', title: 'Mystic Starters', order: 1 },
      flowingCombos: { type: 'card-carousel', title: 'Flow & Discipline Lines', order: 2 },
      purposeFinishers: { type: 'card-carousel', title: 'Purposeful Finishers', order: 3 }
    },
  
    // --- Runeblades ---
    briar: {
      earthCards: { type: 'card-carousel', title: 'Earth Package', order: 1 },
      lightningCards: { type: 'card-carousel', title: 'Lightning Package', order: 2 },
      fusionCards: { type: 'card-carousel', title: 'Fusion Attacks', order: 3 },
      embodyCards: { type: 'card-carousel', title: 'Embody Earth/Lightning', order: 4 }
    },
    chane: {
      bloodDebt: { type: 'card-carousel', title: 'Blood Debt Core', order: 1 },
      soulShackles: { type: 'card-carousel', title: 'Soul Shackle Payoffs', order: 2 },
      shadowSynergy: { type: 'card-carousel', title: 'Shadow Runeblade Tools', order: 3 }
    },
    aurora: {
      lightningCore: { type: 'card-carousel', title: 'Lightning Runeblade Core', order: 1 },
      fusionPackage: { type: 'card-carousel', title: 'Fusion Lines', order: 2 },
      mysticSupport: { type: 'card-carousel', title: 'Mystic / Stellar Support', order: 3 }
    },
    florian: {
      earthRunes: { type: 'card-carousel', title: 'Earth Rune Support', order: 1 },
      rotwoodCore: { type: 'card-carousel', title: 'Rotwood Harbinger Lines', order: 2 },
      grindyFinishers: { type: 'card-carousel', title: 'Grindy Finishers', order: 3 }
    },
    viserai: {
      runeGen: { type: 'card-carousel', title: 'Rune Generation Core', order: 1 },
      arcaneDamage: { type: 'card-carousel', title: 'Arcane Damage Lines', order: 2 },
      hybridAttacks: { type: 'card-carousel', title: 'Hybrid Attack Actions', order: 3 }
    },
    vynnset: {
      shadowRunes: { type: 'card-carousel', title: 'Shadow Rune Package', order: 1 },
      ironMaidenCore: { type: 'card-carousel', title: 'Iron Maiden Attacks', order: 2 },
      grindAndBleed: { type: 'card-carousel', title: 'Bleed-Out Control', order: 3 }
    },
  
    // --- Rangers ---
    azalea: {
      dominatedArrows: { type: 'card-carousel', title: 'Dominate Arrows', order: 1 },
      deathDealer: { type: 'card-carousel', title: 'Death Dealer Lines', order: 2 },
      tallPump: { type: 'card-carousel', title: 'Tall Pummel Attacks', order: 3 }
    },
    lexi: {
      lightningPackage: { type: 'card-carousel', title: 'Lightning Aggro', order: 1 },
      icePackage: { type: 'card-carousel', title: 'Ice Control', order: 2 },
      fuseLines: { type: 'card-carousel', title: 'Elemental Fusion Lines', order: 3 }
    },
    marlynn: {
      treasureEngine: { type: 'card-carousel', title: 'Treasure Synergies', order: 1 },
      pirateShots: { type: 'card-carousel', title: 'Pirate Arrow Attacks', order: 2 },
      trickery: { type: 'card-carousel', title: 'Surprise Tech', order: 3 }
    },
    riptide: {
      trapCore: { type: 'card-carousel', title: 'Trap Package', order: 1 },
      wideArrows: { type: 'card-carousel', title: 'Arrow Pressure', order: 2 },
      fatigueLines: { type: 'card-carousel', title: 'Fatigue Grind Lines', order: 3 }
    },
  
    // --- Warriors ---
    dori: {
      dawnblade: { type: 'card-carousel', title: 'Dawnblade Core', order: 1 },
      reprise: { type: 'card-carousel', title: 'Reprise Tricks', order: 2 },
      pumpLines: { type: 'card-carousel', title: 'Weapon Pump Lines', order: 3 }
    },
    boltyn: {
      chargePackage: { type: 'card-carousel', title: 'Charge Core', order: 1 },
      lightAttacks: { type: 'card-carousel', title: 'Light Attack Actions', order: 2 },
      luminaLines: { type: 'card-carousel', title: 'Lumina Ascension Finishers', order: 3 }
    },
    kassai: {
      copperCore: { type: 'card-carousel', title: 'Copper / Gold Engine', order: 1 },
      bloodOnHerHands: { type: 'card-carousel', title: 'Blood on Her Hands Lines', order: 2 },
      coinPayoffs: { type: 'card-carousel', title: 'Coin Payoffs', order: 3 }
    },
    fang: {
      draconicBlade: { type: 'card-carousel', title: 'Draconic Blade Lines', order: 1 },
      royalSynergy: { type: 'card-carousel', title: 'Royal Warrior Package', order: 2 }
    },
    olympia: {
      prizeFighter: { type: 'card-carousel', title: 'Prize Fighter Engine', order: 1 },
      gladiatorTools: { type: 'card-carousel', title: 'Arena Tools', order: 2 }
    },
  
    // --- Guardians ---
    bravo: {
      dominate: { type: 'card-carousel', title: 'Dominate Attacks', order: 1 },
      seismic: { type: 'card-carousel', title: 'Seismic Surge Setups', order: 2 },
      bigAttacks: { type: 'card-carousel', title: 'Showstopper Finishers', order: 3 }
    },
    starvo: {
      elementFusions: { type: 'card-carousel', title: 'Triple Essence Fusions', order: 1 },
      elementalAttacks: { type: 'card-carousel', title: 'Elemental Attack Actions', order: 2 },
      heroFinishers: { type: 'card-carousel', title: 'Starvo Power Finishers', order: 3 }
    },
    jarl: {
      earthIceFusions: { type: 'card-carousel', title: 'Earth/Ice Fusion Attacks', order: 1 },
      defenseTools: { type: 'card-carousel', title: 'Defensive Tools', order: 2 },
      controlFinishers: { type: 'card-carousel', title: 'Control Finishers', order: 3 }
    },
    oldhim: {
      defense: { type: 'card-carousel', title: 'Defense & Crown of Seeds', order: 1 },
      fuseAttacks: { type: 'card-carousel', title: 'Ice/Earth Fusion Attacks', order: 2 },
      fatigueWin: { type: 'card-carousel', title: 'Fatigue Win Lines', order: 3 }
    },
    valda: {
      seismic: { type: 'card-carousel', title: 'Seismic Surge Engine', order: 1 },
      dominate: { type: 'card-carousel', title: 'Dominate Finishers', order: 2 }
    },
    victor: {
      majesticSwings: { type: 'card-carousel', title: 'Majestic Swings', order: 1 },
      highMight: { type: 'card-carousel', title: 'High and Mighty Tools', order: 2 }
    },
    betsy: {
      flexGuardian: { type: 'card-carousel', title: 'Flexible Guardian Lines', order: 1 },
      skinCore: { type: 'card-carousel', title: 'Skin in the Game Package', order: 2 }
    },
  
    // --- Assassins ---
    slippy: {
      chaosDaggers: { type: 'card-carousel', title: 'Chaos Dagger Package', order: 1 },
      stealthAttacks: { type: 'card-carousel', title: 'Stealth Core', order: 2 },
      disruption: { type: 'card-carousel', title: 'Disruption Tools', order: 3 }
    },
    huntsman: {
      contractCore: { type: 'card-carousel', title: 'Contract Attacks', order: 1 },
      banishPayoffs: { type: 'card-carousel', title: 'Banish Payoffs', order: 2 }
    },
    mario: {
      puppetChaos: { type: 'card-carousel', title: 'Marionette Chaos Tools', order: 1 },
      stealthLines: { type: 'card-carousel', title: 'Stealth Lines', order: 2 }
    },
    nuu: {
      mysticAssassins: { type: 'card-carousel', title: 'Mystic Assassin Attacks', order: 1 },
      allurePayoffs: { type: 'card-carousel', title: 'Alluring Finishers', order: 2 }
    },
    uzuri: {
      switchAttacks: { type: 'card-carousel', title: 'Switchblade Attacks', order: 1 },
      stealthCore: { type: 'card-carousel', title: 'Stealth Core Lines', order: 2 }
    },
  
    // --- Wizards ---
    kano: {
      burn: { type: 'card-carousel', title: 'Burn Spells', order: 1 },
      instantSpeed: { type: 'card-carousel', title: 'Instant Speed Tricks', order: 2 },
      comboFinishers: { type: 'card-carousel', title: 'Combo Finishers', order: 3 }
    },
    iyslander: {
      frostbites: { type: 'card-carousel', title: 'Frostbite Core', order: 1 },
      iceFusions: { type: 'card-carousel', title: 'Ice Fusion Attacks', order: 2 },
      controlLines: { type: 'card-carousel', title: 'Control Lines', order: 3 }
    },
    oscilio: {
      lightningFusion: { type: 'card-carousel', title: 'Lightning Fusion Lines', order: 1 },
      constellaCore: { type: 'card-carousel', title: 'Constella Spells', order: 2 }
    },
    verdance: {
      earthRunes: { type: 'card-carousel', title: 'Earth Wizard Spells', order: 1 },
      thornLines: { type: 'card-carousel', title: 'Thorn Control Lines', order: 2 }
    },
  
    // --- Brutes ---
    rhinar: {
      intimidate: { type: 'card-carousel', title: 'Intimidate Attacks', order: 1 },
      bruteSmash: { type: 'card-carousel', title: 'Big Smash Attacks', order: 2 },
      bloodrush: { type: 'card-carousel', title: 'Bloodrush Bellows Finishers', order: 3 }
    },
    levia: {
      bloodDebt: { type: 'card-carousel', title: 'Blood Debt Payoffs', order: 1 },
      shadowAttacks: { type: 'card-carousel', title: 'Shadow Brute Core', order: 2 },
      recursion: { type: 'card-carousel', title: 'Recursion Tools', order: 3 }
    },
    kayo: {
      gambleCore: { type: 'card-carousel', title: 'Dice Roll Attacks', order: 1 },
      bruteLines: { type: 'card-carousel', title: 'Brute Smash Core', order: 2 },
      highVariance: { type: 'card-carousel', title: 'High Variance Finishers', order: 3 }
    },
  
    
    // Generic sections that can be used by any hero
    generic: {
      premiumStaples: {
        type: 'card-carousel',
        title: 'Premium & Collectible Staples',
        order: 10 // Higher order so it appears later
      },
      sideboardTech: {
        type: 'inline-cards',
        title: 'Sideboard & Metagame Tech',
        order: 11
      },
      strategyVideo: {
        type: 'video',
        title: 'Strategy Spotlight',
        order: 12
      }
    }
  };
  
  // Helper to get section templates for a hero
  export function getHeroSectionTemplates(heroSlug: string) {
    const heroTemplates = SECTION_TEMPLATES[heroSlug as keyof typeof SECTION_TEMPLATES] || {};
    return {
      ...heroTemplates,
      ...SECTION_TEMPLATES.generic
    };
  }
  
  // Markdown generator class
  export class HeroMarkdownGenerator {
    private config: HeroContentConfig;
    
    constructor(config: HeroContentConfig) {
      this.config = config;
    }
    
    generate(): string {
      let markdown = this.generateHeader();
      markdown += this.generateIntroduction();
      
      // Sort sections by order
      const sortedSections = [...this.config.sections].sort((a, b) => a.order - b.order);
      
      // Generate each section
      for (const section of sortedSections) {
        markdown += this.generateSection(section);
      }
      
      markdown += this.generateFooter();
      return markdown;
    }
    
    private generateHeader(): string {
      return `---
  title: "${this.config.title}"
  subtitle: "${this.config.subtitle}"
  ---
  
  `;
    }
    
    private generateIntroduction(): string {
      let intro = '';
      
      if (this.config.introduction.beginnerGuideUrl) {
        intro += `<Callout
    title="New to ${this.config.heroName}?"
    text="This guide is for players with a basic understanding of the hero. For a full introduction, check out the official tutorial."
    linkHref="${this.config.introduction.beginnerGuideUrl}"
    linkText="View Beginner's Guide"
  />
  
  `;
      }
      
      intro += `${this.config.introduction.text}
  
  `;
      
      return intro;
    }
    
    private generateSection(section: HeroSection): string {
      switch (section.type) {
        case 'card-carousel':
          return this.generateCardCarousel(section as CardCarouselSection);
        case 'inline-cards':
          return this.generateInlineCards(section as InlineCardSection);
        case 'video':
          return this.generateVideo(section as VideoSection);
        case 'text':
          return this.generateText(section as TextSection);
        case 'tabs':
          return this.generateTabs(section as TabSection);
        default:
          return '';
      }
    }
    
    private generateCardCarousel(section: CardCarouselSection): string {
      if (!section.cards || section.cards.length === 0) return '';
      
      let content = `## ${section.title}
  
  `;
      
      if (section.description) {
        content += `${section.description}
  
  `;
      }
      
      content += `<CardCarousel>
  `;
      
    for (const card of section.cards) {
        content += `  <div className="text-center">
        <HeroCard printingId="${card.printingId}" /> <!-- ${card.caption || 'Card name'} -->
    `;
        if (card.caption) {
        content += `    <p className="mt-2 text-sm italic">${card.caption}</p>
    `;
        }

        content += `  </div>
    `;
    }
      
      content += `</CardCarousel>
  
  `;
      
      return content;
    }
    
    private generateInlineCards(section: InlineCardSection): string {
      let content = `## ${section.title}
  
  `;
      
      if (section.description) {
        content += `${section.description}
  
  `;
      }
      
      // Process the content, replacing card references
      let processedContent = section.content;
      for (const card of section.cards) {
        const placeholder = `{{${card.printingId}}}`;
        const replacement = `<InlineCard printingId="${card.printingId}" /> <!-- ${card.displayName || 'Card name'} -->`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), replacement);
      }
      
      content += `${processedContent}
  
  `;
      
      return content;
    }
    
    private generateVideo(section: VideoSection): string {
      return `## ${section.title}
  
  ${section.description || ''}
  
  <FeaturedVideo
    videoId="${section.videoId}"
    title="${section.videoTitle}"
    description="${section.description}"
    creatorName="${section.creatorName}"
    creatorUrl="${section.creatorUrl}"
  />
  
  `;
    }
    
    private generateText(section: TextSection): string {
      return `## ${section.title}
  
  ${section.content}
  
  `;
    }
    
    private generateTabs(section: TabSection): string {
      let content = `## ${section.title}
  
  `;
      
      if (section.description) {
        content += `${section.description}
  
  `;
      }
      
      content += `<Tabs defaultValue="${section.tabs[0]?.label.toLowerCase().replace(/\s+/g, '-')}">
    <TabsList>
  `;
      
      for (const tab of section.tabs) {
        const tabValue = tab.label.toLowerCase().replace(/\s+/g, '-');
        content += `    <TabsTrigger value="${tabValue}">${tab.label}</TabsTrigger>
  `;
      }
      
      content += `  </TabsList>
  `;
      
      for (const tab of section.tabs) {
        const tabValue = tab.label.toLowerCase().replace(/\s+/g, '-');
        content += `  <TabsContent value="${tabValue}">
      ${tab.content}
  `;
        
        if (tab.cards && tab.cards.length > 0) {
          content += `    <div className="grid grid-cols-3 gap-2 mt-4">
  `;
          for (const card of tab.cards) {
            content += `      <HeroCard printingId="${card.printingId}" />
  `;
          }
          content += `    </div>
  `;
        }
        
        content += `  </TabsContent>
  `;
      }
      
      content += `</Tabs>
  
  `;
      
      return content;
    }
    
    private generateFooter(): string {
      return `## Further Resources
  
  <ResourceLinks slug="${this.config.resourcesSlug}" />
  `;
    }
  }