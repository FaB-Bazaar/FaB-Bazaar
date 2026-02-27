// lib/deck-allocation.ts

import { DeckPrinting } from '@/models/Deck'

export interface CardAllocation {
  hero: DeckPrinting[]
  equipment: DeckPrinting[]
  maindeck: DeckPrinting[]
  inventory: DeckPrinting[]
  tokens: DeckPrinting[]
  maybeboard: DeckPrinting[]
}

// Match the actual structure from browse page pendingImport
export interface PendingImportCard {
  id: string
  cardId: string
  name: string
  quantity: number
  printingId: string
  printingDetails: {
    type_text?: string  // This is the actual field name
    keywords?: string[]
    name?: string
    display_name?: string
    [key: string]: any  // Full printing data
  }
  set?: string
  rarity?: string
  foiling?: string
}

interface EquipmentSlots {
  head: number
  chest: number
  arms: number
  legs: number
}

/**
 * Helper to parse type_text into array of types
 */
function parseTypes(typeText?: string): string[] {
  if (!typeText) return []
  return typeText.toLowerCase().split(/[,\s]+/).filter(Boolean)
}

/**
 * Helper to determine if a card belongs in the deck vs equipment section
 */
function isDeckCard(types: string[]): boolean {
  const deckCardIndicators = ['action', 'instant', 'defense reaction', 'attack reaction', 'reaction']
  return deckCardIndicators.some(indicator => types.includes(indicator))
}

/**
 * Intelligently allocates cards to appropriate deck categories based on their types and game rules
 */
export function allocateCardsToCategories(
  pendingImport: PendingImportCard[]
): CardAllocation {
  const allocation: CardAllocation = {
    hero: [],
    equipment: [],
    maindeck: [],
    inventory: [],
    tokens: [],
    maybeboard: []
  }
  
  // Track equipment slots to enforce limits
  const equipmentSlots: EquipmentSlots = {
    head: 0,
    chest: 0,
    arms: 0,
    legs: 0
  }
  
  let cardPoolCount = 0 // Track equipment + maindeck + inventory for 80-card limit
  
  for (const card of pendingImport) {
    const typeText = card.printingDetails?.type_text || ''
    const types = parseTypes(typeText)
    const keywords = card.printingDetails?.keywords || []
    
    for (let i = 0; i < card.quantity; i++) {
      const cardData: DeckPrinting = {
        printingId: card.printingId,
        condition: "NM",
        notes: "",
        addedAt: new Date(),
        printingDetails: card.printingDetails
      }
      
      // Check if we're at card pool limit (80 cards)
      if (cardPoolCount >= 80) {
        allocation.maybeboard.push(cardData)
        continue
      }
      
      // Token cards - don't count toward deck limits
      if (types.includes('token')) {
        allocation.tokens.push(cardData)
        continue
      }
      
      // Hero cards - max 1 in hero section
      if (types.includes('hero')) {
        if (allocation.hero.length === 0) {
          allocation.hero.push(cardData)
        } else {
          // Multiple heroes go to maybeboard
          allocation.maybeboard.push(cardData)
        }
        continue
      }
      
      // Weapon cards - check if Evo
      if (types.includes('weapon')) {
        // Check if this is Evo equipment (can be played as actions in the deck)
        const isEvo = types.includes('evo')

        if (isEvo) {
          // Evo weapons go to maindeck
          allocation.maindeck.push(cardData)
          cardPoolCount++
        } else {
          // Normal weapons go to equipment
          allocation.equipment.push(cardData)
          cardPoolCount++
        }
        continue
      }

      // Equipment cards (non-deck cards) - check if Evo first
      if (types.includes('equipment') && !isDeckCard(types)) {
        // Check if this is Evo equipment (can be played as actions in the deck)
        const isEvo = types.includes('evo')

        if (isEvo) {
          // Evo equipment goes to maindeck (library)
          allocation.maindeck.push(cardData)
          cardPoolCount++
          continue
        }

        // Normal equipment - check slot limits
        let allocated = false
        
        // Check equipment slot limits (max 1 per slot type)
        if (types.includes('head') && equipmentSlots.head < 1) {
          equipmentSlots.head++
          allocation.equipment.push(cardData)
          cardPoolCount++
          allocated = true
        } else if (types.includes('chest') && equipmentSlots.chest < 1) {
          equipmentSlots.chest++
          allocation.equipment.push(cardData)
          cardPoolCount++
          allocated = true
        } else if (types.includes('arms') && equipmentSlots.arms < 1) {
          equipmentSlots.arms++
          allocation.equipment.push(cardData)
          cardPoolCount++
          allocated = true
        } else if (types.includes('legs') && equipmentSlots.legs < 1) {
          equipmentSlots.legs++
          allocation.equipment.push(cardData)
          cardPoolCount++
          allocated = true
        }
        
        // Off-hand or exceeded slot limits go to inventory
        if (!allocated) {
          if (cardPoolCount < 80) {
            allocation.inventory.push(cardData)
            cardPoolCount++
          } else {
            allocation.maybeboard.push(cardData)
          }
        }
        continue
      }
      
      // Deck cards (actions, instants, etc.) - smart allocation between maindeck and inventory
      if (isDeckCard(types)) {
        // For now, put deck cards in maindeck (user can move to inventory later)
        if (cardPoolCount < 80) {
          allocation.maindeck.push(cardData)
          cardPoolCount++
        } else {
          allocation.maybeboard.push(cardData)
        }
      } else {
        // Everything else goes to inventory
        if (cardPoolCount < 80) {
          allocation.inventory.push(cardData)
          cardPoolCount++
        } else {
          allocation.maybeboard.push(cardData)
        }
      }
    }
  }
  
  return allocation
}

