const getNumber = (value: any): number | undefined => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && value !== null && '$numberDouble' in value) {
      const num = parseFloat(value['$numberDouble']);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  };
  
  // This will be the rich data structure for our new public-facing card display.
  export type PublicShowcaseCard = {
    printing_id: string;
    display_name: string;
    image_url: string;
    rarity: string;
    foiling: string;
    set: string;
    edition: string;
    tcg_low?: number;
    tcgplayer_url?: string;
    is_extended_art: boolean;
    color?: string;
  };
  
  // The new transformer function that populates our rich PublicShowcaseCard type.
  export function transformPrintingToPublicCard(printing: IPrinting): PublicShowcaseCard {
    return {
      printing_id: printing.printing_id,
      display_name: printing.display_name,
      image_url: printing.image_url,
      rarity: printing.rarity,
      foiling: printing.foiling,
      set: printing.set,
      edition: printing.edition,
      // Use our helper to safely extract the price
      tcg_low: getNumber(printing.tcg_low),
      tcgplayer_url: printing.tcgplayer_url,
      is_extended_art: printing.is_extended_art || false,
      color: printing.color,
    };
  }