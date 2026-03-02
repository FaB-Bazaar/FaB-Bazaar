// lib/discord/discord-webhooks.ts

export interface BinderUpdateData {
  username: string;
  binderName: string;
  binderUrl: string;
  addedCount: number;
  updatedCount: number;
  valueAdded: number;
  notableCards: Array<{
    name: string;
    printingId: string;
    foiling?: string;
    rarity?: string;
    value: number;
    quantity: number;
  }>;
}

export interface WantsUpdateData {
  username: string;
  cardsAdded: Array<{
    name: string;
    printingId: string;
    foiling?: string;
    value: number;
    quantity: number;
    priority: string;
  }>;
  totalWantsCount: number;
  highPriorityCount: number;
  totalEstimatedValue: number;
  userId: string;
}

export class DiscordWebhooks {
  /**
   * Send Discord notification for binder updates
   */
  static async sendBinderUpdate(data: BinderUpdateData): Promise<boolean> {
    console.log('[Discord] ===== BINDER UPDATE WEBHOOK START =====');
    console.log('[Discord] Raw data received:', JSON.stringify(data, null, 2));

    const webhookUrl = process.env.DISCORD_WEBHOOK_BINDER_UPDATES;
    console.log('[Discord] Environment check:');
    console.log('[Discord]   - DISCORD_WEBHOOK_BINDER_UPDATES exists:', !!webhookUrl);
    
    if (!webhookUrl) {
      console.log('[Discord] ❌ No binder webhook URL configured, skipping notification');
      return false;
    }

    try {
      // Validate data structure
      if (!Array.isArray(data.notableCards)) {
        console.error('[Discord] ❌ ERROR: notableCards is not an array!', {
          type: typeof data.notableCards,
          value: data.notableCards
        });
        return false;
      }

      console.log('[Discord] Building Discord embed...');
      const embed = {
        title: `📦 Binder Updated`,
        description: `**${data.username}** updated their **${data.binderName}** collection`,
        fields: [
          {
            name: '📊 Changes',
            value: `${data.addedCount} added, ${data.updatedCount} updated`,
            inline: true
          },
          {
            name: '💰 Value Added',
            value: `$${data.valueAdded.toFixed(2)}`,
            inline: true
          },
          {
            name: '🔗 View Binder',
            value: `[Open Collection](${data.binderUrl})`,
            inline: true
          }
        ],
        color: 0x00ff00, // Green
        timestamp: new Date().toISOString()
      };

      console.log('[Discord] Base embed created:', JSON.stringify(embed, null, 2));

      // Add notable cards if any
      if (data.notableCards && data.notableCards.length > 0) {
        console.log('[Discord] Adding notable cards section...');
        console.log('[Discord] Notable cards data:', data.notableCards);
        
        const resolvedBaseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                          process.env.AUTH_URL ||
                          process.env.NEXTAUTH_URL ||
                          'http://localhost:3000';
        const notableCardsText = data.notableCards.slice(0, 5).map(card => {
          const baseUrl = resolvedBaseUrl;

          const cardUrl = `${baseUrl}/printing/${card.printingId}`;
          const foilingAbbr = this.getFoilingAbbreviation(card.foiling);
          const foilingText = foilingAbbr ? ` (${foilingAbbr})` : '';
          const quantityText = card.quantity > 1 ? ` x${card.quantity}` : '';
          const valueText = card.value > 0 ? ` - $${card.value.toFixed(2)}` : '';

          return `• [${card.name}](${cardUrl})${foilingText}${quantityText}${valueText}`;
        }).join('\n');
        
        embed.fields.push({
          name: '💎 Notable Additions',
          value: notableCardsText,
          inline: false
        });
        console.log('[Discord] Notable cards section added');
      } else {
        console.log('[Discord] No notable cards to add');
      }

      // Add footer
      embed.footer = {
        text: `Use /binder ${data.username} to view their collection`
      };

      console.log('[Discord] Final embed built:', JSON.stringify(embed, null, 2));

      const payload = {
        username: 'FaB Bazaar',
        avatar_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/881e1291-45e3-4c6c-a25c-b9fd7e33bb00/public',
        embeds: [embed]
      };

      console.log('[Discord] Final payload:', JSON.stringify(payload, null, 2));

      const result = await this.sendWebhook(webhookUrl, payload);
      console.log('[Discord] sendWebhook result:', result);
      console.log('[Discord] ===== BINDER UPDATE WEBHOOK END =====');
      
      return result;
    } catch (error) {
      console.error('[Discord] ❌ Error sending binder update webhook:', error);
      console.error('[Discord] Error stack:', error?.stack);
      console.log('[Discord] ===== BINDER UPDATE WEBHOOK END (ERROR) =====');
      return false;
    }
  }

