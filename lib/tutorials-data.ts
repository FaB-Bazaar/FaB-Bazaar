export interface TutorialVideo {
  videoId?: string
  title: string
  description: string
}

export interface Tutorial {
  slug: string
  title: string
  description: string
  icon: string
  videos: TutorialVideo[]
}

export const tutorials: Tutorial[] = [
  {
    slug: "collection-management",
    title: "Collection Management",
    description: "Creating binders, adding cards, managing your collection, and building your wants list",
    icon: "Layers",
    videos: [
      {
        title: "Creating and Organizing Binders",
        description:
          "From the Collection page, create a new binder by giving it a name and optional tags. Each binder gets a unique URL slug you can customize. Use tags to organize binders by category \u2014 for example, separate binders for trade stock, personal collection, or sealed product. You can set visibility to public, private, or unlisted, and control whether cards appear in search, trade matching, and \u201cWho Has\u201d results.",
      },
      {
        title: "Adding Cards to Your Binder",
        description:
          "Open a binder and click Add Cards to search by name and select the exact printing you want. For bulk entry, use the Browse page \u2014 paste a list of cards (e.g. \u201c3x Snatch (Red)\u201d one per line), review the matched results, stage the ones you want, then import them into your binder. You can specify foiling, set, and edition in your input for precise matching.",
      },
      {
        title: "Managing Cards and Bulk Operations",
        description:
          "Each card tile shows the image, quantity, foiling, rarity, and current price. Use the +/\u2212 buttons to adjust quantities and the trade toggle to mark cards as available for trade. Select multiple cards with checkboxes for bulk actions \u2014 transfer cards between binders, delete selections, or copy a formatted list to your clipboard. The binder stats tab shows your total value and breakdown by rarity.",
      },
      {
        title: "Building Your Wants List",
        description:
          "Add cards to your wants list from any binder, deck, or the search page. Each want has a priority level \u2014 High, Medium, or Low \u2014 that you can cycle through with a click. Filter your wants by priority, rarity, foiling, or set to focus on what matters most. The header shows your total wants, quantity needed, and estimated value. Share your wants list URL with other traders so they can see what you\u2019re looking for.",
      },
    ],
  },
  {
    slug: "browsing-search",
    title: "Browsing & Search",
    description: "Finding cards with filters, checking prices, and using the advanced search syntax",
    icon: "Search",
    videos: [
      {
        title: "Using the Advanced Search",
        description:
          "The Search page gives you a powerful filter panel to narrow down cards by set, rarity, foiling, edition, color, card type, class, and price range. Toggle filters on the left sidebar and results update in the main area. Switch between checklist view (sortable table with columns for name, set, price) and image grid view. Select cards from results to add them to a binder or copy a list to your clipboard.",
      },
      {
        title: "Search Shorthand Syntax",
        description:
          "Type structured queries directly into the search bar for fast lookups. Use filters like set:cru, rarity:m, foiling:cf, class:ninja, type:attack, or price:10-50 to combine multiple criteria in one query. You can also search card text with text:\"go again\" or filter by keyword with keyword:dominate. This is the fastest way to find specific cards once you learn the syntax.",
      },
      {
        title: "Bulk Import and Card Lookup",
        description:
          "The Browse page is built for looking up multiple cards at once. Paste a decklist or card list \u2014 one card per line with optional quantities, colors, and set codes. FaB Bazaar matches each line to the best printing and shows results in a grid. From there you can stage cards, swap to a different printing, adjust quantities, and import the batch into any of your binders or add them to your wants list.",
      },
      {
        title: "Checking Prices and Who Has a Card",
        description:
          "Every card displays TCG Player pricing \u2014 Low, Mid, High, and Market \u2014 updated daily. Prices are multiplied by quantity so you can see the total value at a glance. Use the \u201cWho Has\u201d dropdown on any card to see which public binders contain that printing, making it easy to find potential trade partners.",
      },
    ],
  },
  {
    slug: "deck-building",
    title: "Deck Building",
    description: "Creating decks, adding cards, managing your list, and syncing with your collection",
    icon: "LayoutGrid",
    videos: [
      {
        title: "Adding Cards via Curated Builds",
        description:
          "When you create a new deck and select a hero, FaB Bazaar suggests pre-built decklists based on popular builds for that hero. Click any suggested build to instantly populate your deck with the most commonly played cards. If your deck already has cards in it, you'll be asked to confirm before the build is applied. This is the fastest way to get a starting point for a new deck.",
      },
      {
        title: "Using the Tile Manager",
        description:
          "The Deck tab displays your cards as visual tiles organized by pitch value \u2014 red, yellow, and blue sections \u2014 plus equipment and inventory. Each tile shows the card image with quantity controls. Use the +/\u2212 buttons to adjust how many copies you're running, move individual cards between maindeck, inventory, and bench categories, or remove cards entirely. The Quick Add button lets you search for and add new cards to any section directly.",
      },
      {
        title: "Using the Heads-Up Display",
        description:
          "Press \u2318K (or Ctrl+K on Windows) to open the chord shortcut HUD at the bottom of the screen. From there, press number keys 1\u20134 to jump to red, yellow, blue, or inventory sections. Press A, C, or D followed by a number to highlight cards by attack, cost, or defense value. Press K to filter by keyword (start typing and it auto-completes), T to filter by card type, or W for arcane damage. Press O to show only owned cards or U for unowned. Hit Escape to clear all filters.",
      },
      {
        title: "Syncing with Your Collection",
        description:
          "Select one of your binders from the deck legend to see ownership indicators on every card \u2014 green for cards you own, red for cards you still need. Use \u201cUpgrade Printings\u201d to automatically swap any unowned card printings with versions you actually have in your collection. You can also add cards directly to your binder or wants list from the deck view, making it easy to build a shopping list for cards you're missing.",
      },
    ],
  },
  {
    slug: "talishar",
    title: "Talishar Integration",
    description: "Play your FaB Bazaar decks on Talishar, configure matchup sideboarding, and track game results",
    icon: "Swords",
    videos: [
      {
        title: "Linking Your Metafy Account",
        description:
          "Before your decks can appear in Talishar, you need to connect your Metafy account. Go to Profile \u2192 Edit Profile and click the link button in the Metafy section. You\u2019ll be redirected to Metafy to authorize the connection. Once linked, Talishar can look up your decks by your Metafy ID. You can disconnect your account at any time from the same page.",
      },
      {
        title: "Enabling a Deck for Talishar",
        description:
          "Open any deck and toggle the Talishar switch to make it available for online play. Your deck\u2019s hero, equipment, maindeck, and inventory are automatically converted to Talishar\u2019s format. Cards in your inventory section become your sideboard. Once enabled, the deck appears in your Talishar deck list when you start a game.",
      },
      {
        title: "Sideboard Sync",
        description:
          "Talishar automatically syncs your sideboard with your deck. Any changes you make to your sideboard in Talishar automatically update your deck's matchups, and your matchups are automatically applied according to your opponent's hero.",
      },
      {
        title: "Tracking Game Results",
        description:
          "After you finish a game on Talishar, your results are sent back to FaB Bazaar automatically. The Results tab shows your win/loss record broken down by opponent hero, along with per-card performance stats \u2014 how often each card was played, hit, blocked, or pitched. Use this data to refine your deck and sideboard plans over time.",
      },
    ],
  },
]
