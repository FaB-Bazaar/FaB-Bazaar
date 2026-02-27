// Client-side utilities for working with agreements

/**
 * Fetches all agreements with optional filters
 */
export async function getAgreements(options: {
  status?: "draft" | "pending" | "accepted" | "in-transit" | "delivered" | "completed" | "cancelled"
  page?: number
  limit?: number
}) {
  const { status, page = 1, limit = 10 } = options

  // Build query string
  const params = new URLSearchParams()
  if (status) params.append("status", status)
  params.append("page", page.toString())
  params.append("limit", limit.toString())

  const response = await fetch(`/api/agreements?${params.toString()}`)

  if (!response.ok) {
    throw new Error("Failed to fetch agreements")
  }

  return await response.json()
}

/**
 * Fetches a single agreement by ID
 */
export async function getAgreement(id: string) {
  const response = await fetch(`/api/agreements/${id}`)

  if (!response.ok) {
    throw new Error("Failed to fetch agreement")
  }

  return await response.json()
}

/**
 * Creates a new agreement
 */
export async function createAgreement(agreementData: {
  recipient: {
    userId?: string
    username: string
    discordId: string
    email?: string
    location?: {
      city?: string
      state?: string
      country?: string
    }
  }
  initiatorItems: Array<{
    id: string
    name: string
    description: string
    condition?: string
    value?: string
    quantity?: number
  }>
  recipientItems: Array<{
    id: string
    name: string
    description: string
    condition?: string
    value?: string
    quantity?: number
  }>
  additionalTerms?: string
  shippingDate?: string
  shippingMethod?: string
  tradeMethod: "shipping" | "in-person"
  listingId?: string
}) {
  // Process items to ensure they're in the expected format
  const processItems = (items: any[]) => {
    return items.map((item) => {
      // If quantity is present, include it in the name
      const displayName = item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name

      // Calculate the total value if quantity > 1
      const itemValue =
        item.value && item.quantity && item.quantity > 1
          ? (Number.parseFloat(item.value) * item.quantity).toString()
          : item.value

      return {
        id: item.id,
        name: displayName,
        description: item.description,
        condition: item.condition,
        value: itemValue,
      }
    })
  }

  // Create a modified payload with processed items
  const payload = {
    ...agreementData,
    initiatorItems: processItems(agreementData.initiatorItems),
    recipientItems: processItems(agreementData.recipientItems),
  }

  const response = await fetch("/api/agreements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create agreement")
  }

  return await response.json()
}

/**
 * Updates an existing agreement
 */
export async function updateAgreement(
  id: string,
  updates: {
    status?: "accepted" | "in-transit" | "delivered" | "completed" | "cancelled"
    trackingNumber?: string
    shippingMethod?: string
    shippingDate?: string
  },
) {
  const response = await fetch(`/api/agreements/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update agreement")
  }

  return await response.json()
}

/**
 * Adds a reference to an agreement
 */
export async function addReference(
  id: string,
  reference: {
    rating: number
    comment: string
  },
) {
  const response = await fetch(`/api/agreements/${id}/reference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reference),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to add reference")
  }

  return await response.json()
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
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