  /**
   * Send Discord notification for wants list updates
   */
  static async sendWantsUpdate(data: WantsUpdateData): Promise<boolean> {
    console.log('[Discord] ===== WANTS UPDATE WEBHOOK START =====');
    console.log('[Discord] Raw wants data received:', JSON.stringify(data, null, 2));
    
    const webhookUrl = process.env.DISCORD_WEBHOOK_WANTS_UPDATES;
    console.log('[Discord] Wants webhook URL exists:', !!webhookUrl);
    
    if (!webhookUrl) {
      console.log('[Discord] ❌ No wants webhook URL configured, skipping notification');
      return false;
    }

    try {
      // Validate data structure
      if (!Array.isArray(data.cardsAdded)) {
        console.error('[Discord] ❌ ERROR: wants cardsAdded is not an array!', {
          type: typeof data.cardsAdded,
          value: data.cardsAdded
        });
        return false;
      }

      const embed = {
        title: `🎯 Wants List Updated`,
        description: `**${data.username}** updated their wants list`,
        fields: [
          {
            name: '📊 Cards Added',
            value: `${data.cardsAdded.length} want${data.cardsAdded.length !== 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: '🔥 High Priority',
            value: `${data.highPriorityCount} total`,
            inline: true
          },
          {
            name: '💰 Est. Total Value',
            value: `$${data.totalEstimatedValue.toFixed(2)}`,
            inline: true
          }
        ],
        color: 0x9b59b6, // Purple
        timestamp: new Date().toISOString()
      };

      console.log('[Discord] Wants embed built:', JSON.stringify(embed, null, 2));

      // Add the actual cards that were added
      if (data.cardsAdded && data.cardsAdded.length > 0 && data.cardsAdded.length <= 5) {
        console.log('[Discord] Adding wants cards section...');
        
        const wantsBaseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                          process.env.AUTH_URL ||
                          process.env.NEXTAUTH_URL ||
                          'http://localhost:3000';
        const wantsCardsText = data.cardsAdded.map(card => {
          const baseUrl = wantsBaseUrl;

          const cardUrl = `${baseUrl}/printing/${card.printingId}`;
          const foilingAbbr = this.getFoilingAbbreviation(card.foiling);
          const foilingText = foilingAbbr ? ` (${foilingAbbr})` : '';
          const quantityText = card.quantity > 1 ? ` x${card.quantity}` : '';
          const valueText = card.value > 0 ? ` - $${card.value.toFixed(2)}` : '';

          const formattedLine = `• [${card.name}](${cardUrl})${foilingText}${quantityText}${valueText}`;
          console.log('[Discord] Card link debug:', { name: card.name, printingId: card.printingId, cardUrl });
          console.log('[Discord] Formatted line:', formattedLine);
          return formattedLine;
        }).join('\n');
        
        embed.fields.push({
          name: '🆕 Cards Added to Wants',
          value: wantsCardsText,
          inline: false
        });
        console.log('[Discord] Wants cards section added');
      } else {
        console.log('[Discord] No wants cards to display or too many cards');
      }

      const payload = {
        username: 'FaB Bazaar',
        avatar_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/881e1291-45e3-4c6c-a25c-b9fd7e33bb00/public',
        embeds: [embed]
      };

      console.log('[Discord] Final wants webhook payload:', JSON.stringify(payload, null, 2));

      const result = await this.sendWebhook(webhookUrl, payload);
      console.log('[Discord] Wants webhook result:', result);
      console.log('[Discord] ===== WANTS UPDATE WEBHOOK END =====');
      
      return result;
    } catch (error) {
      console.error('[Discord] ❌ Error sending wants update webhook:', error);
      console.error('[Discord] Error stack:', error?.stack);
      console.log('[Discord] ===== WANTS UPDATE WEBHOOK END (ERROR) =====');
      return false;
    }
  }

  /**
   * Core webhook sending logic
   */
  static async sendWebhook(webhookUrl: string, payload: any): Promise<boolean> {
    console.log('[Discord] ===== SEND WEBHOOK START =====');
    console.log('[Discord] Webhook URL (first 50 chars):', webhookUrl.substring(0, 50) + '...');
    console.log('[Discord] Payload size:', JSON.stringify(payload).length, 'characters');
    
    try {
      console.log('[Discord] Making fetch request to Discord...');
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('[Discord] Response received:');
      console.log('[Discord]   - Status:', response.status);
      console.log('[Discord]   - Status Text:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error text');
        console.error('[Discord] ❌ Webhook failed:');
        console.error('[Discord]   - Status:', response.status);
        console.error('[Discord]   - Status Text:', response.statusText);
        console.error('[Discord]   - Error Body:', errorText);
        console.log('[Discord] ===== SEND WEBHOOK END (FAILED) =====');
        return false;
      }

      const responseText = await response.text().catch(() => '(no response body)');
      console.log('[Discord] ✅ Webhook sent successfully');
      console.log('[Discord] Response body:', responseText);
      console.log('[Discord] ===== SEND WEBHOOK END (SUCCESS) =====');
      return true;
    } catch (error: any) {
      console.error('[Discord] ❌ Webhook error:', error);
      console.error('[Discord] Error name:', error?.name);
      console.error('[Discord] Error message:', error?.message);
      console.error('[Discord] Error stack:', error?.stack);
      console.log('[Discord] ===== SEND WEBHOOK END (EXCEPTION) =====');
      return false;
    }
  }

  /**
   * Helper function to get priority emoji
   */
  private static getPriorityEmoji(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'high':
        return '🔥';
      case 'medium':
        return '⚡';
      case 'low':
        return '📝';
      default:
        return '📋';
    }
  }

  /**
   * Helper function to format foiling abbreviation
   */
  private static getFoilingAbbreviation(code?: string): string {
    if (!code) return '';
    const lookupCode = code.toLowerCase();
    const foilingAbbreviations: Record<string, string> = {
      s: 'NF',
      r: 'RF',
      c: 'CF',
      g: 'GF',
      n: 'NF',
    };
    return foilingAbbreviations[lookupCode] || code.toUpperCase();
  }
}