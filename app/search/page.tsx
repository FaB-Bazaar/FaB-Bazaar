// app/search/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { filtersToURLParams, urlParamsToFilters, type SearchFilters as URLSearchFilters } from '@/lib/search-url-params';
import {
  Search, Filter, X, ChevronDown, ChevronUp, Eye, Image, Zap,
  DollarSign, Settings, Star, Grid, List, Copy, Crown, Award, Download,
  TrendingUp, AlertCircle, Info, ExternalLink
} from 'lucide-react';
import { getSetName, getRarityInfo, getFoilingInfo, getEditionInfo } from '@/lib/card-metadata';
import { RarityIcon } from '@/components/shared/RarityIcon';
import { getSetImageUrl, getSetImageOrFallback } from '@/lib/set-images';
import { FABShorthandParser } from '@/lib/fab-shorthand-parser';
import { SET_MAP } from '@/lib/fab-constants';
import { CARD_FILTER_SETS } from '@/lib/fab-constants/sets';
import SyntaxGuideModal from '@/components/dialogs/search/query-syntax-guide-modal';


// Types for the test search
interface SearchFilters {
  name?: string;
  text?: string;
  searchableText?: string;
  exact?: boolean;
  types?: string[];
  classes?: string[];
  talents?: string[];
  keywords?: string[];
  color?: string;
  sets?: string[];
  editions?: string[];
  foilings?: string[];
  rarities?: string[];
  priceMin?: number;
  priceMax?: number;
  priceField?: string;
  // Boolean filters
  isAction?: boolean;
  isAttack?: boolean;
  isDefenseReaction?: boolean;
  isInstant?: boolean;
  isEquipment?: boolean;
  isWeapon?: boolean;
  isHero?: boolean;
  isGuardian?: boolean;
  isRuneblade?: boolean;
  isNecromancer?: boolean;
  isBrute?: boolean;
  isWarrior?: boolean;
  isNinja?: boolean;
  isWizard?: boolean;
  isMechanologist?: boolean;
  isRanger?: boolean;
  hasElemental?: boolean;
  hasEarth?: boolean;
  hasIce?: boolean;
  hasLightning?: boolean;
  hasLight?: boolean;
  hasPirate?: boolean;
  hasShadow?: boolean;
  hasRoyal?: boolean;
  hasDraconic?: boolean;
  isGenericOnly?: boolean;
  hasClassAndTalent?: boolean;
  hasClassOnly?: boolean;
  hasTalentOnly?: boolean;
  isRainbowFoil?: boolean;
  isColdFoil?: boolean;
  isNormalFoil?: boolean;
  isExtendedArt?: boolean; 
  isCommon?: boolean;
  isRare?: boolean;
  isMajestic?: boolean;
  isLegendary?: boolean;
  isFabled?: boolean;
  isBudget?: boolean;
  isUnder5?: boolean;
  isUnder10?: boolean;
  isUnder25?: boolean;
  isUnder50?: boolean;
  isUnder100?: boolean;
  isExpensive?: boolean;
  heroLegal?: string;
  format?: string;
  includeBanned?: boolean;
}

interface SearchOptions {
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: string;
  show?: string;
}

interface SearchResults {
  printings: any[];
  total: number;
  page: number;
  pages: number;
  queryInfo: {
    executionTime: string;
    query: any;
    filters: any;
  };
}

