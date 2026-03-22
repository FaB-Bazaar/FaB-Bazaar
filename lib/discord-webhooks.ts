// lib/discord-webhooks.ts
import { displayUsername } from '@/lib/utils/display-username';

export interface BinderUpdateData {
    username: string;
    cardsAdded: Array<{
      name: string;
      foiling?: string;
      value: number;
      quantity: number;
    }>;
    valueAdded: number;
    newTotalValue: number;
    notableCards: Array<{
      name: string;
      foiling?: string;
      value: number;
      quantity: number;
    }>;
    userId: string;
  }
  
  export interface WantsUpdateData {
    username: string;
    cardsAdded: Array<{
      name: string;
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
  
      const webhookUrl = process.env.DISCORD_WEBHOOK_BINDER_UPDATES;
      
      if (!webhookUrl) {
        return false;
      }
  
      try {
        // Validate data structure before building embed
        if (!Array.isArray(data.cardsAdded)) {
          console.error('[Discord] ❌ ERROR: cardsAdded is not an array!', {
            type: typeof data.cardsAdded,
            value: data.cardsAdded
          });
          return false;
        }
  
        const embed = {
          title: `📦 Binder Updated`,
          description: `**${displayUsername(data.username)}** updated their collection`,
          fields: [
            {
              name: '📊 Cards Added',
              value: `${data.cardsAdded.length} card${data.cardsAdded.length !== 1 ? 's' : ''}`,
              inline: true
            },
            {
              name: '💰 Value Added',
              value: `$${data.valueAdded.toFixed(2)}`,
              inline: true
            },
            {
              name: '📈 New Total Value',
              value: `$${data.newTotalValue.toFixed(2)}`,
              inline: true
            }
          ],
          color: 0x00ff00, // Green
          timestamp: new Date().toISOString()
        };
  
  
        // Add notable cards if any
        if (data.notableCards && data.notableCards.length > 0) {
          
          const notableCardsText = data.notableCards.slice(0, 5).map(card => {
            const cardText = `• ${card.name}${card.foiling ? ` (${card.foiling})` : ''} ${card.quantity > 1 ? `x${card.quantity}` : ''} - $${card.value.toFixed(2)}`;
            return cardText;
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
  
        // Add all cards if no notable cards and list is short
        if ((!data.notableCards || data.notableCards.length === 0) && data.cardsAdded.length <= 5) {
          
          const allCardsText = data.cardsAdded.map(card => {
            const cardText = `• ${card.name}${card.foiling ? ` (${card.foiling})` : ''} ${card.quantity > 1 ? `x${card.quantity}` : ''} - $${card.value.toFixed(2)}`;
            return cardText;
          }).join('\n');
          
          embed.fields.push({
            name: '📋 Cards Added',
            value: allCardsText,
            inline: false
          });
        } else {
        }
  
        // Add footer with binder link
        embed.footer = {
          text: `Use /binder ${data.username} to view their collection`
        };
  
  
        const payload = {
          username: 'FaB Bazaar',
          avatar_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/881e1291-45e3-4c6c-a25c-b9fd7e33bb00/public',
          embeds: [embed]
        };
  
  
        const result = await this.sendWebhook(webhookUrl, payload);

        
        return result;
      } catch (error) {
        console.error('[Discord] ❌ Error sending binder update webhook:', error);
        console.error('[Discord] Error stack:', error.stack);
        return false;
      }
    }
  
    /**
     * Send Discord notification for wants list updates
     */
    static async sendWantsUpdate(data: WantsUpdateData): Promise<boolean> {
      
      const webhookUrl = process.env.DISCORD_WEBHOOK_WANTS_UPDATES;
      
      if (!webhookUrl) {
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
          description: `**${displayUsername(data.username)}** updated their wants list`,
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
  


        // Add the actual cards that were added (similar to binder logic)
        if (data.cardsAdded && data.cardsAdded.length > 0 && data.cardsAdded.length <= 5) {

            
            const wantsCardsText = data.cardsAdded.map(card => {
            const priorityEmoji = this.getPriorityEmoji(card.priority);
            return `${priorityEmoji} ${card.name}${card.foiling ? ` (${card.foiling})` : ''} ${card.quantity > 1 ? `x${card.quantity}` : ''} - $${card.value.toFixed(2)}`;
            }).join('\n');
            
            embed.fields.push({
            name: '🆕 Cards Added to Wants',
            value: wantsCardsText,
            inline: false
            });

        } else {

        }
  
        const payload = {
          username: 'FaB Bazaar',
          avatar_url: 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/881e1291-45e3-4c6c-a25c-b9fd7e33bb00/public',
          embeds: [embed]
        };
  
        const result = await this.sendWebhook(webhookUrl, payload);
        
        return result;
      } catch (error) {
        console.error('[Discord] ❌ Error sending wants update webhook:', error);
        console.error('[Discord] Error stack:', error.stack);
        return false;
      }
    }
  
    /**
     * Core webhook sending logic
     */
    static async sendWebhook(webhookUrl: string, payload: any): Promise<boolean> {
      
      try {

        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
  

  
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Could not read error text');
          console.error('[Discord] ❌ Webhook failed:');
          console.error('[Discord]   - Status:', response.status);
          console.error('[Discord]   - Status Text:', response.statusText);
          console.error('[Discord]   - Error Body:', errorText);
          return false;
        }
  
        const responseText = await response.text().catch(() => '(no response body)');

        return true;
      } catch (error) {
        console.error('[Discord] ❌ Webhook error:', error);
        console.error('[Discord] Error name:', error.name);
        console.error('[Discord] Error message:', error.message);
        console.error('[Discord] Error stack:', error.stack);

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
  }
