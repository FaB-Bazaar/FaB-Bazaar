// lib/services/binderService.ts
export class BinderService {
  // Helper function for logging with timestamps
  private static log(action: string, data: any) {
    console.log(`[BinderService:${action}] ${new Date().toISOString()}`, data);
  }

  // UPDATED: Use new binder endpoint
  static async fetchBinder(binderId: string, router: any) {
    this.log('fetchBinder', { binderId });
    
    let response = await fetch(`/api/binders/${binderId}`);
    
    if (response.status === 404) {
      this.log('fetchBinder:404', { binderId, attempting: 'user fallback' });
      // TODO: Deprecated /api/binder/user endpoint - needs refactoring
      /*
      // Maybe it's a userId, try to get their first binder
      const userResponse = await fetch(`/api/binder/user/${binderId}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.binders?.length > 0) {
          this.log('fetchBinder:redirect', {
            originalId: binderId,
            redirectTo: userData.binders[0]._id
          });
          router.replace(`/binder/${userData.binders[0]._id}`);
          return { shouldRedirect: true };
        }
      }
      */
      throw new Error('Binder not found');
    }

    if (response.status === 403) {
      this.log('fetchBinder:403', { binderId });
      throw new Error('You do not have permission to view this binder. It may be private or you may need to log in.');
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch binder');
    }
    
    const data = await response.json();
    
    if (data.success && data.binder) {
      this.log('fetchBinder:success', {
        binderId,
        cardsCount: data.binder.cards?.length || 0,
        hasStats: !!data.binder.totalQuantity
      });
      return {
        binder: data.binder,
        cards: data.binder.cards || []
      };
    } else {
      throw new Error('Invalid response format');
    }
  }

