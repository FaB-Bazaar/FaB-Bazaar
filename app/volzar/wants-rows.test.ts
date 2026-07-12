/**
 * Wants table rows deliberately carry NO type/text: in the chat data card the
 * TYPE column wrapped character-by-character next to the workspace rail
 * ("Elem ental Actio n - Atta ck") and the row's job is qty/price/foil — full
 * card detail lives on hover (rail preview) and in Present. Removing the
 * fields at the source drops the column everywhere via CardTable's adaptive
 * columns.
 */

import { describe, it, expect } from 'vitest';
import { summarizeWantsCards } from './quick-actions';

const card = {
  display_name: 'Elemental Strike',
  quantity: 3,
  priority: 'medium',
  pitch: 1,
  collector_number: 'PEN205',
  foiling: 's',
  type_text_display: 'Elemental Action - Attack',
  card_text: 'As an additional cost to play this, exert an Elemental.',
  printingDetails: { tcg_low: 1.18 },
};

describe('summarizeWantsCards table rows', () => {
  it('omits type and rules text from every row', () => {
    const result = summarizeWantsCards([card as never]);
    expect(result.tableRows?.length).toBe(1);
    const row = result.tableRows![0];
    expect(row.name).toBe('Elemental Strike');
    expect(row.qty).toBe(3);
    expect(row.type).toBeUndefined();
    expect(row.text).toBeUndefined();
  });
});
