// lib/services/binderActions.ts
import { BinderService } from './binderService';

export class BinderActions {
  // Helper function for logging with timestamps
  private static log(action: string, data: any) {
    console.log(`[BinderActions:${action}] ${new Date().toISOString()}`, data);
  }

  static async addCardToBinder(
    card: any,
    printing: any,
    binder: any,
    toast: any,
    quantity = 1,
    forTrade?: boolean
  ) {
    const rarity = printing?.rarity?.toUpperCase();
    const isHighValue = ['M', 'L', 'F', 'V'].includes(rarity);

    this.log('addCardToBinder:start', {
      cardName: printing?.display_name || card?.name,
      printingId: printing?.printing_id,
      binderId: binder?._id || binder?.id,
      quantity,
      forTrade,
      rarity,
      isHighValue,
      tcgMarket: printing?.tcg_market,
      expectedStatsUpdate: isHighValue
    });

    try {
      // The service call is what matters. It needs the full printing object.
      const result = await BinderService.addCard(binder, printing, quantity, forTrade);
      
      this.log('addCardToBinder:success', {
        printingId: printing?.printing_id,
        action: result.action,
        statsTriggered: result.statsTriggered,
        newQuantity: result.newQuantity
      });
      
      // The action can show a success message.
      toast({
        title: "Card Added",
        description: `Added ${quantity}x ${printing.display_name || card.name} to your binder.`,
        duration: 3000,
      });

      return result;
    } catch (err: any) {
      this.log('addCardToBinder:error', {
        printingId: printing?.printing_id,
        error: err.message
      });
      
      console.error('Failed to add card:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to add card to binder.",
        variant: "destructive"
      });
      throw err;
    }
  }

  static async bulkToggleForTrade(
    binderId: string,
    forTrade: boolean,
    toast: any
  ) {
    this.log('bulkToggleForTrade:start', { binderId, forTrade });

    try {
      const response = await fetch(`/api/binders/${binderId}/bulk-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forTrade }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to perform bulk update');
      }

      this.log('bulkToggleForTrade:success', {
        binderId,
        forTrade,
        message: data.message,
        affectedCards: data.modifiedCount
      });

      toast({
        title: "Bulk Update Complete",
        description: data.message,
      });

      return data;
    } catch (err: any) {
      this.log('bulkToggleForTrade:error', { binderId, forTrade, error: err.message });
      
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    }
  }

  static async editCard(
    binderId: string,
    editingCard: any,
    updates: any,
    setCards: (updater: (prev: any[]) => any[]) => void,
    toast: any
  ) {
    if (!editingCard) return;
  
    const cardInstanceId = editingCard._id || editingCard.id;
    const rarity = editingCard.rarity?.toUpperCase();
    const isHighValue = ['M', 'L', 'F', 'V'].includes(rarity);
    
    this.log('editCard:start', {
      binderId,
      cardInstanceId,
      cardName: editingCard.display_name || editingCard.name,
      rarity,
      isHighValue,
      updates,
      quantityChange: updates.quantity !== undefined ? {
        from: editingCard.quantity,
        to: updates.quantity,
        delta: (updates.quantity || 0) - (editingCard.quantity || 0)
      } : null,
      tradeStatusChange: updates.forTrade !== undefined ? {
        from: editingCard.forTrade,
        to: updates.forTrade
      } : null,
      expectedStatsUpdate: isHighValue && (updates.quantity !== undefined || updates.forTrade !== undefined)
    });
  
    let originalCards: any[] | null = null;
    setCards(prev => {
      originalCards = [...prev];
      return prev.map(card => 
        (card._id || card.id) === cardInstanceId ? { ...card, ...updates } : card
      );
    });
  
    try {
      const result = await BinderService.updateCard(binderId, cardInstanceId, updates);
      
      this.log('editCard:success', {
        cardInstanceId,
        updatedFields: Object.keys(updates),
        statsTriggered: result.statsTriggered
      });
      
      toast({ title: "Card updated", description: "Card details have been saved." });

      return result;
    } catch (err: any) {
      this.log('editCard:error', {
        cardInstanceId,
        error: err.message,
        restoringOriginalState: true
      });
      
      console.error('Failed to update card:', err);
      if (originalCards) {
        setCards(() => originalCards);
      }
      toast({
        title: "Error",
        description: "Failed to save changes. Your view has been restored.",
        variant: "destructive"
      });
      throw err;
    }
  }

  static async saveBinderSettings(
    userId: string,
    binderId: string,
    settings: any,
    setBinder: (updater: (prev: any) => any) => void,
    toast: any
  ) {
    this.log('saveBinderSettings:start', { userId, binderId, settings });
    
    if (!userId) throw new Error('User not authenticated');
    
    try {
      const result = await BinderService.updateSettings(userId, binderId, settings);
      
      this.log('saveBinderSettings:success', {
        binderId,
        updatedFields: Object.keys(settings)
      });
      
      setBinder(prev => ({ ...prev, ...settings }));
      toast({ title: "Settings saved", description: "Binder settings updated." });
      
      return result;
    } catch (err: any) {
      this.log('saveBinderSettings:error', { binderId, error: err.message });
      
      toast({ title: "Error", description: "Failed to save binder settings.", variant: "destructive" });
      throw err;
    }
  }

  static async removeCard(
    cardId: string,
    binder: any,
    cards: any[],
    setCards: (updater: (prev: any[]) => any[]) => void,
    toast: any
  ) {
    const cardToRemove = cards.find(card => card.id === cardId);
    const rarity = cardToRemove?.rarity?.toUpperCase();
    const isHighValue = ['M', 'L', 'F', 'V'].includes(rarity);
    
    this.log('removeCard:start', {
      cardId,
      binderId: binder._id || binder.id,
      cardName: cardToRemove?.display_name || cardToRemove?.name,
      rarity,
      isHighValue,
      quantity: cardToRemove?.quantity,
      tcgMarket: cardToRemove?.tcg_market,
      expectedStatsUpdate: isHighValue
    });
    
    const originalCards = cards;
    setCards(prev => prev.filter(card => card.id !== cardId));
    
    try {
      const result = await BinderService.removeCard(binder, cardId);
      
      this.log('removeCard:success', {
        cardId,
        cardName: result.cardName,
        statsTriggered: result.statsTriggered
      });
      
      toast({ title: "Card removed", description: `${result.cardName} removed.` });
      
      return result;
    } catch (err: any) {
      this.log('removeCard:error', {
        cardId,
        error: err.message,
        restoringOriginalState: true
      });
      
      setCards(() => originalCards);
      toast({ title: "Error", description: "Failed to remove card.", variant: "destructive" });
      throw err;
    }
  }

  static async changeCardQuantity(
    card: any,
    delta: number,
    binder: any,
    toast: any
  ) {
    const printingId = card.printingId || card.printingDetails?.printing_id;
    const rarity = card.rarity?.toUpperCase();
    const isHighValue = ['M', 'L', 'F', 'V'].includes(rarity);
    
    this.log('changeCardQuantity:start', {
      printingId,
      cardName: card.display_name || card.name,
      binderId: binder._id || binder.id,
      rarity,
      isHighValue,
      currentQuantity: card.quantity,
      delta,
      newQuantity: (card.quantity || 0) + delta,
      operation: delta > 0 ? 'increase' : 'decrease',
      expectedStatsUpdate: isHighValue
    });
    
    if (!printingId) {
      this.log('changeCardQuantity:error', { error: 'Missing printingId', card });
      toast({ title: "Error", description: "Card is missing a printing ID.", variant: "destructive" });
      throw new Error("Missing printingId");
    }
    
    try {
      const result = await BinderService.changeQuantity(binder, printingId, delta);
      
      this.log('changeCardQuantity:success', {
        printingId,
        delta,
        newQuantity: result.newQuantity,
        action: result.action,
        statsTriggered: result.statsTriggered
      });

      return result;
    } catch (err: any) {
      this.log('changeCardQuantity:error', {
        printingId,
        delta,
        error: err.message
      });
      
      console.error('Failed to change quantity:', err);
      throw err;
    }
  }

  static async toggleForTrade(
    card: any,
    checked: boolean,
    binderId: string,
    toast: any
  ) {
    const cardId = card.id || card._id;
    const rarity = card.rarity?.toUpperCase();
    const isHighValue = ['M', 'L', 'F', 'V'].includes(rarity);
    
    this.log('toggleForTrade:start', {
      cardId,
      binderId,
      cardName: card.display_name || card.name,
      rarity,
      isHighValue,
      currentForTrade: card.forTrade,
      newForTrade: checked,
      quantity: card.quantity,
      expectedStatsUpdate: isHighValue
    });
    
    if (!cardId) {
      this.log('toggleForTrade:error', { error: 'Missing instance ID', card });
      toast({ title: "Error", description: "Card is missing an instance ID.", variant: "destructive" });
      throw new Error("Missing instance ID");
    }
    
    try {
      const result = await BinderService.updateForTrade(binderId, checked, cardId);
      
      this.log('toggleForTrade:success', {
        cardId,
        forTrade: checked,
        statsTriggered: result.statsTriggered
      });

      return result;
    } catch (err: any) {
      this.log('toggleForTrade:error', {
        cardId,
        forTrade: checked,
        error: err.message
      });
      
      console.error('Failed to update for trade status:', err);
      throw err;
    }
  }
}
