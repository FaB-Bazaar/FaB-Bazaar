/**
 * MongoDB implementation of Printings Service
 *
 * This class wraps the existing FABPrintingsSearchUtility and adapts it
 * to the service layer pattern. All MongoDB-specific code is isolated here.
 */

import connectToDatabase from '@/lib/mongodb';
import { FABPrintingsSearchUtility } from '@/lib/fab-printings-search';
import type {
  IPrintingsService,
  PrintingDTO,
  PrintingsSearchFilters,
  PrintingsSearchOptions,
  PrintingsSearchResult,
  PrintingsFilterValues,
  PriceStatistics,
  EssenceStatistics,
} from '../../contracts/IPrintingsService';
import type { AsyncResult } from '../../contracts/common';

export class MongoPrintingsService implements IPrintingsService {
  private searchUtil: FABPrintingsSearchUtility;

  constructor() {
    this.searchUtil = new FABPrintingsSearchUtility();
  }

  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Convert utility result to service result
   * (Utility already returns the right shape, but we wrap for consistency)
   */
  private wrapResult<T>(data: T): AsyncResult<T> {
    return { success: true, data };
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: unknown, operation: string): AsyncResult<any> {
    console.error(`[MongoPrintingsService] ${operation} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to ${operation}`,
    };
  }

  /**
   * Search printings with filters and options
   */
  async searchPrintings(
    filters: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.searchPrintings(filters, options);
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'search printings');
    }
  }

  /**
   * Get single printing by printing_id
   */
  async getPrintingById(printingId: string): AsyncResult<PrintingDTO | null> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getPrintingById(printingId);
      return this.wrapResult(result as PrintingDTO | null);
    } catch (error) {
      return this.handleError(error, 'get printing by ID');
    }
  }

  /**
   * Get all printings for a specific card
   */
  async getPrintingsForCard(
    cardId: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getPrintingsForCard(cardId, options);
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get printings for card');
    }
  }

  /**
   * Get multiple printings by their printing_id values
   */
  async getPrintingsByIds(
    printingIds: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getPrintingsByIds(
        printingIds,
        options
      );
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get printings by IDs');
    }
  }

  /**
   * Get printings legal for a specific hero
   */
  async getPrintingsForHero(
    heroName: string,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getPrintingsForHero(
        heroName,
        options
      );
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get printings for hero');
    }
  }

  /**
   * Get elemental cards by essence type(s)
   */
  async getElementalCards(
    essenceTypes: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getElementalCards(
        essenceTypes,
        options
      );
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get elemental cards');
    }
  }

  /**
   * Get cards by class and/or talent combination
   */
  async getCardsByClassTalent(
    classes?: string[],
    talents?: string[],
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getCardsByClassTalent(
        classes,
        talents,
        options
      );
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get cards by class/talent');
    }
  }

  /**
   * Get available filter values for faceted search
   */
  async getFilterValues(): AsyncResult<PrintingsFilterValues> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getFilterValues();
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get filter values');
    }
  }

  /**
   * Get essence statistics
   */
  async getEssenceStatistics(): AsyncResult<EssenceStatistics> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getEssenceStatistics();
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get essence statistics');
    }
  }

  /**
   * Get price statistics for filtered cards
   */
  async getPriceStatistics(
    filters?: PrintingsSearchFilters
  ): AsyncResult<PriceStatistics> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getPriceStatistics(filters);
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get price statistics');
    }
  }

  /**
   * Get deck building cards for a hero
   */
  async getDeckBuildingCards(
    heroName: string,
    additionalFilters?: PrintingsSearchFilters,
    options?: PrintingsSearchOptions
  ): AsyncResult<PrintingsSearchResult> {
    try {
      await this.ensureConnection();
      const result = await this.searchUtil.getDeckBuildingCards(
        heroName,
        additionalFilters,
        options
      );
      return this.wrapResult(result);
    } catch (error) {
      return this.handleError(error, 'get deck building cards');
    }
  }
}
