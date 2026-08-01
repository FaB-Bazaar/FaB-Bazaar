// app/discord-v2/commands/index.js
// Re-export all command handlers from individual command files

// Search commands
export { handleSearchCommand } from './search.js';

// Binder commands
export {
  handleListBinders,
  handleBinderCommand,
  handleSpecificBinder,
} from './binder.js';

// Context menu commands
export {
  handlePublicBinder,
  handleSpecificBinderPublic,
  handlePublicWants,
} from './contextMenu.js';

// Public component handlers
export {
  handlePublicBinderSelect,
  handlePublicBinderPage,
  handlePublicWantsPage,
} from './publicComponents.js';

// Wants commands
export {
  handleWantsCommand,
} from './wants.js';

// Card interaction commands
export {
  handleAddToBinder,
  handleAddToWants,
  handleBinderSelection,
  addPrintingToBinder,
  addPrintingToWants,
  handleWhoHas,
  showWhoHasPrinting,
  handleWhoWants,
  showWhoWantsPrinting
} from './cardActions.js';

// Trade analysis commands
export {
  handleTradeAnalysis,
} from './trade-analysis.js';

// Deck commands
export {
  handleDeckCommand,
} from './deck.js';

// Deck needs (/needs + "Deck Needs" context menu)
export {
  handleNeedsCommand,
  handleNeedsDeckSelect,
  handleNeedsMode,
} from './needs.js';
// // app/discord-v2/commands/index.js
// // Re-export all command handlers from individual command files

// // Search commands
// export { handleSearchCommand } from './search.js';

// // Binder commands
// export {
//   handleListBinders,
//   handleBinderCommand,
//   handleSpecificBinder, // NEW: Add this export
// } from './binder.js';

// // Wants commands
// export {
//   handleWantsCommand,
// } from './wants.js';

// // Card interaction commands
// export {
//   handleAddToBinder,
//   handleAddToWants,
//   handleBinderSelection,
//   addPrintingToBinder,
//   addPrintingToWants,
//   handleWhoHas,
//   showWhoHasPrinting
// } from './cardActions.js';

// // Trade analysis commands
// export {
//   handleTradeAnalysis,
// } from './trade-analysis.js';
