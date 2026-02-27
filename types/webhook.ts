export interface WebhookPayload {
  event: string
  timestamp: string
  data: ListingCreatedPayload | ListingUpdatedPayload
}

export interface ListingCreatedPayload {
  listingId: string
  title: string
  type: "WTB" | "WTS"
  description?: string
  cards: Array<{
    name: string
    set?: string
    rarity?: string
    foiling?: string
    quantity?: number
    price?: string
    condition?: string
  }>
  user: {
    userId: string
    username: string
    discordUsername?: string
  }
  createdAt: Date
}

export interface ListingUpdatedPayload extends ListingCreatedPayload {
  updatedAt: Date
  changes: string[]
}

export interface WebhookResponse {
  success: boolean
  error?: string
}