  // UPDATED: Use new cards endpoint with printings_core data
  static async addCard(binder: any, printing: any, quantity = 1, forTrade?: boolean) {
    const binderId = binder._id || binder.id;

    this.log('addCard:start', {
      binderId,
      printingId: printing?.printing_id,
      printingName: printing?.display_name || printing?.name,
      rarity: printing?.rarity,
      quantity,
      forTrade: forTrade ?? true, // Default to true if not specified
      shouldTriggerStats: ['M', 'L', 'F', 'V'].includes(printing?.rarity?.toUpperCase())
    });

    if (!binderId) {
      throw new Error("Binder ID is required to add cards.");
    }

    const payload = {
      printingId: printing?.printing_id || printing?.unique_id,
      quantity,
      condition: "NM",
      language: "EN",
      forTrade: forTrade ?? true, // Use the parameter or default to true
      // Include ALL fields from printings_core for the new endpoint
      printingDetails: {
        // Core identification
        display_name: printing?.display_name,
        name: printing?.name,
        card_unique_id: printing?.card_unique_id,
        printing_id: printing?.printing_id,
        collector_number: printing?.collector_number,
        
        // Printing info
        set: printing?.set,
        edition: printing?.edition,
        foiling: printing?.foiling,
        rarity: printing?.rarity,
        is_extended_art: printing?.is_extended_art,
        
        // Type and display
        type_text: printing?.type_text,
        type_text_display: printing?.type_text_display,
        
        // Image
        image_url: printing?.image_url,
        
        // Pricing
        tcg_market: printing?.tcg_market,
        tcg_low: printing?.tcg_low,
        tcg_mid: printing?.tcg_mid,
        tcg_high: printing?.tcg_high,
        has_price: printing?.has_price,
        price_updated_at: printing?.price_updated_at,
        
        // TCGPlayer
        tcgplayer_url: printing?.tcgplayer_url,
        
        // Timestamps
        created_at: printing?.created_at,
        updated_at: printing?.updated_at
      }
    };
    
    if (!payload.printingId) {
      throw new Error("A specific printing must be selected to add to the binder.");
    }
    
    this.log('addCard:payload', {
      printingId: payload.printingId,
      quantity: payload.quantity,
      rarity: payload.printingDetails.rarity,
      tcg_market: payload.printingDetails.tcg_market
    });
    
    const response = await fetch(`/api/binders/${binderId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    if (!data.success) {
      this.log('addCard:error', { binderId, error: data.error });
      throw new Error(data.error || 'Failed to add card');
    }
    
    this.log('addCard:success', {
      binderId,
      printingId: payload.printingId,
      action: data.action || 'unknown',
      statsTriggered: data.statsTriggered
    });
    
    return data;
  }

  // UPDATED: Use new cards endpoint for removal
  static async removeCard(binder: any, cardId: string) {
    const binderId = binder._id || binder.id;
    
    this.log('removeCard:start', { binderId, cardId });
    
    if (!binderId) {
      throw new Error("Binder ID is required to remove cards.");
    }

    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    if (!data.success) {
      this.log('removeCard:error', { binderId, cardId, error: data.error });
      throw new Error(data.error || 'Failed to remove card');
    }
    
    this.log('removeCard:success', {
      binderId,
      cardId,
      cardName: data.cardName,
      statsTriggered: data.statsTriggered
    });
    
    return data;
  }

  // UPDATED: Use new cards endpoint for forTrade updates
  static async updateForTrade(binderId: string, forTrade: boolean, cardId?: string) {
    this.log('updateForTrade:start', { binderId, cardId, forTrade, isBulk: !cardId });
    
    if (cardId) {
      // Update individual card
      const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forTrade })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.log('updateForTrade:error', { binderId, cardId, error: errorData.error });
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update for trade status`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update for trade status');
      }

      this.log('updateForTrade:success', {
        binderId,
        cardId,
        forTrade,
        statsTriggered: data.statsTriggered
      });

      return data;
    } else {
      // Bulk update all cards in binder
      const response = await fetch(`/api/binders/${binderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allCardsForTrade: forTrade })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.log('updateForTrade:bulk:error', { binderId, forTrade, error: errorData.error });
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update for trade status`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update for trade status');
      }

      this.log('updateForTrade:bulk:success', {
        binderId,
        forTrade,
        affectedCards: data.modifiedCount || 'unknown'
      });

      return data;
    }
  }

  // UPDATED: Use new cards endpoint  
  static async updateCard(binderId: string, cardId: string, updates: any) {
    this.log('updateCard:start', {
      binderId,
      cardId,
      updates,
      quantityChange: updates.quantity !== undefined,
      tradeStatusChange: updates.forTrade !== undefined
    });
    
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      this.log('updateCard:error', { binderId, cardId, status: response.status });
      throw new Error('Failed to update card');
    }
    
    const data = await response.json();
    if (!data.success) {
      this.log('updateCard:error', { binderId, cardId, error: data.error });
      throw new Error(data.error || 'Failed to update card');
    }

    this.log('updateCard:success', {
      binderId,
      cardId,
      updatedFields: Object.keys(updates),
      statsTriggered: data.statsTriggered
    });

    return data;
  }

  // UPDATED: Use new binder endpoint for settings
  static async updateSettings(userId: string, binderId: string, settings: any) {
    this.log('updateSettings:start', { userId, binderId, settings });

    // Keep legacy isPublic field in sync with visibility.level
    const payload: any = {
      name: settings.name,
      description: settings.description,
      visibility: settings.visibility,
      tags: settings.tags,
      thumbnailPrintingId: settings.thumbnailPrintingId
    };

    // Sync isPublic with visibility.level (for backward compatibility)
    if (settings.visibility?.level) {
      payload.isPublic = ['public', 'unlisted'].includes(settings.visibility.level);
    }

    const response = await fetch(`/api/binders/${binderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      this.log('updateSettings:error', { binderId, status: response.status });
      throw new Error('Failed to update binder settings');
    }
    
    const data = await response.json();
    if (!data.success) {
      this.log('updateSettings:error', { binderId, error: data.error });
      throw new Error(data.error || 'Failed to update binder settings');
    }

    this.log('updateSettings:success', { binderId, updatedFields: Object.keys(settings) });
    return data;
  }

  // UPDATED: Use new cards endpoint for quantity changes
  static async changeQuantity(binder: any, printingId: string, delta: number) {
    const binderId = binder._id || binder.id;
    
    this.log('changeQuantity:start', {
      binderId,
      printingId,
      delta,
      operation: delta > 0 ? 'increase' : 'decrease'
    });
    
    if (!binderId) {
      throw new Error("Binder ID is required to change card quantity.");
    }

    if (delta > 0) {
      this.log('changeQuantity:increase', {
        binderId,
        printingId,
        addingQuantity: delta
      });
      
      // Increase quantity by adding more of the same card
      const response = await fetch(`/api/binders/${binderId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printingId: printingId,
          quantity: delta,
          condition: "NM",
          language: "EN", 
          forTrade: true,
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        this.log('changeQuantity:error', { binderId, printingId, error: data.error });
        throw new Error(data.error || 'Failed to increase quantity');
      }
      
      this.log('changeQuantity:success', {
        binderId,
        printingId,
        delta,
        newTotal: data.newQuantity || 'unknown',
        statsTriggered: data.statsTriggered
      });
      
      return data;
    } else {
      this.log('changeQuantity:decrease:error', {
        binderId,
        printingId,
        message: 'Decrease requires individual card update'
      });
      throw new Error('Decreasing quantity requires individual card update - use updateCard method instead');
    }
  }

  // NEW: Swap printing for an existing inventory item
  static async swapPrinting(binderId: string, cardId: string, newPrintingId: string) {
    this.log('swapPrinting:start', { binderId, cardId, newPrintingId });
    
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}/swap-printing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPrintingId })
    });
    
    if (!response.ok) {
      this.log('swapPrinting:error', { binderId, cardId, status: response.status });
      throw new Error('Failed to swap printing');
    }
    
    const data = await response.json();
    if (!data.success) {
      this.log('swapPrinting:error', { binderId, cardId, error: data.error });
      throw new Error(data.error || 'Failed to swap printing');
    }

    this.log('swapPrinting:success', {
      binderId,
      cardId,
      newPrintingId,
      merged: data.merged,
      statsTriggered: data.statsTriggered
    });

    return data;
  }

  // NOTE: Removed getAvailablePrintings - use printingsService or /api/search/core instead
}
