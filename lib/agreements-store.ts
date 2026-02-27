// Types for our trade agreements
export interface TradeItem {
  id: string
  name: string
  description: string
  condition?: string
  value?: string
}

// Update the TradeParty interface to include location information
export interface TradeParty {
  username: string
  discordId: string
  email?: string
  location?: {
    city?: string
    state?: string
    country?: string
  }
}

export interface TradeAgreement {
  id: string
  initiatorId: string
  recipientId: string
  initiator: TradeParty
  recipient: TradeParty
  initiatorItems: TradeItem[]
  recipientItems: TradeItem[]
  additionalTerms?: string
  shippingDate?: string
  shippingMethod?: string
  trackingNumber?: string
  status: "draft" | "pending" | "accepted" | "completed" | "cancelled"
  createdAt: string
  updatedAt: string
}

// Helper to generate a unique ID
export const generateAgreementId = (): string => {
  return "AGR-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5).toUpperCase()
}

// Get all agreements from local storage
export const getAgreements = (): TradeAgreement[] => {
  if (typeof window === "undefined") return []

  const agreements = localStorage.getItem("agreements")
  return agreements ? JSON.parse(agreements) : []
}

// Get a specific agreement by ID
export const getAgreementById = (id: string): TradeAgreement | null => {
  const agreements = getAgreements()
  return agreements.find((agreement) => agreement.id === id) || null
}

// Add a new agreement
export const createAgreement = (agreement: Omit<TradeAgreement, "id" | "createdAt" | "updatedAt">): TradeAgreement => {
  const newAgreement: TradeAgreement = {
    ...agreement,
    id: generateAgreementId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const agreements = getAgreements()
  agreements.push(newAgreement)

  localStorage.setItem("agreements", JSON.stringify(agreements))
  return newAgreement
}

// Update an existing agreement
export const updateAgreement = (id: string, updates: Partial<TradeAgreement>): TradeAgreement | null => {
  const agreements = getAgreements()
  const index = agreements.findIndex((agreement) => agreement.id === id)

  if (index === -1) return null

  const updatedAgreement = {
    ...agreements[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  agreements[index] = updatedAgreement
  localStorage.setItem("agreements", JSON.stringify(agreements))

  return updatedAgreement
}

// Delete an agreement
export const deleteAgreement = (id: string): boolean => {
  const agreements = getAgreements()
  const filteredAgreements = agreements.filter((agreement) => agreement.id !== id)

  if (filteredAgreements.length === agreements.length) {
    return false // No agreement was removed
  }

  localStorage.setItem("agreements", JSON.stringify(filteredAgreements))
  return true
}

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`
}
