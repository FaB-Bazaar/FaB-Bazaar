import { useState } from 'react';

/**
 * Custom hook to manage all search filter state
 * Extracted from app/search/page.tsx to reduce complexity and improve maintainability
 */

export interface UseSearchFiltersReturn {
  // Core search states
  name: string;
  setName: (value: string) => void;
  text: string;
  setText: (value: string) => void;
  searchableText: string;
  setSearchableText: (value: string) => void;
  exact: boolean;
  setExact: (value: boolean) => void;

  // Quick filter states (arrays for multi-select)
  selectedSets: string[];
  setSelectedSets: (value: string[]) => void;
  selectedRarities: string[];
  setSelectedRarities: (value: string[]) => void;
  selectedFoilings: string[];
  setSelectedFoilings: (value: string[]) => void;
  selectedEditions: string[];
  setSelectedEditions: (value: string[]) => void;
  selectedColors: string[];
  setSelectedColors: (value: string[]) => void;

  // Parser sync state
  isUpdatingFromParser: boolean;
  setIsUpdatingFromParser: (value: boolean) => void;

  // Advanced filters
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  types: string;
  setTypes: (value: string) => void;
  classes: string;
  setClasses: (value: string) => void;
  talents: string;
  setTalents: (value: string) => void;
  keywords: string;
  setKeywords: (value: string) => void;
  priceMin: string;
  setPriceMin: (value: string) => void;
  priceMax: string;
  setPriceMax: (value: string) => void;
  priceField: string;
  setPriceField: (value: string) => void;
  format: string;
  setFormat: (value: string) => void;
  heroLegal: string;
  setHeroLegal: (value: string) => void;

  // Response mode
  responseMode: 'summary' | 'identifiers' | 'all';
  setResponseMode: (value: 'summary' | 'identifiers' | 'all') => void;

  // Boolean card type filters
  isAction: boolean | undefined;
  setIsAction: (value: boolean | undefined) => void;
  isAttack: boolean | undefined;
  setIsAttack: (value: boolean | undefined) => void;
  isEquipment: boolean | undefined;
  setIsEquipment: (value: boolean | undefined) => void;
  isWeapon: boolean | undefined;
  setIsWeapon: (value: boolean | undefined) => void;
  isHero: boolean | undefined;
  setIsHero: (value: boolean | undefined) => void;

  // Boolean class filters
  isGuardian: boolean | undefined;
  setIsGuardian: (value: boolean | undefined) => void;
  isWarrior: boolean | undefined;
  setIsWarrior: (value: boolean | undefined) => void;
  isNinja: boolean | undefined;
  setIsNinja: (value: boolean | undefined) => void;
  isWizard: boolean | undefined;
  setIsWizard: (value: boolean | undefined) => void;
  isBrute: boolean | undefined;
  setIsBrute: (value: boolean | undefined) => void;

  // Foiling filters
  isRainbowFoil: boolean | undefined;
  setIsRainbowFoil: (value: boolean | undefined) => void;
  isColdFoil: boolean | undefined;
  setIsColdFoil: (value: boolean | undefined) => void;
  isNormalFoil: boolean | undefined;
  setIsNormalFoil: (value: boolean | undefined) => void;
  isExtendedArt: boolean | undefined;
  setIsExtendedArt: (value: boolean | undefined) => void;

  // Rarity filters
  isCommon: boolean | undefined;
  setIsCommon: (value: boolean | undefined) => void;
  isRare: boolean | undefined;
  setIsRare: (value: boolean | undefined) => void;
  isMajestic: boolean | undefined;
  setIsMajestic: (value: boolean | undefined) => void;
  isLegendary: boolean | undefined;
  setIsLegendary: (value: boolean | undefined) => void;
  isFabled: boolean | undefined;
  setIsFabled: (value: boolean | undefined) => void;

