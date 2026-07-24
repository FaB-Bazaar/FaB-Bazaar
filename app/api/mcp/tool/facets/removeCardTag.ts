// app/api/mcp/tool/facets/removeCardTag.ts
//
// remove_card_tag — removes a curator-assigned tag from a card. Inverse of
// assign_card_tag; same route (DELETE), same id contract, same scope semantics.
// It does NOT retract community votes — those belong to their voters.
import { callAssignRoute, CARD_TAG_SCOPES } from './assignCardTag';

export const removeCardTagTool = {
  name: 'remove_card_tag',
  description: `🏷️ UNTAG A CARD (curator/admin only): Remove a curator-assigned facet tag from a card.

Inverse of assign_card_tag — same IDs (cardUniqueId = card_unique_id, NOT a printing_id; tag = fab://facet-tags slug) and the same scope semantics ('name' = all same-name pitch variants, default; 'card' = this exact card only).

Only removes the CURATOR assignment. Community votes for the same tag are not touched — if the card keeps the tag after removal, enough community votes are holding it live.`,

  parameters: {
    type: 'object',
    properties: {
      cardUniqueId: {
        type: 'string',
        description: 'card_unique_id from a search_printings result row (21-char nanoid). NOT a printing_id.',
      },
      tag: {
        type: 'string',
        description: 'Tag id (kebab-case slug) currently assigned to the card.',
      },
      scope: {
        type: 'string',
        enum: [...CARD_TAG_SCOPES],
        description: "Optional. 'name' (default): all same-name pitch variants. 'card': only this exact card_unique_id.",
      },
    },
    required: ['cardUniqueId', 'tag'],
  },

  async handler(params: any, authenticatedUser?: any, token?: string) {
    return callAssignRoute('DELETE', params, authenticatedUser, token, 'untag');
  },
};
