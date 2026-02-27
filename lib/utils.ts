import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Fuzzy search function that calculates similarity between strings
export function fuzzySearch(searchTerm: string, text: string): boolean {
  if (!searchTerm) return true;
  if (!text) return false;
  
  const search = searchTerm.toLowerCase();
  const target = text.toLowerCase();
  
  // If exact match, return true immediately
  if (target.includes(search)) return true;
  
  // Simple fuzzy matching: check if characters appear in order
  let searchIndex = 0;
  for (let i = 0; i < target.length && searchIndex < search.length; i++) {
    if (target[i] === search[searchIndex]) {
      searchIndex++;
    }
  }
  
  return searchIndex === search.length;
}

// Debounce function to limit how often a function is called
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Slugifies a string: lowercase, replaces spaces with dashes, removes invalid chars. Only allows a-z, 0-9, dashes, and underscores. Truncates to 20 chars.
export function slugifyBinderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 20);
}

// Generates a unique slug for a binder, given a name and a list of existing slugs. If the base slug is taken, appends -2, -3, etc. until unique.
export function generateUniqueBinderSlug(name: string, existingSlugs: string[]): string {
  const baseSlug = slugifyBinderName(name) || "binder";
  let slug = baseSlug;
  let counter = 2;
  const slugSet = new Set(existingSlugs.map(s => s.toLowerCase()));
  while (slugSet.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
    if (slug.length > 20) slug = slug.slice(0, 20);
  }
  return slug;
}

// lib/utils.ts

/**
 * Gets the best available image URL for a card from various possible data structures.
 * Prioritizes a direct, stored `image_url` first, then falls back to building a CDN link.
 * @param card - The card object from any source (binder, wants list, API, etc.).
 * @returns The best available image URL string, or '/cardback.webp' if none are found.
 */
export function getCardImageUrl(card: any): string {
  // Return fallback immediately if card object is invalid
  if (!card) {
    return "/cardback.webp";
  }

  // --- Priority 1: A direct, fully-qualified URL from a nested object ---
  // Your wants list data proves this is the most reliable source.
  if (card.printingDetails?.image_url && typeof card.printingDetails.image_url === 'string' && card.printingDetails.image_url.startsWith('http')) {
    return card.printingDetails.image_url;
  }

  // --- Priority 2: A direct URL at the top level ---
  if (card.image_url && typeof card.image_url === 'string' && card.image_url.startsWith('http')) {
    return card.image_url;
  }

  // --- Priority 3: A specific printing ID to build our own CDN link ---
  // This is now the fallback if a direct URL isn't available.
  const printingId = 
    card.printingId ||
    card.id ||
    card.printingDetails?.printing_id;

  if (printingId) {
    return `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`;
  }
  
  // --- Final Fallback ---
  return "/cardback.webp";
}

/**
 * Converts a card name to Talishar-compatible identifier format
 *
 * Rules:
 * - Lowercase (already lowercase in DB)
 * - Replace spaces with underscores
 * - Remove apostrophes, quotes
 * - Replace hyphens with underscores
 * - Remove other special characters
 * - Collapse multiple underscores to single
 * - Trim leading/trailing underscores
 *
 * Examples:
 * - "maxx 'the hype' nitro" -> "maxx_the_hype_nitro"
 * - "banksy" -> "banksy"
 * - "cogwerx base legs" -> "cogwerx_base_legs"
 * - "hyper-x3" -> "hyper_x3"
 * - "dorinthea, quicksilver prodigy" -> "dorinthea_quicksilver_prodigy"
 *
 * @param name - The card name from printingDetails.name
 * @returns Talishar-compatible identifier string
 */
export function toTalisharIdentifier(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/['"]/g, '')           // Remove quotes and apostrophes
    .replace(/[,;:]/g, '')          // Remove punctuation
    .replace(/[\s-]+/g, '_')        // Replace spaces and hyphens with underscores
    .replace(/[^a-z0-9_]/g, '')     // Remove non-alphanumeric (except underscores)
    .replace(/_+/g, '_')            // Collapse multiple underscores
    .replace(/^_+|_+$/g, '');       // Trim leading/trailing underscores
}