  // Price convenience filters
  isBudget: boolean | undefined;
  setIsBudget: (value: boolean | undefined) => void;
  isUnder5: boolean | undefined;
  setIsUnder5: (value: boolean | undefined) => void;
  isUnder10: boolean | undefined;
  setIsUnder10: (value: boolean | undefined) => void;
  isUnder25: boolean | undefined;
  setIsUnder25: (value: boolean | undefined) => void;
  isUnder50: boolean | undefined;
  setIsUnder50: (value: boolean | undefined) => void;
  isUnder100: boolean | undefined;
  setIsUnder100: (value: boolean | undefined) => void;
  isExpensive: boolean | undefined;
  setIsExpensive: (value: boolean | undefined) => void;

  // Other filters
  includeBanned: boolean;
  setIncludeBanned: (value: boolean) => void;

  // Search options
  limit: string;
  setLimit: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  sortOrder: string;
  setSortOrder: (value: string) => void;

  // Utility function
  clearAllFilters: (clearResultsFn?: () => void) => void;
}

export function useSearchFilters(): UseSearchFiltersReturn {
  // Core search states
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [searchableText, setSearchableText] = useState('');
  const [exact, setExact] = useState(false);

  // Quick filter states (using arrays for multi-select)
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedFoilings, setSelectedFoilings] = useState<string[]>([]);
  const [selectedEditions, setSelectedEditions] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const [isUpdatingFromParser, setIsUpdatingFromParser] = useState(false);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [types, setTypes] = useState('');
  const [classes, setClasses] = useState('');
  const [talents, setTalents] = useState('');
  const [keywords, setKeywords] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceField, setPriceField] = useState('tcg_low');
  const [format, setFormat] = useState('');
  const [heroLegal, setHeroLegal] = useState('');

  // Response Mode Selection
  const [responseMode, setResponseMode] = useState<'summary' | 'identifiers' | 'all'>('summary');

  // Boolean card type filters
  const [isAction, setIsAction] = useState<boolean | undefined>(undefined);
  const [isAttack, setIsAttack] = useState<boolean | undefined>(undefined);
  const [isEquipment, setIsEquipment] = useState<boolean | undefined>(undefined);
  const [isWeapon, setIsWeapon] = useState<boolean | undefined>(undefined);
  const [isHero, setIsHero] = useState<boolean | undefined>(undefined);

  // Boolean class filters
  const [isGuardian, setIsGuardian] = useState<boolean | undefined>(undefined);
  const [isWarrior, setIsWarrior] = useState<boolean | undefined>(undefined);
  const [isNinja, setIsNinja] = useState<boolean | undefined>(undefined);
  const [isWizard, setIsWizard] = useState<boolean | undefined>(undefined);
  const [isBrute, setIsBrute] = useState<boolean | undefined>(undefined);

  // Foiling filters
  const [isRainbowFoil, setIsRainbowFoil] = useState<boolean | undefined>(undefined);
  const [isColdFoil, setIsColdFoil] = useState<boolean | undefined>(undefined);
  const [isNormalFoil, setIsNormalFoil] = useState<boolean | undefined>(undefined);
  const [isExtendedArt, setIsExtendedArt] = useState<boolean | undefined>(undefined);

  // Rarity filters
  const [isCommon, setIsCommon] = useState<boolean | undefined>(undefined);
  const [isRare, setIsRare] = useState<boolean | undefined>(undefined);
  const [isMajestic, setIsMajestic] = useState<boolean | undefined>(undefined);
  const [isLegendary, setIsLegendary] = useState<boolean | undefined>(undefined);
  const [isFabled, setIsFabled] = useState<boolean | undefined>(undefined);

  // Price convenience filters
  const [isBudget, setIsBudget] = useState<boolean | undefined>(undefined);
  const [isUnder5, setIsUnder5] = useState<boolean | undefined>(undefined);
  const [isUnder10, setIsUnder10] = useState<boolean | undefined>(undefined);
  const [isUnder25, setIsUnder25] = useState<boolean | undefined>(undefined);
  const [isUnder50, setIsUnder50] = useState<boolean | undefined>(undefined);
  const [isUnder100, setIsUnder100] = useState<boolean | undefined>(undefined);
  const [isExpensive, setIsExpensive] = useState<boolean | undefined>(undefined);

  const [includeBanned, setIncludeBanned] = useState(false);

  // Search options
  const [limit, setLimit] = useState('24');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  /**
   * Reset all filters to their default values
   * @param clearResultsFn - Optional callback to clear search results
   */
  const clearAllFilters = (clearResultsFn?: () => void) => {
    setName('');
    setText('');
    setSearchableText('');
    setExact(false);
    setSelectedSets([]);
    setSelectedRarities([]);
    setSelectedFoilings([]);
    setSelectedEditions([]);
    setSelectedColors([]);
    setTypes('');
    setClasses('');
    setTalents('');
    setKeywords('');
    setPriceMin('');
    setPriceMax('');
    setPriceField('tcg_market');
    setFormat('');
    setHeroLegal('');
    setIsAction(undefined);
    setIsAttack(undefined);
    setIsEquipment(undefined);
    setIsWeapon(undefined);
    setIsHero(undefined);
    setIsGuardian(undefined);
    setIsWarrior(undefined);
    setIsNinja(undefined);
    setIsWizard(undefined);
    setIsBrute(undefined);
    setIsRainbowFoil(undefined);
    setIsExtendedArt(undefined);
    setIsColdFoil(undefined);
    setIsNormalFoil(undefined);
    setIsCommon(undefined);
    setIsRare(undefined);
    setIsMajestic(undefined);
    setIsLegendary(undefined);
    setIsFabled(undefined);
    setIsBudget(undefined);
    setIsUnder5(undefined);
    setIsUnder10(undefined);
    setIsUnder25(undefined);
    setIsUnder50(undefined);
    setIsUnder100(undefined);
    setIsExpensive(undefined);
    setIncludeBanned(false);
    setLimit('24');
    setSortBy('name');
    setSortOrder('asc');
    setResponseMode('summary');
    setIsUpdatingFromParser(false);

    // Call optional clear results callback
    if (clearResultsFn) {
      clearResultsFn();
    }
  };

  return {
    // Core search
    name,
    setName,
    text,
    setText,
    searchableText,
    setSearchableText,
    exact,
    setExact,

    // Quick filters
    selectedSets,
    setSelectedSets,
    selectedRarities,
    setSelectedRarities,
    selectedFoilings,
    setSelectedFoilings,
    selectedEditions,
    setSelectedEditions,
    selectedColors,
    setSelectedColors,

    // Parser sync
    isUpdatingFromParser,
    setIsUpdatingFromParser,

    // Advanced filters
    showAdvanced,
    setShowAdvanced,
    types,
    setTypes,
    classes,
    setClasses,
    talents,
    setTalents,
    keywords,
    setKeywords,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    priceField,
    setPriceField,
    format,
    setFormat,
    heroLegal,
    setHeroLegal,

    // Response mode
    responseMode,
    setResponseMode,

    // Boolean card types
    isAction,
    setIsAction,
    isAttack,
    setIsAttack,
    isEquipment,
    setIsEquipment,
    isWeapon,
    setIsWeapon,
    isHero,
    setIsHero,

    // Boolean classes
    isGuardian,
    setIsGuardian,
    isWarrior,
    setIsWarrior,
    isNinja,
    setIsNinja,
    isWizard,
    setIsWizard,
    isBrute,
    setIsBrute,

    // Foiling
    isRainbowFoil,
    setIsRainbowFoil,
    isColdFoil,
    setIsColdFoil,
    isNormalFoil,
    setIsNormalFoil,
    isExtendedArt,
    setIsExtendedArt,

    // Rarity
    isCommon,
    setIsCommon,
    isRare,
    setIsRare,
    isMajestic,
    setIsMajestic,
    isLegendary,
    setIsLegendary,
    isFabled,
    setIsFabled,

    // Price convenience
    isBudget,
    setIsBudget,
    isUnder5,
    setIsUnder5,
    isUnder10,
    setIsUnder10,
    isUnder25,
    setIsUnder25,
    isUnder50,
    setIsUnder50,
    isUnder100,
    setIsUnder100,
    isExpensive,
    setIsExpensive,

    // Other
    includeBanned,
    setIncludeBanned,

    // Search options
    limit,
    setLimit,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,

    // Utilities
    clearAllFilters,
  };
}
