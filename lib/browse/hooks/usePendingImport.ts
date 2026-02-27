// lib/browse/hooks/usePendingImport.ts
export function usePendingImport() {
    const [pendingImport, setPendingImport] = useState<PendingImportCard[]>([])
  
    const addToPending = (card: any, printing: any, quantity: number) => {
      setPendingImport(prev => {
        const cardId = card.card_unique_id || card.cardId || card.unique_id
        const printingId = printing?.printing_id || printing?.unique_id
        
        const idx = prev.findIndex(c => c.cardId === cardId && c.printingId === printingId)
        
        if (idx !== -1) {
          return prev.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity + quantity } : item
          )
        } else {
          return [
            ...prev,
            {
              id: printingId,
              cardId: cardId,
              name: card.display_name || card.name,
              quantity: quantity,
              printingId: printingId,
              printingDetails: { ...printing },
              set: printing?.set_id || printing?.set,
              rarity: printing?.rarity,
              foiling: printing?.foiling
            }
          ]
        }
      })
    }
  
    const incrementPending = (card: PendingImportCard) => {
      setPendingImport(prev => 
        prev.map(c => c === card ? { ...c, quantity: c.quantity + 1 } : c)
      )
    }
  
    const decrementPending = (card: PendingImportCard) => {
      setPendingImport(prev => 
        prev.flatMap(c => 
          c === card ? (c.quantity > 1 ? [{ ...c, quantity: c.quantity - 1 }] : []) : [c]
        )
      )
    }
  
    const removePending = (card: PendingImportCard) => {
      setPendingImport(prev => prev.filter(c => c !== card))
    }
  
    const clearPending = () => {
      setPendingImport([])
    }
  
    const getTotalQuantity = () => 
      pendingImport.reduce((sum, c) => sum + c.quantity, 0)
  
    return {
      pendingImport,
      addToPending,
      incrementPending,
      decrementPending,
      removePending,
      clearPending,
      getTotalQuantity
    }
  }