// export default function TestSearchPage() {
export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize the shorthand parser
  const parser = new FABShorthandParser();

  // Use the custom hook for all filter state management
  const filters = useSearchFilters();

  // Destructure commonly used values for convenience
  const {
    name, setName,
    text, setText,
    searchableText, setSearchableText,
    exact, setExact,
    selectedSets, setSelectedSets,
    selectedRarities, setSelectedRarities,
    selectedFoilings, setSelectedFoilings,
    selectedEditions, setSelectedEditions,
    selectedColors, setSelectedColors,
    isUpdatingFromParser, setIsUpdatingFromParser,
    showAdvanced, setShowAdvanced,
    types, setTypes,
    classes, setClasses,
    talents, setTalents,
    keywords, setKeywords,
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    priceField, setPriceField,
    format, setFormat,
    heroLegal, setHeroLegal,
    responseMode, setResponseMode,
    isAction, setIsAction,
    isAttack, setIsAttack,
    isEquipment, setIsEquipment,
    isWeapon, setIsWeapon,
    isHero, setIsHero,
    isGuardian, setIsGuardian,
    isWarrior, setIsWarrior,
    isNinja, setIsNinja,
    isWizard, setIsWizard,
    isBrute, setIsBrute,
    isRainbowFoil, setIsRainbowFoil,
    isColdFoil, setIsColdFoil,
    isNormalFoil, setIsNormalFoil,
    isExtendedArt, setIsExtendedArt,
    isCommon, setIsCommon,
    isRare, setIsRare,
    isMajestic, setIsMajestic,
    isLegendary, setIsLegendary,
    isFabled, setIsFabled,
    isBudget, setIsBudget,
    isUnder5, setIsUnder5,
    isUnder10, setIsUnder10,
    isUnder25, setIsUnder25,
    isUnder50, setIsUnder50,
    isUnder100, setIsUnder100,
    isExpensive, setIsExpensive,
    includeBanned, setIncludeBanned,
    limit, setLimit,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    clearAllFilters: clearAllFiltersFromHook,
  } = filters;

  // UI states
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const [selectedPrintings, setSelectedPrintings] = useState<string[]>([]);
  const [binders, setBinders] = useState<any[]>([]);
  const [selectedBinderId, setSelectedBinderId] = useState<string>("");
  const [addingToBinder, setAddingToBinder] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const [syntaxGuideOpen, setSyntaxGuideOpen] = useState(false);
  const [setsExpanded, setSetsExpanded] = useState(false);


  // Enhanced filter definitions (same as original)
  const FILTER_OPTIONS = {
    sets: [
      { value: 'wtr', label: 'Welcome to Rathe', short: 'WTR' },
      { value: 'arc', label: 'Arcane Rising', short: 'ARC' },
      { value: 'cru', label: 'Crucible of War', short: 'CRU' },
      { value: 'mon', label: 'Monarch', short: 'MON' },
      { value: 'ele', label: 'Tales of Aria', short: 'ELE' },
      { value: 'evr', label: 'Everfest', short: 'EVR' },
      { value: 'upr', label: 'Uprising', short: 'UPR' },
      { value: 'dyn', label: 'Dynasty', short: 'DYN' },
      { value: 'out', label: 'Outsiders', short: 'OUT' },
      { value: 'dtd', label: 'Dusk till Dawn', short: 'DTD' },
      { value: 'evo', label: 'Bright Lights', short: 'EVO' },
      { value: 'hvy', label: 'Heavy Hitters', short: 'HVY' },
      { value: 'mst', label: 'Part the Mistveil', short: 'MST' },
      { value: 'ros', label: 'Rosetta', short: 'ROS' },
      { value: 'hnt', label: 'The Hunted', short: 'HNT' },
      { value: 'sea', label: 'High Seas', short: 'SEA' },
      { value: 'fab', label: 'FAB Promos', short: 'FAB' },
      { value: 'lss', label: 'LSS Promos', short: 'LSS' }
    ],
    rarities: [
      { value: 'c', label: 'Common', color: 'bg-gray-100 text-gray-800', icon: 'c' },
      { value: 'r', label: 'Rare', color: 'bg-blue-100 text-blue-800', icon: 'r' },
      { value: 's', label: 'Super Rare', color: 'bg-purple-100 text-purple-800', icon: 's' },
      { value: 'm', label: 'Majestic', color: 'bg-pink-100 text-pink-800', icon: 'm' },
      { value: 'l', label: 'Legendary', color: 'bg-orange-100 text-orange-800', icon: 'l' },
      { value: 'f', label: 'Fabled', color: 'bg-red-100 text-red-800', icon: 'f' },
      { value: 'p', label: 'Promo', color: 'bg-yellow-100 text-yellow-800', icon: 'p' }
    ],
    foilings: [
      { value: 's', label: 'Non-foil', color: 'bg-gray-100 text-gray-800' },
      { value: 'r', label: 'Rainbow Foil', color: 'bg-purple-100 text-purple-800' },
      { value: 'c', label: 'Cold Foil', color: 'bg-cyan-100 text-cyan-800' },
      { value: 'g', label: 'Gold Foil', color: 'bg-yellow-100 text-yellow-800' }
    ],
    editions: [
      { value: 'f', label: '1st Edition', color: 'bg-yellow-100 text-yellow-800' },
      { value: 'a', label: 'Alpha', color: 'bg-red-100 text-red-800' },
      { value: 'u', label: 'Unlimited', color: 'bg-blue-100 text-blue-800' },
      { value: 'n', label: 'Normal', color: 'bg-gray-100 text-gray-800' }
    ],
    colors: [
      { value: 'red', label: 'Red', color: 'bg-red-100 text-red-800' },
      { value: 'yellow', label: 'Yellow', color: 'bg-yellow-100 text-yellow-800' },
      { value: 'blue', label: 'Blue', color: 'bg-blue-100 text-blue-800' }
    ]
  };

  // Response mode options
  const RESPONSE_MODES = [
    { value: 'summary', label: 'Summary', icon: Eye, description: 'Essential info + key stats (token-optimized)' },
    { value: 'gameplay', label: 'Gameplay', icon: Zap, description: 'Deck building & mechanics' },
    { value: 'identifiers', label: 'Identifiers', icon: Info, description: 'Just IDs and names' },
    { value: 'all', label: 'Complete', icon: Settings, description: 'Full data (largest response)' }
  ];

    // Function to build set queries from UI
    const buildSetQueryFromUI = () => {
        if (selectedSets.length > 0) {
        const result = `set:${selectedSets.join(',')}`;
        return result;
        }
        return '';
    };

  // Function to update search input from UI changes
  // 🔍 REPLACE your updateSearchFromSetUI with this debug version to see what's happening:

