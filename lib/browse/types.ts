// lib/browse/types.ts
export interface BulkImportSource {
    type: 'fabrary' | 'cardlist' | 'fabtcg'
    name: string
    description: string
    placeholder: string
  }
  
  export interface PendingImportCard {
    id: string
    cardId: string
    name: string
    quantity: number
    printingId: string
    printingDetails: any
    set?: string
    rarity?: string
    foiling?: string
  }
  
  export interface BulkSelection {
    printing: any | null
    quantity: number
  }
  
  export interface ImportMode {
    type: 'binder' | 'deck'
  }
  