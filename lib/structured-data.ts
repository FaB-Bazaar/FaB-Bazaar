// Structured Data (Schema.org) for FaB Bazaar
// This helps search engines understand your content and show rich snippets

export interface CardData {
  name: string
  set: string
  rarity: string
  foiling?: string
  edition?: string
  imageUrl?: string
  price?: number
  condition?: string
}

export interface BinderData {
  id: string
  name: string
  description?: string
  cardCount: number
  owner: string
  createdAt: string
  updatedAt: string
}

export interface WantsListData {
  id: string
  owner: string
  cardCount: number
  createdAt: string
  updatedAt: string
}


// Organization Schema (for your company/platform)
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FaB Bazaar",
    "url": "https://fabbazaar.app",
    "logo": "https://fabbazaar.app/fab-bazaar.png",
    "description": "The Ultimate Flesh and Blood Trading Platform",
    "foundingDate": "2024",
    "sameAs": [
      // Add your social media URLs here
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": "English"
    },
    "areaServed": "Worldwide",
    "serviceType": "Trading Card Platform"
  }
}

// Website Schema (for your main site)
export function getWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "FaB Bazaar",
    "url": "https://fabbazaar.app",
    "description": "Trade Flesh and Blood cards with other collectors",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://fabbazaar.app/browse?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
}

// Product Schema (for individual cards)
export function getCardSchema(card: CardData) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": card.name,
    "description": `${card.name} - ${card.set} ${card.rarity}${card.foiling ? ` ${card.foiling}` : ''}`,
    "image": card.imageUrl,
    "brand": {
      "@type": "Brand",
      "name": "Legend Story Studios"
    },
    "category": "Trading Card",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Set",
        "value": card.set
      },
      {
        "@type": "PropertyValue",
        "name": "Rarity",
        "value": card.rarity
      },
      ...(card.foiling ? [{
        "@type": "PropertyValue",
        "name": "Foiling",
        "value": card.foiling
      }] : []),
      ...(card.edition ? [{
        "@type": "PropertyValue",
        "name": "Edition",
        "value": card.edition
      }] : []),
      ...(card.condition ? [{
        "@type": "PropertyValue",
        "name": "Condition",
        "value": card.condition
      }] : [])
    ],
    ...(card.price && {
      "offers": {
        "@type": "Offer",
        "price": card.price,
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock"
      }
    })
  }
}

// Collection Schema (for binders)
export function getBinderSchema(binder: BinderData) {
  return {
    "@context": "https://schema.org",
    "@type": "Collection",
    "name": binder.name,
    "description": binder.description || `Collection of ${binder.cardCount} Flesh and Blood cards`,
    "url": `https://fabbazaar.app/binder/${binder.id}`,
    "creator": {
      "@type": "Person",
      "name": binder.owner
    },
    "numberOfItems": binder.cardCount,
    "dateCreated": binder.createdAt,
    "dateModified": binder.updatedAt,
    "collectionType": "Trading Card Collection"
  }
}

// Wants List Schema
export function getWantsListSchema(wantsList: WantsListData) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${wantsList.owner}'s Wants List`,
    "description": `Wants list with ${wantsList.cardCount} cards`,
    "url": `https://fabbazaar.app/wants/${wantsList.id}`,
    "creator": {
      "@type": "Person",
      "name": wantsList.owner
    },
    "numberOfItems": wantsList.cardCount,
    "dateCreated": wantsList.createdAt,
    "dateModified": wantsList.updatedAt,
    "itemListType": "Wants List"
  }
}



// Article Schema (for blog posts or guides)
export function getArticleSchema(article: {
  title: string
  description: string
  author: string
  publishedDate: string
  modifiedDate?: string
  imageUrl?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "datePublished": article.publishedDate,
    ...(article.modifiedDate && { "dateModified": article.modifiedDate }),
    ...(article.imageUrl && { "image": article.imageUrl }),
    "publisher": {
      "@type": "Organization",
      "name": "FaB Bazaar",
      "logo": {
        "@type": "ImageObject",
        "url": "https://fabbazaar.app/fab-bazaar.png"
      }
    }
  }
}

// Event Schema (for tournaments or meetups)
export function getEventSchema(event: {
  name: string
  description: string
  startDate: string
  endDate: string
  location: string
  organizer: string
  eventType: 'tournament' | 'meetup' | 'trading'
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name,
    "description": event.description,
    "startDate": event.startDate,
    "endDate": event.endDate,
    "location": {
      "@type": "Place",
      "name": event.location
    },
    "organizer": {
      "@type": "Person",
      "name": event.organizer
    },
    "eventType": event.eventType,
    "category": "Trading Card Game"
  }
}

// Helper function to generate all schemas for a page
export function generatePageSchemas(pageType: string, data?: any): any[] {
  const schemas: any[] = [getOrganizationSchema(), getWebsiteSchema()]
  
  switch (pageType) {
    case 'card':
      if (data) schemas.push(getCardSchema(data))
      break
    case 'binder':
      if (data) schemas.push(getBinderSchema(data))
      break
    case 'wants':
      if (data) schemas.push(getWantsListSchema(data))
      break
    case 'article':
      if (data) schemas.push(getArticleSchema(data))
      break
  }
  
  return schemas
} 