const updateSearchFromSetUI = () => {
    
    setIsUpdatingFromParser(true);
    
    let newQuery = name.trim();
    
    // Build the new set filter
    const setQuery = buildSetQueryFromUI();
    
    // Use the same regex pattern as the parser to find existing set: filters
    const setPattern = /\bset:([!a-zA-Z0-9,-]+)/gi;
    
    // Find all existing set: patterns in the query
    const hasSetFilters = setPattern.test(newQuery);
    
    // Reset regex lastIndex (important for global regex)
    setPattern.lastIndex = 0;
    
    if (setQuery) {
      // We have sets to add/update
      if (hasSetFilters) {
        // Replace ALL existing set: filters with our single combined one
        newQuery = newQuery.replace(setPattern, '').replace(/\s+/g, ' ').trim();
        newQuery = [newQuery, setQuery].filter(Boolean).join(' ').trim();
      } else {
        // Add new set: filter to the query
        newQuery = [newQuery, setQuery].filter(Boolean).join(' ').trim();
      }
    } else {
      // No sets selected, remove any existing set: filters
      if (hasSetFilters) {
        newQuery = newQuery.replace(setPattern, '').replace(/\s+/g, ' ').trim();
      } else {
      }
    }
    
    setName(newQuery);
    
    // Reset the flag after a short delay
    setTimeout(() => {
      setIsUpdatingFromParser(false);
    }, 100);
  };

  // 🟢 ADD THE NEW FUNCTION RIGHT HERE:
const updateSearchWithNewSets = (setQuery: string) => {
    
    setIsUpdatingFromParser(true);
    
    let newQuery = name.trim();
    
    // Use the same regex pattern as the parser to find existing set: filters
    const setPattern = /\bset:([!a-zA-Z0-9,-]+)/gi;
    
    // Find all existing set: patterns in the query
    const hasSetFilters = setPattern.test(newQuery);
    
    // Reset regex lastIndex (important for global regex)
    setPattern.lastIndex = 0;
    
    if (setQuery) {
      // We have sets to add/update
      if (hasSetFilters) {
        // Replace ALL existing set: filters with our single combined one
        newQuery = newQuery.replace(setPattern, '').replace(/\s+/g, ' ').trim();
        newQuery = [newQuery, setQuery].filter(Boolean).join(' ').trim();
      } else {
        // Add new set: filter to the query
        newQuery = [newQuery, setQuery].filter(Boolean).join(' ').trim();
      }
    } else {
      // No sets selected, remove any existing set: filters
      if (hasSetFilters) {
        newQuery = newQuery.replace(setPattern, '').replace(/\s+/g, ' ').trim();
      }
    }
    
    setName(newQuery);
    
    // Reset the flag after a short delay
    setTimeout(() => {
      setIsUpdatingFromParser(false);
    }, 100);
  };

  // Enhanced button click handler for sets
  const handleSetClick = (setValue: string) => {
    
    setSelectedSets(prev => {
      const newSets = prev.includes(setValue) 
        ? prev.filter(s => s !== setValue)
        : [...prev, setValue];
      
      
      // 🔧 KEY FIX: Use the new state value directly instead of waiting for React state
      const setQuery = newSets.length > 0 ? `set:${newSets.join(',')}` : '';
      updateSearchWithNewSets(setQuery);
      
      return newSets;
    });
  };
  

  // Enhanced active state checker for sets
  const getSetButtonActiveState = (setValue: string) => {
    // Check if this set is active from either UI selection or shorthand parsing
    const parsed = parser.parseQuery(name);
    const filters = parsed.filters;
    
    const isUISelected = selectedSets.includes(setValue);
    const isParsedActive = filters.sets && filters.sets.includes(setValue);
    
    return isUISelected || isParsedActive;
  };

  // Fetch binders on page load
    useEffect(() => {
    async function fetchBinders() {
      try {
        const res = await fetch('/api/binders/user');
        if (!res.ok) throw new Error('Failed to fetch binders');
        const data = await res.json();
        setBinders(data.binders || []);
        if (data.binders && data.binders.length > 0 && data.binders[0]._id) {
          setSelectedBinderId(data.binders[0]._id);
        }
      } catch (err) {
        setBinders([]);
      }
    }
    fetchBinders();
  }, []);

  useEffect(() => {
    if (name.trim() && !isUpdatingFromParser) {
      const parsed = parser.parseQuery(name);
      const filters = parsed.filters;
      
      
      // 🔧 FIXED: Replace selected sets instead of just adding to them
      if (filters.sets && filters.sets.length > 0) {
        setSelectedSets(filters.sets); // ← Changed from merging to replacing
      } else {
        // 🔧 NEW: Clear selected sets if no sets in the query
        setSelectedSets([]);
      }
    } else if (!name.trim()) {
      // 🔧 NEW: Clear selected sets if search is empty  
      setSelectedSets([]);
    }
  }, [name, isUpdatingFromParser]);

  // Handle select all
  useEffect(() => {
    if (results && results.printings) {
      if (selectAll) {
        setSelectedPrintings(results.printings.map((p: any) => p.printing_id));
      } else {
        setSelectedPrintings([]);
      }
    }
  }, [selectAll, results]);


  // Search function using the new API
  const search = async (filters: SearchFilters, options: SearchOptions) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/printings/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.data);
      setDebugInfo(data.debug);
      
    } catch (err: any) {
      setError(err.message || 'An error occurred during search');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setResults(null);
    setDebugInfo(null);
    setSelectedPrintings([]);
    setSelectAll(false);
  };

  // MultiSelectDropdown component (same as original)
  const MultiSelectDropdown = ({ 
    label, 
    options, 
    selected, 
    onChange, 
    placeholder 
  }: {
    label: string;
    options: any[];
    selected: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (value: string) => {
      const newSelected = selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value];
      onChange(newSelected);
    };

    const displayText = selected.length > 0 
      ? `${selected.length} selected`
      : placeholder;

    return (
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-left flex justify-between items-center hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
        >
          <span className={selected.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
            {displayText}
          </span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {options.map(option => (
              <div 
                key={option.value} 
                className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer text-gray-900 dark:text-gray-100"                onClick={() => handleToggle(option.value)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  readOnly
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                />
                <span className="text-sm flex-1">
                  {option.icon ? (
                    <div className="flex items-center space-x-2">
                      <RarityIcon rarityCode={option.icon} size="sm" />
                      <span>{option.label}</span>
                    </div>
                  ) : option.color ? (
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${option.color}`}>
                      {option.label}
                    </span>
                  ) : (
                    <span>{option.label} {option.short && <span className="text-gray-500">({option.short})</span>}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Boolean checkbox component
  const BooleanCheckbox = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: boolean | undefined; 
    onChange: (value: boolean | undefined) => void;
  }) => (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px]">{label}:</label>
      <div className="flex space-x-3">
        <label className="flex items-center space-x-1">
          <input 
            type="radio" 
            checked={value === undefined} 
            onChange={() => onChange(undefined)}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Any</span>
        </label>
        <label className="flex items-center space-x-1">
          <input 
            type="radio" 
            checked={value === true} 
            onChange={() => onChange(true)}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Yes</span>
        </label>
        <label className="flex items-center space-x-1">
          <input 
            type="radio" 
            checked={value === false} 
            onChange={() => onChange(false)}
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">No</span>
        </label>
      </div>
    </div>
  );

  // Enhanced form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build URL filters object
    const urlFilters: URLSearchFilters = {};

    // Parse shorthand from name field first
    let shorthandFilters: any = {};
    let remainingName = name;
    if (name.trim()) {
      const parsed = parser.parseQuery(name);
      shorthandFilters = parsed.filters;
      remainingName = parsed.remainingText || ''; // Use remaining text after shorthand is removed
    }

    // Merge shorthand with UI filters
    Object.assign(urlFilters, shorthandFilters);

    // Text searches - use remaining text after shorthand parsing
    if (remainingName.trim()) urlFilters.name = remainingName.trim();
    if (text) urlFilters.text = text;
    if (searchableText) urlFilters.searchableText = searchableText;
    if (exact) urlFilters.exact = exact;

    // Quick filters
    if (selectedSets.length > 0) urlFilters.sets = selectedSets;
    if (selectedRarities.length > 0) urlFilters.rarities = selectedRarities;
    if (selectedFoilings.length > 0) urlFilters.foilings = selectedFoilings;
    if (selectedEditions.length > 0) urlFilters.editions = selectedEditions;
    if (selectedColors.length > 0) urlFilters.colors = selectedColors; // Allow multiple colors (OR logic)

    // Advanced filters
    if (types) urlFilters.types = types.split(',').map(s => s.trim()).filter(Boolean);
    if (classes) urlFilters.classes = classes.split(',').map(s => s.trim()).filter(Boolean);
    if (talents) urlFilters.talents = talents.split(',').map(s => s.trim()).filter(Boolean);
    if (keywords) urlFilters.keywords = keywords.split(',').map(s => s.trim()).filter(Boolean);

    // Price filters
    if (priceMin) urlFilters.priceMin = parseFloat(priceMin);
    if (priceMax) urlFilters.priceMax = parseFloat(priceMax);
    if (priceField) urlFilters.priceField = priceField;

    if (format) urlFilters.format = format;
    if (heroLegal) urlFilters.heroLegal = heroLegal;

    // Boolean filters
    if (isAction !== undefined) urlFilters.isAction = isAction;
    if (isAttack !== undefined) urlFilters.isAttack = isAttack;
    if (isEquipment !== undefined) urlFilters.isEquipment = isEquipment;
    if (isWeapon !== undefined) urlFilters.isWeapon = isWeapon;
    if (isHero !== undefined) urlFilters.isHero = isHero;
    if (isGuardian !== undefined) urlFilters.isGuardian = isGuardian;
    if (isWarrior !== undefined) urlFilters.isWarrior = isWarrior;
    if (isNinja !== undefined) urlFilters.isNinja = isNinja;
    if (isWizard !== undefined) urlFilters.isWizard = isWizard;
    if (isBrute !== undefined) urlFilters.isBrute = isBrute;
    if (isRainbowFoil !== undefined) urlFilters.isRainbowFoil = isRainbowFoil;
    if (isColdFoil !== undefined) urlFilters.isColdFoil = isColdFoil;
    if (isNormalFoil !== undefined) urlFilters.isNormalFoil = isNormalFoil;
    if (isExtendedArt !== undefined) urlFilters.isExtendedArt = isExtendedArt;
    if (isCommon !== undefined) urlFilters.isCommon = isCommon;
    if (isRare !== undefined) urlFilters.isRare = isRare;
    if (isMajestic !== undefined) urlFilters.isMajestic = isMajestic;
    if (isLegendary !== undefined) urlFilters.isLegendary = isLegendary;
    if (isFabled !== undefined) urlFilters.isFabled = isFabled;
    if (isBudget !== undefined) urlFilters.isBudget = isBudget;
    if (isUnder5 !== undefined) urlFilters.isUnder5 = isUnder5;
    if (isUnder10 !== undefined) urlFilters.isUnder10 = isUnder10;
    if (isUnder25 !== undefined) urlFilters.isUnder25 = isUnder25;
    if (isUnder50 !== undefined) urlFilters.isUnder50 = isUnder50;
    if (isUnder100 !== undefined) urlFilters.isUnder100 = isUnder100;
    if (isExpensive !== undefined) urlFilters.isExpensive = isExpensive;
    if (includeBanned) urlFilters.includeBanned = includeBanned;

    // Build options
    const options = {
      limit: parseInt(limit),
      page: 1, // Always start at page 1 for new searches
      sortBy,
      sortOrder,
      show: responseMode,
      viewMode,
    };

    // Convert to URL params and navigate
    const params = filtersToURLParams(urlFilters, options);
    router.push(`/search/results?${params.toString()}`);
  };

  // Export selected printing IDs
  const handleExportSelected = () => {
    if (selectedPrintings.length === 0) {
      toast({ title: 'No printings selected', description: 'Please select at least one printing.', variant: 'destructive' });
      return;
    }
    
    const data = selectedPrintings.join('\n');
    navigator.clipboard.writeText(data);
    toast({ title: 'IDs Copied', description: `${selectedPrintings.length} printing IDs copied to clipboard.` });
  };

  // Add to wants list
  const handleAddToWantsList = async () => {
    if (!results || !results.printings) return;
    setAdding(true);
    try {
      const selected = results.printings.filter((p: any) => selectedPrintings.includes(p.printing_id));
      if (!selected.length) {
        toast({ title: 'No printings selected', description: 'Please select at least one printing.', variant: 'destructive' });
        return;
      }
      
      await Promise.all(selected.map(async (printing: any) => {
        const res = await fetch('/api/wants/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            printingId: printing.printing_id, 
            quantity: 1 
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to add to wants list');
        }
      }));
      
      toast({ title: 'Added to Wants List', description: `${selected.length} printings added.` });
      setSelectedPrintings([]);
      setSelectAll(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add to wants list', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

    // Add to binder
  const handleAddToBinder = async () => {
    // Guard clauses to ensure a binder and at least one card are selected
    if (!selectedBinderId) {
      toast({ title: 'No binder selected', description: 'Please select a binder.', variant: 'destructive' });
      return;
    }
    if (selectedPrintings.length === 0) {
      toast({ title: 'No printings selected', description: 'Please select at least one printing.', variant: 'destructive' });
      return;
    }

    setAddingToBinder(true);

    try {
      // Construct the dynamic API URL (e.g., /api/binders/some-id/cards)
      const apiUrl = `/api/binders/${selectedBinderId}/cards`;

      // --- THIS IS THE KEY PART ---
      // It creates the exact JSON structure you provided.
      const payload = {
        printings: selectedPrintings.map(printingId => ({
          printingId: printingId,
          quantity: 1, // Quantity is 1 since the UI doesn't specify an amount
          forTrade: true,
          condition: "NM",
          notes: ""
        }))
      };

      // Send a single fetch request with the correctly structured payload
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add cards to binder');
      }
      
      toast({ title: 'Added to Binder', description: `${selectedPrintings.length} printings added successfully.` });
      
      // Reset the state after a successful import
      setSelectedPrintings([]);
      setSelectAll(false);

    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add to binder', variant: 'destructive' });
    } finally {
      setAddingToBinder(false);
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Clear all filters function
  const clearAllFilters = () => {
    // Use the hook's clearAllFilters function and pass clearResults as callback
    clearAllFiltersFromHook(clearResults);
  };

  // Handle individual selection
  const handleSelectPrinting = (printingId: string) => {
    setSelectedPrintings(prev =>
      prev.includes(printingId)
        ? prev.filter(id => id !== printingId)
        : [...prev, printingId]
    );
  };

  // Pagination handlers
  const handlePreviousPage = async () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      await handleSubmit(new Event('submit') as any, true, newPage);
    }
  };
  
  const handleNextPage = async () => {
    if (results && page < results.pages) {
      const newPage = page + 1;
      setPage(newPage);
      await handleSubmit(new Event('submit') as any, true, newPage);
    }
  };



  // Add a hook to resolve display metadata for printings
  function usePrintingMetadata(printings: any[]) {
    const [metaMap, setMetaMap] = React.useState<Record<string, any>>({});

    React.useEffect(() => {
      let cancelled = false;
      async function fetchMeta() {
        const newMap: Record<string, any> = {};
        await Promise.all(printings.map(async (printing) => {
          const setName = await getSetName(printing.set);
          const rarityInfo = await getRarityInfo(printing.rarity);
          const foilingInfo = await getFoilingInfo(printing.foiling);
          const editionInfo = await getEditionInfo(printing.edition);
          newMap[printing.printing_id] = {
            setName,
            rarityInfo,
            foilingInfo,
            editionInfo,
          };
        }));
        if (!cancelled) setMetaMap(newMap);
      }
      if (printings && printings.length > 0) fetchMeta();
      return () => { cancelled = true; };
    }, [printings]);
    return metaMap;
  }

  const metaMap = usePrintingMetadata(results?.printings || []);

  // Visual constants
  const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"

  const DISPLAY_SETS = CARD_FILTER_SETS;

  const RARITY_OPTIONS = [
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
  ]

  const FOILING_OPTIONS = [
    { value: 's', label: 'Non-foil', swatch: 'bg-gray-300 dark:bg-gray-500' },
    { value: 'r', label: 'Rainbow Foil', swatch: 'bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400' },
    { value: 'c', label: 'Cold Foil', swatch: 'bg-gradient-to-br from-cyan-200 to-cyan-400' },
    { value: 'g', label: 'Gold Foil', swatch: 'bg-gradient-to-br from-yellow-300 to-yellow-500' },
  ]

  const pillActive = 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
  const pillInactive = 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 hover:text-gray-900 dark:hover:text-gray-100'

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden" suppressHydrationWarning>

      {/* Full-page set logo watermarks */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        {([
          // top band
          { setKey: 'wtr', top: '2%',   left: '3%',   w: 200, rotate: -14, lightOp: 0.12, darkOp: 0.10 },
          { setKey: 'mon', top: '-3%',  left: '21%',  w: 260, rotate:   7, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'cru', top: '1%',   left: '47%',  w: 168, rotate:  13, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'ros', top: '-4%',  left: '67%',  w: 228, rotate:  -9, lightOp: 0.12, darkOp: 0.09 },
          { setKey: 'mst', top: '4%',   left: '89%',  w: 144, rotate:   4, lightOp: 0.10, darkOp: 0.07 },
          // middle band
          { setKey: 'ele', top: '26%',  left: '0%',   w: 152, rotate:  -6, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'arc', top: '22%',  left: '14%',  w: 180, rotate: -18, lightOp: 0.10, darkOp: 0.07 },
          { setKey: 'hvy', top: '28%',  left: '57%',  w: 168, rotate:  18, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'evr', top: '20%',  left: '76%',  w: 136, rotate:  -4, lightOp: 0.10, darkOp: 0.07 },
          { setKey: 'sea', top: '32%',  left: '92%',  w: 160, rotate:  10, lightOp: 0.10, darkOp: 0.07 },
          // lower-middle band
          { setKey: 'dyn', top: '52%',  left: '6%',   w: 176, rotate: -16, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'dtd', top: '48%',  left: '32%',  w: 136, rotate:  11, lightOp: 0.10, darkOp: 0.07 },
          { setKey: 'upr', top: '50%',  left: '55%',  w: 184, rotate:  -8, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'out', top: '46%',  left: '80%',  w: 144, rotate:  15, lightOp: 0.10, darkOp: 0.07 },
          // bottom band
          { setKey: 'hnt', top: '72%',  left: '1%',   w: 160, rotate: -20, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'evo', top: '70%',  left: '20%',  w: 192, rotate:   9, lightOp: 0.10, darkOp: 0.07 },
          { setKey: '1hp', top: '74%',  left: '45%',  w: 148, rotate: -12, lightOp: 0.10, darkOp: 0.07 },
          { setKey: 'sup', top: '68%',  left: '68%',  w: 172, rotate:   6, lightOp: 0.10, darkOp: 0.08 },
          { setKey: 'mpg', top: '76%',  left: '88%',  w: 140, rotate: -17, lightOp: 0.10, darkOp: 0.07 },
        ] as const).map(({ setKey, top, left, w, rotate, lightOp, darkOp }) => (
          <img
            key={setKey}
            src={getSetImageOrFallback(setKey, setKey.toUpperCase())}
            alt=""
            className="dark:opacity-[var(--dop)] opacity-[var(--lop)]"
            style={{
              position: 'absolute', top, left, width: w, height: w,
              transform: `rotate(${rotate}deg)`, objectFit: 'contain',
              '--lop': lightOp, '--dop': darkOp,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Hero Section */}
      <div className="relative z-10 bg-gray-900/95 overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/40 to-gray-900/70 pointer-events-none" />

        {/* Hero content */}
        <div className="relative max-w-2xl mx-auto px-6 py-14 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Card Search</h1>
          <p className="text-gray-400 text-sm mb-6">
            Advanced search with shorthand syntax.{' '}
            <button onClick={() => setSyntaxGuideOpen(true)}
              className="text-gray-300 hover:text-white underline transition-colors">
              View syntax guide
            </button>
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Card name, collector number, or shorthand..."
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSubmit(e as any)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-base"
              />
            </div>
            <button type="submit" form="search-form" disabled={loading}
              className="bg-white text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors whitespace-nowrap">
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Form */}
      <form id="search-form" onSubmit={handleSubmit} className="relative z-10">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

          {/* Colors */}
          <section>
            <p className={sectionTitle}>Colors</p>
            <div className="flex gap-3">
              {[
                { value: 'red', label: 'Red', color: 'bg-red-500' },
                { value: 'yellow', label: 'Yellow', color: 'bg-yellow-500' },
                { value: 'blue', label: 'Blue', color: 'bg-blue-500' },
              ].map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColors(prev =>
                    prev.includes(color.value)
                      ? prev.filter(c => c !== color.value)
                      : [...prev, color.value]
                  )}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color.color} ${
                    selectedColors.includes(color.value)
                      ? 'border-gray-800 dark:border-gray-200 ring-2 ring-offset-1 ring-gray-800 dark:ring-gray-200'
                      : 'border-white/60 hover:border-gray-500'
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Rarity */}
          <section>
            <p className={sectionTitle}>Rarity</p>
            <div className="flex gap-2 flex-wrap">
              {RARITY_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelectedRarities(prev =>
                    prev.includes(r.value)
                      ? prev.filter(x => x !== r.value)
                      : [...prev, r.value]
                  )}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedRarities.includes(r.value) ? pillActive : pillInactive
                  }`}
                >
                  <RarityIcon rarityCode={r.value} size="sm" />
                  {r.label}
                </button>
              ))}
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Foiling */}
          <section>
            <p className={sectionTitle}>Foiling</p>
            <div className="flex gap-2 flex-wrap">
              {FOILING_OPTIONS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSelectedFoilings(prev =>
                    prev.includes(f.value)
                      ? prev.filter(x => x !== f.value)
                      : [...prev, f.value]
                  )}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedFoilings.includes(f.value) ? pillActive : pillInactive
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-sm ${f.swatch}`} />
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsExtendedArt(isExtendedArt === true ? undefined : true)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                  isExtendedArt === true ? pillActive : pillInactive
                }`}
              >
                Extended Art
              </button>
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Edition */}
          <section>
            <p className={sectionTitle}>Edition</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'f', label: '1st Edition' },
                { value: 'a', label: 'Alpha' },
                { value: 'u', label: 'Unlimited' },
                { value: 'n', label: 'Normal' },
              ].map(edition => (
                <button
                  key={edition.value}
                  type="button"
                  onClick={() => setSelectedEditions(prev =>
                    prev.includes(edition.value)
                      ? prev.filter(e => e !== edition.value)
                      : [...prev, edition.value]
                  )}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedEditions.includes(edition.value) ? pillActive : pillInactive
                  }`}
                >
                  {edition.label}
                </button>
              ))}
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Sets */}
          <section>
            <p className={sectionTitle}>Set</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {DISPLAY_SETS.map(setCode => {
                const isActive = getSetButtonActiveState(setCode)
                return (
                  <button
                    type="button"
                    key={setCode}
                    onClick={() => handleSetClick(setCode)}
                    title={SET_MAP[setCode]}
                    className={`flex flex-col items-center p-2 rounded-md border transition-all hover:scale-105 ${
                      isActive
                        ? 'border-gray-900 dark:border-gray-100 ring-1 ring-gray-900 dark:ring-gray-100'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={getSetImageOrFallback(setCode, setCode.toUpperCase())}
                      className="w-10 h-10 object-contain"
                      alt={SET_MAP[setCode] || setCode}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <span className="text-[10px] font-medium mt-0.5 text-gray-500 dark:text-gray-400">
                      {setCode.toUpperCase()}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Price */}
          <section>
            <p className={sectionTitle}>Price</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '< $5', value: isUnder5, onChange: setIsUnder5 },
                { label: '< $10', value: isUnder10, onChange: setIsUnder10 },
                { label: '< $25', value: isUnder25, onChange: setIsUnder25 },
                { label: '< $50', value: isUnder50, onChange: setIsUnder50 },
                { label: '< $100', value: isUnder100, onChange: setIsUnder100 },
                { label: '$100+', value: isExpensive, onChange: setIsExpensive },
              ].map((filter, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => filter.onChange(filter.value === true ? undefined : true)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    filter.value === true ? pillActive : pillInactive
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Advanced Filters */}
          <section>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Advanced Filters
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-6">
                {/* Text Search Fields */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Text Search</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Card Text</label>
                      <input
                        type="text"
                        placeholder="Search in card text..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Keywords</label>
                      <input
                        type="text"
                        placeholder="dominate, go again, combo..."
                        value={keywords}
                        onChange={e => setKeywords(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Searchable Text</label>
                      <input
                        type="text"
                        placeholder="Search across all fields..."
                        value={searchableText}
                        onChange={e => setSearchableText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Types & Classes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Types & Classes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Types</label>
                      <input
                        type="text"
                        placeholder="action, attack, equipment..."
                        value={types}
                        onChange={e => setTypes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Classes</label>
                      <input
                        type="text"
                        placeholder="guardian, warrior, ninja..."
                        value={classes}
                        onChange={e => setClasses(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Talents</label>
                      <input
                        type="text"
                        placeholder="elemental, ice, lightning..."
                        value={talents}
                        onChange={e => setTalents(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Boolean Filters */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Boolean Filters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">Card Types</h4>
                      <BooleanCheckbox label="Action" value={isAction} onChange={setIsAction} />
                      <BooleanCheckbox label="Attack" value={isAttack} onChange={setIsAttack} />
                      <BooleanCheckbox label="Equipment" value={isEquipment} onChange={setIsEquipment} />
                      <BooleanCheckbox label="Weapon" value={isWeapon} onChange={setIsWeapon} />
                      <BooleanCheckbox label="Hero" value={isHero} onChange={setIsHero} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">Classes</h4>
                      <BooleanCheckbox label="Guardian" value={isGuardian} onChange={setIsGuardian} />
                      <BooleanCheckbox label="Warrior" value={isWarrior} onChange={setIsWarrior} />
                      <BooleanCheckbox label="Ninja" value={isNinja} onChange={setIsNinja} />
                      <BooleanCheckbox label="Wizard" value={isWizard} onChange={setIsWizard} />
                      <BooleanCheckbox label="Brute" value={isBrute} onChange={setIsBrute} />
                    </div>
                  </div>
                </div>

                {/* Custom Price Range */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Custom Price Range</h3>
                  <div className="flex space-x-4 items-center">
                    <div className="flex space-x-2 items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={priceMin}
                        onChange={e => setPriceMin(e.target.value)}
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">to $</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={priceMax}
                        onChange={e => setPriceMax(e.target.value)}
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700 dark:text-gray-300">Price Field:</label>
                      <select
                        value={priceField}
                        onChange={e => setPriceField(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="tcg_low">TCG Low</option>
                        <option value="tcg_mid">TCG Mid</option>
                        <option value="tcg_high">TCG High</option>
                        <option value="tcg_market">TCG Market</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Other Options */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Other Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
                      <select
                        value={format}
                        onChange={e => setFormat(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Any Format</option>
                        <option value="blitz">Blitz</option>
                        <option value="cc">Classic Constructed</option>
                        <option value="commoner">Commoner</option>
                        <option value="ll">Living Legend</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hero Legal</label>
                      <input
                        type="text"
                        placeholder="Hero name..."
                        value={heroLegal}
                        onChange={e => setHeroLegal(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exact}
                          onChange={e => setExact(e.target.checked)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Exact Name</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={includeBanned}
                          onChange={e => setIncludeBanned(e.target.checked)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include Banned</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Form Actions Footer */}
          <div className="flex flex-wrap justify-between items-center gap-4">
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <X size={14} className="mr-1" />
              Clear All
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400">Mode:</label>
                <select
                  value={responseMode}
                  onChange={e => setResponseMode(e.target.value as any)}
                  className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {RESPONSE_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Sort:</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="set">Set</option>
                  <option value="rarity">Rarity</option>
                  <option value="power">Power</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="asc">↑</option>
                  <option value="desc">↓</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Show:</label>
                <select
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="24">24</option>
                  <option value="48">48</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </form>

      <SyntaxGuideModal isOpen={syntaxGuideOpen} onClose={() => setSyntaxGuideOpen(false)} />
    </div>
  );
}
