// lib/search/index.ts
// Consolidated search utilities for FaB Bazaar

export { FABShorthandParser } from './fab-shorthand-parser';
export {
  filtersToURLParams,
  urlParamsToFilters,
  hasActiveFilters,
  getFilterLabel,
} from './search-url-params';

// Re-export search types from the contract for convenience
export type {
  PrintingsSearchFilters,
  PrintingsSearchOptions,
  PrintingsSearchResult,
  PrintingDTO,
} from '@/lib/services/contracts/IPrintingsService';