/**
 * Calculate total cards in the card pool (equipment + maindeck + inventory)
 */
export function getCardPoolCount(allocation: CardAllocation): number {
  return allocation.equipment.length + 
         allocation.maindeck.length + 
         allocation.inventory.length
}

/**
 * Generate a human-readable summary of card allocation
 */
export function getAllocationSummary(allocation: CardAllocation): string {
  const summary: string[] = []
  
  if (allocation.hero.length) {
    summary.push(`${allocation.hero.length} hero`)
  }
  if (allocation.equipment.length) {
    summary.push(`${allocation.equipment.length} equipment`)
  }
  if (allocation.maindeck.length) {
    summary.push(`${allocation.maindeck.length} maindeck`)
  }
  if (allocation.inventory.length) {
    summary.push(`${allocation.inventory.length} inventory`)
  }
  if (allocation.tokens.length) {
    summary.push(`${allocation.tokens.length} tokens`)
  }
  if (allocation.maybeboard.length) {
    summary.push(`${allocation.maybeboard.length} maybeboard`)
  }
  
  return summary.length > 0 ? summary.join(', ') : 'No cards allocated'
}

/**
 * Get total number of cards across all categories
 */
export function getTotalCardCount(allocation: CardAllocation): number {
  return allocation.hero.length +
         allocation.equipment.length +
         allocation.maindeck.length +
         allocation.inventory.length +
         allocation.tokens.length +
         allocation.maybeboard.length
}

/**
 * Validate allocation against format rules
 */
export function validateAllocation(allocation: CardAllocation, format: string): string[] {
  const errors: string[] = []
  const cardPoolCount = getCardPoolCount(allocation)
  
  // Hero validation
  if (allocation.hero.length > 1) {
    errors.push('Only one hero allowed per deck')
  }
  
  // Format-specific validations
  switch (format) {
    case 'Classic Constructed':
    case 'Living Legend':
      if (cardPoolCount > 80) {
        errors.push(`Card pool cannot exceed 80 cards (currently ${cardPoolCount})`)
      }
      break
    case 'Blitz':
      if (cardPoolCount > 52) {
        errors.push(`Card pool cannot exceed 52 cards for Blitz (currently ${cardPoolCount})`)
      }
      break
    case 'Silver Age':
      if (cardPoolCount > 55) {
        errors.push(`Card pool cannot exceed 55 cards for Silver Age (currently ${cardPoolCount})`)
      }
      break
  }
  
  return errors
}

