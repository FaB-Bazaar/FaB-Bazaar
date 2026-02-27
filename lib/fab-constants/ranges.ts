// lib/fab-constants/ranges.ts
// Price, power, and cost ranges for filtering

export const PRICE_RANGES = [
  { label: 'Under $1', min: 0, max: 1 },
  { label: '$1 - $5', min: 1, max: 5 },
  { label: '$5 - $10', min: 5, max: 10 },
  { label: '$10 - $25', min: 10, max: 25 },
  { label: '$25 - $50', min: 25, max: 50 },
  { label: '$50 - $100', min: 50, max: 100 },
  { label: '$100+', min: 100, max: null }
] as const;

export const POWER_RANGES = [
  { label: '0-2', values: ['0', '1', '2'] },
  { label: '3-4', values: ['3', '4'] },
  { label: '5-6', values: ['5', '6'] },
  { label: '7-8', values: ['7', '8'] },
  { label: '9+', values: ['9', '10', '11', '12'] }
] as const;

export const COST_RANGES = [
  { label: '0', values: ['0'] },
  { label: '1', values: ['1'] },
  { label: '2', values: ['2'] },
  { label: '3', values: ['3'] },
  { label: '4+', values: ['4', '5', '6', '7', '8'] }
] as const;
