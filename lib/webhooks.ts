import type { WebhookPayload, ListingCreatedPayload, ListingUpdatedPayload } from "@/types/webhook"

/**
 * Main webhook trigger function - fires both Discord webhooks
 */
export async function triggerWebhook(
  event: string,
  data: ListingCreatedPayload | ListingUpdatedPayload,
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  console.log(`📡 Triggering webhook event: ${event}`)

  // Fire webhook to Server 1 Channel A
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await sendDiscordWebhook(process.env.DISCORD_WEBHOOK_URL, event, data, "Server 1")
      console.log("✅ Webhook sent to Server 1 successfully")
    } catch (error) {
      console.error("❌ Server 1 webhook failed:", error)
    }
  } else {
    console.warn("⚠️ DISCORD_WEBHOOK_URL not configured")
  }

  // Fire webhook to Server 2 Channel B
  if (process.env.DISCORD_WEBHOOK_MYSERVER_URL) {
    try {
      await sendDiscordWebhook(process.env.DISCORD_WEBHOOK_MYSERVER_URL, event, data, "Server 2")
      console.log("✅ Webhook sent to Server 2 successfully")
    } catch (error) {
      console.error("❌ Server 2 webhook failed:", error)
    }
  } else {
    console.warn("⚠️ DISCORD_WEBHOOK_MYSERVER_URL not configured")
  }
}

/**
 * Sends formatted Discord webhook message
 */
async function sendDiscordWebhook(
  webhookUrl: string,
  event: string,
  data: ListingCreatedPayload | ListingUpdatedPayload,
  serverName: string,
): Promise<void> {
  const cardsList = data.cards
    .slice(0, 5)
    .map((card) => {
      const price = card.price ? ` - $${card.price}` : ""
      const condition = card.condition ? ` (${card.condition})` : ""
      return `• **${card.name}** (${card.set}) - ${card.quantity}x ${card.foiling} ${card.rarity}${price}${condition}`
    })
    .join("\n")

  const moreCards = data.cards.length > 5 ? `\n... and **${data.cards.length - 5} more cards**` : ""

  // FIXED: Create clickable link to the SPECIFIC LISTING, not general trades page
  const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/listing/${data.listingId}`

  // Determine if this is an update or new listing
  const isUpdate = event === "listing.updated"
  const title = isUpdate
    ? `🔄 Updated ${data.type === "WTB" ? "Want to Buy" : "Want to Sell"} Listing`
    : `🆕 New ${data.type === "WTB" ? "Want to Buy" : "Want to Sell"} Listing`

  const embed = {
    title,
    description: `**${data.title}**${data.description ? `\n\n${data.description}` : ""}`,
    url: listingUrl, // This makes the title clickable and goes to the SPECIFIC listing
    color: data.type === "WTB" ? 0x3498db : 0xe74c3c, // Blue for WTB, Red for WTS
    fields: [
      {
        name: "👤 User",
        value: data.user.discordUsername ? `<@${data.user.discordUsername}>` : data.user.username,
        inline: true,
      },
      {
        name: "📋 Type",
        value: data.type === "WTB" ? "Want to Buy" : "Want to Sell",
        inline: true,
      },
      {
        name: "🃏 Cards",
        value: cardsList + moreCards,
        inline: false,
      },
      {
        name: "🔗 View Listing",
        value: `[Click here to view full listing](${listingUrl})`,
        inline: false,
      },
    ],
    timestamp: isUpdate ? (data as ListingUpdatedPayload).updatedAt?.toISOString() : data.createdAt.toISOString(),
    footer: {
      text: `FAB Bazaar • Listing ID: ${data.listingId}${isUpdate ? " • Updated" : ""}`,
    },
  }

  // Add update information if this is an update
  if (isUpdate && (data as ListingUpdatedPayload).changes) {
    embed.fields.splice(-1, 0, {
      name: "📝 Changes Made",
      value: (data as ListingUpdatedPayload).changes.join(", "),
      inline: false,
    })
  }

  const discordPayload = {
    embeds: [embed],
  }

  console.log(`📤 Sending webhook to ${serverName}...`)

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(discordPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Discord webhook failed for ${serverName}: ${response.status} ${response.statusText} - ${errorText}`,
    )
  }

  console.log(`✅ Discord webhook sent successfully to ${serverName}`)
}