/**
 * Convert allocation to format expected by new API endpoints
 */
export function prepareAllocationForAPI(allocation: CardAllocation) {
  return {
    hero: allocation.hero,
    equipment: allocation.equipment,
    maindeck: allocation.maindeck,
    inventory: allocation.inventory,
    tokens: allocation.tokens,
    maybeboard: allocation.maybeboard
  }
}

/**
 * Import cards to an existing deck with smart allocation
 * NOTE: This will need new API endpoints that accept the separate arrays
 */
export async function handleImportToDeck(
  pendingImport: PendingImportCard[],
  selectedDeckId: string,
  userDecks: any[],
  toast: (options: any) => void,
  setters: {
    setCreatingBinder: (loading: boolean) => void,
    setImportSuccess: (success: boolean) => void,
    setCreatedDeckId: (id: string | null) => void,
    setPendingImport: (cards: any[]) => void
  }
) {
  if (!pendingImport.length || !selectedDeckId) return
  
  setters.setCreatingBinder(true)
  setters.setImportSuccess(false)
  setters.setCreatedDeckId(null)
  
  try {
    // Use smart allocation
    const allocation = allocateCardsToCategories(pendingImport)
    
    // Validate allocation (selectedDeckId is now publicId)
    const selectedDeck = userDecks.find(d => d.publicId === selectedDeckId)
    const format = selectedDeck?.format || 'Classic Constructed'
    const validationErrors = validateAllocation(allocation, format)
    
    if (validationErrors.length > 0) {
      toast({ 
        title: "Allocation warnings", 
        description: validationErrors.join(', '),
        variant: "destructive" 
      })
      // Continue anyway - user can reorganize later
    }
    
    // TODO: This will need a new API endpoint that accepts the separate arrays
    // For now, we'll need to call the existing endpoint multiple times or create a new one
    const apiPayload = prepareAllocationForAPI(allocation)
    
    const res = await fetch(`/api/decks/${selectedDeckId}/import-allocation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload),
    })
    
    if (!res.ok) {
      throw new Error("Failed to add cards to deck")
    }
    
    const result = await res.json()
    if (!result.success) {
      throw new Error(result.error || "Failed to add cards to deck")
    }
    
    toast({ 
      title: "Import successful!", 
      description: `Allocated ${getTotalCardCount(allocation)} cards: ${getAllocationSummary(allocation)}`,
      variant: "default" 
    })
    setters.setPendingImport([])
    setters.setCreatedDeckId(selectedDeckId)
    setters.setImportSuccess(true)
  } catch (err: any) {
    toast({ 
      title: "Import failed", 
      description: err.message || "Could not import cards to deck.", 
      variant: "destructive" 
    })
  } finally {
    setters.setCreatingBinder(false)
  }
}

export async function handleImportToNewDeck(
    pendingImport: any[],
    deckName: string,
    deckFormat: string,
    toast: any,
    setters: any
  ) {
    const { setCreatingBinder, setImportSuccess, setCreatedDeckId, setPendingImport, setUserDecks } = setters;
    
    setCreatingBinder(true);
    setImportSuccess(false);
    setCreatedDeckId(null);
    
    try {
      // Convert pendingImport to the format expected by create-with-cards API
      const cards = pendingImport.map(card => ({
        printingId: card.printingId,
        quantity: card.quantity
      }));
  
      // Import the new API function
      const { createDeckWithCards } = await import('@/lib/browse/api');
  
      // Use the new create-with-cards API instead of the old createDeck
      const result = await createDeckWithCards(deckName, deckFormat, false, cards);
      
      toast({
        title: "Deck created successfully!",
        description: `Created deck '${result.deck.name}' with ${result.deck.totalCards} cards. ${result.message}`,
        variant: "default"
      });
      
      setCreatedDeckId(result.deck.publicId);
      setImportSuccess(true);
      setPendingImport([]);
      
      // Update user decks list
      if (setUserDecks) {
        setUserDecks((prev: any[]) => [...prev, result.deck]);
      }
      
    } catch (error: any) {
      console.error('Error creating deck with cards:', error);
      toast({
        title: "Failed to create deck",
        description: error.message || "Could not create deck with cards.",
        variant: "destructive"
      });
    } finally {
      setCreatingBinder(false);
    }
  }

// /**
//  * Create a new deck and import cards with smart allocation
//  */
// export async function handleImportToNewDeck(
//   pendingImport: PendingImportCard[],
//   deckName: string,
//   deckFormat: string,
//   toast: (options: any) => void,
//   setters: {
//     setCreatingBinder: (loading: boolean) => void,
//     setImportSuccess: (success: boolean) => void,
//     setCreatedDeckId: (id: string | null) => void,
//     setPendingImport: (cards: any[]) => void,
//     setUserDecks: (updater: (prev: any[]) => any[]) => void
//   }
// ) {
//   if (!pendingImport.length) return
  
//   setters.setCreatingBinder(true)
//   setters.setImportSuccess(false)
//   setters.setCreatedDeckId(null)
  
//   try {
//     // Use smart allocation
//     const allocation = allocateCardsToCategories(pendingImport)
    
//     // Validate allocation
//     const validationErrors = validateAllocation(allocation, deckFormat)
//     if (validationErrors.length > 0) {
//       toast({ 
//         title: "Allocation warnings", 
//         description: validationErrors.join(', '),
//         variant: "destructive" 
//       })
//       // Continue anyway - user can reorganize later
//     }
    
//     // Create deck with initial allocation
//     const apiPayload = {
//       name: deckName,
//       format: deckFormat,
//       isPublic: false,
//       initialAllocation: prepareAllocationForAPI(allocation)
//     }
    
//     const createRes = await fetch(`/api/decks/create-with-allocation`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(apiPayload),
//     })
    
//     if (!createRes.ok) throw new Error("Failed to create deck")
//     const createResult = await createRes.json()
//     if (!createResult.success) throw new Error(createResult.error || "Failed to create deck")
    
//     const newDeck = createResult.deck
    
//     setters.setCreatedDeckId(newDeck._id)
//     setters.setImportSuccess(true)
//     toast({ 
//       title: "Deck created and cards imported!", 
//       description: `Created '${deckName}' with ${getTotalCardCount(allocation)} cards: ${getAllocationSummary(allocation)}` 
//     })
//     setters.setPendingImport([])
    
//     // Refresh user decks list
//     fetch("/api/decks/user")
//       .then(res => res.json())
//       .then(data => {
//         if (data.success) {
//           setters.setUserDecks(() => data.decks || [])
//         }
//       })
//       .catch(console.error)
    
//   } catch (err: any) {
//     toast({ 
//       title: "Import failed", 
//       description: err.message || "Could not create deck and import cards.", 
//       variant: "destructive" 
//     })
//   } finally {
//     setters.setCreatingBinder(false)
//   }
// }
// // lib/deck-allocation.ts

// import { DeckPrinting } from '@/models/Deck2'

// export interface CardAllocation {
//   hero: DeckPrinting[]
//   equipment: DeckPrinting[]
//   maindeck: DeckPrinting[]
//   inventory: DeckPrinting[]
//   tokens: DeckPrinting[]
//   maybeboard: DeckPrinting[]
// }

// export interface PendingImportCard {
//   printingId: string
//   quantity: number
//   printingDetails?: {
//     types: string[]
//     keywords?: string[]
//   }
// }

// interface EquipmentSlots {
//   head: number
//   chest: number
//   arms: number
//   legs: number
// }

// /**
//  * Intelligently allocates cards to appropriate deck categories based on their types and game rules
//  */
// export function allocateCardsToCategories(
//   pendingImport: PendingImportCard[]
// ): CardAllocation {
//   const allocation: CardAllocation = {
//     hero: [],
//     equipment: [],
//     maindeck: [],
//     inventory: [],
//     tokens: [],
//     maybeboard: []
//   }
  
//   // Track equipment slots to enforce limits
//   const equipmentSlots: EquipmentSlots = {
//     head: 0,
//     chest: 0,
//     arms: 0,
//     legs: 0
//   }
  
//   let cardPoolCount = 0 // Track equipment + maindeck + inventory for 80-card limit
  
//   for (const card of pendingImport) {
//     const types = card.printingDetails?.types || []
//     const keywords = card.printingDetails?.keywords || []
//     const deckCardIndicators = ['action', 'instant', 'defense reaction', 'block', 'attack reaction']
//     const belongsInDeck = deckCardIndicators.some(indicator => types.includes(indicator))
    
//     for (let i = 0; i < card.quantity; i++) {
//       const cardData: DeckPrinting = {
//         printingId: card.printingId,
//         condition: "NM",
//         notes: "",
//         addedAt: new Date()
//       }
      
//       // Check if we're at card pool limit (80 cards)
//       if (cardPoolCount >= 80) {
//         allocation.maybeboard.push(cardData)
//         continue
//       }
      
//       // Token cards - don't count toward deck limits
//       if (types.includes('token')) {
//         allocation.tokens.push(cardData)
//         continue
//       }
      
//       // Hero cards - max 1 in hero section
//       if (types.includes('hero')) {
//         if (allocation.hero.length === 0) {
//           allocation.hero.push(cardData)
//         } else {
//           // Multiple heroes go to maybeboard
//           allocation.maybeboard.push(cardData)
//         }
//         continue
//       }
      
//       // Weapon cards - always go to equipment
//       if (types.includes('weapon')) {
//         allocation.equipment.push(cardData)
//         cardPoolCount++
//         continue
//       }
      
//       // Equipment cards (non-transform) - check slot limits
//       if (types.includes('equipment') && !belongsInDeck) {
//         let allocated = false
        
//         // Check equipment slot limits (max 1 per slot type)
//         if (types.includes('head') && equipmentSlots.head < 1) {
//           equipmentSlots.head++
//           allocation.equipment.push(cardData)
//           cardPoolCount++
//           allocated = true
//         } else if (types.includes('chest') && equipmentSlots.chest < 1) {
//           equipmentSlots.chest++
//           allocation.equipment.push(cardData)
//           cardPoolCount++
//           allocated = true
//         } else if (types.includes('arms') && equipmentSlots.arms < 1) {
//           equipmentSlots.arms++
//           allocation.equipment.push(cardData)
//           cardPoolCount++
//           allocated = true
//         } else if (types.includes('legs') && equipmentSlots.legs < 1) {
//           equipmentSlots.legs++
//           allocation.equipment.push(cardData)
//           cardPoolCount++
//           allocated = true
//         }
        
//         // Off-hand or exceeded slot limits go to inventory
//         if (!allocated) {
//           if (cardPoolCount < 80) {
//             allocation.inventory.push(cardData)
//             cardPoolCount++
//           } else {
//             allocation.maybeboard.push(cardData)
//           }
//         }
//         continue
//       }
      
//       // Deck cards (actions, instants, etc.) and everything else go to inventory
//       if (cardPoolCount < 80) {
//         allocation.inventory.push(cardData)
//         cardPoolCount++
//       } else {
//         allocation.maybeboard.push(cardData)
//       }
//     }
//   }
  
//   return allocation
// }

// /**
//  * Calculate total cards in the card pool (equipment + maindeck + inventory)
//  */
// export function getCardPoolCount(allocation: CardAllocation): number {
//   return allocation.equipment.length + 
//          allocation.maindeck.length + 
//          allocation.inventory.length
// }

// /**
//  * Generate a human-readable summary of card allocation
//  */
// export function getAllocationSummary(allocation: CardAllocation): string {
//   const summary: string[] = []
  
//   if (allocation.hero.length) {
//     summary.push(`${allocation.hero.length} hero`)
//   }
//   if (allocation.equipment.length) {
//     summary.push(`${allocation.equipment.length} equipment`)
//   }
//   if (allocation.maindeck.length) {
//     summary.push(`${allocation.maindeck.length} maindeck`)
//   }
//   if (allocation.inventory.length) {
//     summary.push(`${allocation.inventory.length} inventory`)
//   }
//   if (allocation.tokens.length) {
//     summary.push(`${allocation.tokens.length} tokens`)
//   }
//   if (allocation.maybeboard.length) {
//     summary.push(`${allocation.maybeboard.length} maybeboard`)
//   }
  
//   return summary.length > 0 ? summary.join(', ') : 'No cards allocated'
// }

// /**
//  * Flatten allocation into a single array with category information for API calls
//  */
// export function flattenAllocation(allocation: CardAllocation): Array<DeckPrinting & { category: string }> {
//   return [
//     ...allocation.hero.map(card => ({ ...card, category: 'hero' })),
//     ...allocation.equipment.map(card => ({ ...card, category: 'equipment' })),
//     ...allocation.maindeck.map(card => ({ ...card, category: 'maindeck' })),
//     ...allocation.inventory.map(card => ({ ...card, category: 'inventory' })),
//     ...allocation.tokens.map(card => ({ ...card, category: 'tokens' })),
//     ...allocation.maybeboard.map(card => ({ ...card, category: 'maybeboard' }))
//   ]
// }

// /**
//  * Get total number of cards across all categories
//  */
// export function getTotalCardCount(allocation: CardAllocation): number {
//   return allocation.hero.length +
//          allocation.equipment.length +
//          allocation.maindeck.length +
//          allocation.inventory.length +
//          allocation.tokens.length +
//          allocation.maybeboard.length
// }

// /**
//  * Validate allocation against format rules
//  */
// export function validateAllocation(allocation: CardAllocation, format: string): string[] {
//   const errors: string[] = []
//   const cardPoolCount = getCardPoolCount(allocation)
  
//   // Hero validation
//   if (allocation.hero.length > 1) {
//     errors.push('Only one hero allowed per deck')
//   }
  
//   // Format-specific validations
//   switch (format) {
//     case 'Classic Constructed':
//     case 'Living Legend':
//       if (cardPoolCount > 80) {
//         errors.push(`Card pool cannot exceed 80 cards (currently ${cardPoolCount})`)
//       }
//       break
//     case 'Blitz':
//       if (cardPoolCount > 52) {
//         errors.push(`Card pool cannot exceed 52 cards for Blitz (currently ${cardPoolCount})`)
//       }
//       break
//   }
  
//   return errors
// }

// /**
//  * Import cards to an existing deck with smart allocation
//  */
// export async function handleImportToDeck(
//   pendingImport: PendingImportCard[],
//   selectedDeckId: string,
//   userDecks: any[],
//   toast: (options: any) => void,
//   setters: {
//     setCreatingBinder: (loading: boolean) => void,
//     setImportSuccess: (success: boolean) => void,
//     setCreatedDeckId: (id: string | null) => void,
//     setPendingImport: (cards: any[]) => void
//   }
// ) {
//   if (!pendingImport.length || !selectedDeckId) return
  
//   setters.setCreatingBinder(true)
//   setters.setImportSuccess(false)
//   setters.setCreatedDeckId(null)
  
//   try {
//     // Use smart allocation
//     const allocation = allocateCardsToCategories(pendingImport)
    
//     // Validate allocation
//     const selectedDeck = userDecks.find(d => d._id === selectedDeckId)
//     const format = selectedDeck?.format || 'Classic Constructed'
//     const validationErrors = validateAllocation(allocation, format)
    
//     if (validationErrors.length > 0) {
//       toast({ 
//         title: "Allocation warnings", 
//         description: validationErrors.join(', '),
//         variant: "destructive" 
//       })
//       // Continue anyway - user can reorganize later
//     }
    
//     const printingsToAdd = flattenAllocation(allocation)
    
//     const res = await fetch(`/api/decks/${selectedDeckId}/printings/add`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ printings: printingsToAdd }),
//     })
    
//     if (!res.ok) {
//       throw new Error("Failed to add cards to deck")
//     }
    
//     const result = await res.json()
//     if (!result.success) {
//       throw new Error(result.error || "Failed to add cards to deck")
//     }
    
//     toast({ 
//       title: "Import successful!", 
//       description: `Allocated ${getTotalCardCount(allocation)} cards: ${getAllocationSummary(allocation)}`,
//       variant: "default" 
//     })
//     setters.setPendingImport([])
//     setters.setCreatedDeckId(selectedDeckId)
//     setters.setImportSuccess(true)
//   } catch (err: any) {
//     toast({ 
//       title: "Import failed", 
//       description: err.message || "Could not import cards to deck.", 
//       variant: "destructive" 
//     })
//   } finally {
//     setters.setCreatingBinder(false)
//   }
// }

// /**
//  * Create a new deck and import cards with smart allocation
//  */
// export async function handleImportToNewDeck(
//   pendingImport: PendingImportCard[],
//   deckName: string,
//   deckFormat: string,
//   toast: (options: any) => void,
//   setters: {
//     setCreatingBinder: (loading: boolean) => void,
//     setImportSuccess: (success: boolean) => void,
//     setCreatedDeckId: (id: string | null) => void,
//     setPendingImport: (cards: any[]) => void,
//     setUserDecks: (updater: (prev: any[]) => any[]) => void
//   }
// ) {
//   if (!pendingImport.length) return
  
//   setters.setCreatingBinder(true)
//   setters.setImportSuccess(false)
//   setters.setCreatedDeckId(null)
  
//   try {
//     // Use smart allocation
//     const allocation = allocateCardsToCategories(pendingImport)
    
//     // Validate allocation
//     const validationErrors = validateAllocation(allocation, deckFormat)
//     if (validationErrors.length > 0) {
//       toast({ 
//         title: "Allocation warnings", 
//         description: validationErrors.join(', '),
//         variant: "destructive" 
//       })
//       // Continue anyway - user can reorganize later
//     }
    
//     // First create the deck
//     const createRes = await fetch(`/api/decks/create`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ 
//         name: deckName,
//         format: deckFormat,
//         isPublic: false
//       }),
//     })
//     if (!createRes.ok) throw new Error("Failed to create deck")
//     const createResult = await createRes.json()
//     if (!createResult.success) throw new Error(createResult.error || "Failed to create deck")
    
//     const newDeck = createResult.deck
    
//     // Then add cards using smart allocation
//     const printingsToAdd = flattenAllocation(allocation)
    
//     const addRes = await fetch(`/api/decks/${newDeck._id}/printings/add`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ printings: printingsToAdd }),
//     })
    
//     if (!addRes.ok) {
//       throw new Error("Failed to add cards to new deck")
//     }
    
//     const addResult = await addRes.json()
//     if (!addResult.success) {
//       throw new Error(addResult.error || "Failed to add cards to new deck")
//     }
    
//     setters.setCreatedDeckId(newDeck._id)
//     setters.setImportSuccess(true)
//     toast({ 
//       title: "Deck created and cards imported!", 
//       description: `Created '${deckName}' with ${getTotalCardCount(allocation)} cards: ${getAllocationSummary(allocation)}` 
//     })
//     setters.setPendingImport([])
    
//     // Refresh user decks list
//     fetch("/api/decks/user")
//       .then(res => res.json())
//       .then(data => {
//         if (data.success) {
//           setters.setUserDecks(() => data.decks || [])
//         }
//       })
//       .catch(console.error)
    
//   } catch (err: any) {
//     toast({ 
//       title: "Import failed", 
//       description: err.message || "Could not create deck and import cards.", 
//       variant: "destructive" 
//     })
//   } finally {
//     setters.setCreatingBinder(false)
//   }
// }