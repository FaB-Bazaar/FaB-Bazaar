// app/discord-v2/commands.js
// Re-export all command handlers from the commands folder

export {
  // Search commands
  handleSearchCommand,
  
  // Binder commands
  handleListBinders,
  handleBinderCommand,
  
  // NEW: Add these context menu commands
  handlePublicBinder,
  handleSpecificBinderPublic,
  handlePublicWants,
  
  // NEW: Add these public component handlers
  handlePublicBinderSelect,
  handlePublicBinderPage,
  handlePublicWantsPage,
  
  // Wants commands
  handleWantsCommand,
  
  // Card interaction commands
  handleAddToBinder,
  handleAddToWants,
  handleBinderSelection,
  addPrintingToBinder,
  addPrintingToWants,
  handleWhoHas,
  showWhoHasPrinting,
  handleWhoWants,
  showWhoWantsPrinting,

  // Trade analysis commands
  handleTradeAnalysis,

  // Deck commands
  handleDeckCommand,

  // Deck needs (/needs + "Deck Needs" context menu)
  handleNeedsCommand,
  handleNeedsDeckSelect,
  handleNeedsMode,
} from './commands/index.js';