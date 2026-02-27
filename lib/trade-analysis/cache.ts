/**
 * Simple in-memory cache for trade analysis results
 * Helps reduce database load for frequently checked user pairs
 */
export class TradeAnalysisCache {
    private cache: Map<string, { data: any; timestamp: number }>;
    private ttl: number; // Time to live in milliseconds
  
    constructor(ttlMinutes: number = 5) {
      this.cache = new Map();
      this.ttl = ttlMinutes * 60 * 1000;
    }
  
    /**
     * Generates a cache key for a user pair
     */
    private getCacheKey(userId1: string, userId2: string, includeCards: boolean, format: string): string {
      // Sort user IDs to ensure consistent key regardless of order
      const [id1, id2] = [userId1, userId2].sort();
      return `${id1}:${id2}:${includeCards}:${format}`;
    }
  
    /**
     * Gets cached result if available and not expired
     */
    get(userId1: string, userId2: string, includeCards: boolean, format: string): any | null {
      const key = this.getCacheKey(userId1, userId2, includeCards, format);
      const cached = this.cache.get(key);
      
      if (!cached) {
        return null;
      }
      
      // Check if cache has expired
      if (Date.now() - cached.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      
      return cached.data;
    }
  
    /**
     * Stores result in cache
     */
    set(userId1: string, userId2: string, includeCards: boolean, format: string, data: any): void {
      const key = this.getCacheKey(userId1, userId2, includeCards, format);
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      
      // Implement simple size limit to prevent memory issues
      if (this.cache.size > 1000) {
        // Remove oldest entries
        const sortedEntries = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest 20% of entries
        const toRemove = Math.floor(sortedEntries.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
          this.cache.delete(sortedEntries[i][0]);
        }
      }
    }
  
    /**
     * Clears the entire cache
     */
    clear(): void {
      this.cache.clear();
    }
  
    /**
     * Invalidates cache entries for a specific user
     * Called when user's binders or wants lists are updated
     */
    invalidateUser(userId: string): void {
      const keysToDelete: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (key.includes(userId)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
    }
  }
  
  // Create singleton instance
  export const tradeAnalysisCache = new TradeAnalysisCache(5); // 5 minute TTL
  