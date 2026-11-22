// Bridge B: /opt → Volzar handoff. The chat used to receive only the filter
// description; it now also carries the first result NAMES so "which of these
// fit my deck?" needs no tool call.

import { describe, it, expect } from 'vitest';
import { buildOptHandoff, summarizeHandoffResults, OPT_HANDOFF_RESULT_LIMIT } from './opt-handoff';

describe('summarizeHandoffResults', () => {
  it('lists distinct cards as "Name (pN, type)" in result order', () => {
    expect(summarizeHandoffResults([
      { display_name: 'Command and Conquer', pitch: 1, type_text_display: 'Generic Action - Attack' },
      { display_name: 'Art of War', pitch: 2, type_text_display: 'Generic Instant' },
      { display_name: 'Fyendal\'s Spring Tunic', pitch: null, type_text_display: 'Generic Equipment - Chest' },
    ])).toEqual([
      'Command and Conquer (p1, Generic Action - Attack)',
      'Art of War (p2, Generic Instant)',
      "Fyendal's Spring Tunic (Generic Equipment - Chest)",
    ]);
  });

  it('collapses several printings of the same card + pitch into one entry', () => {
    expect(summarizeHandoffResults([
      { display_name: 'Sink Below', pitch: 1 },
      { display_name: 'Sink Below', pitch: 1 },
      { display_name: 'Sink Below', pitch: 3 },
    ])).toEqual(['Sink Below (p1)', 'Sink Below (p3)']);
  });

  it('falls back to name and caps the list', () => {
    const many = Array.from({ length: OPT_HANDOFF_RESULT_LIMIT + 10 }, (_, i) => ({ name: `card ${i}` }));
    const out = summarizeHandoffResults(many);
    expect(out).toHaveLength(OPT_HANDOFF_RESULT_LIMIT);
    expect(out[0]).toBe('card 0');
  });
});

describe('buildOptHandoff', () => {
  it('is null unless the visit came from /opt', () => {
    expect(buildOptHandoff({})).toBeNull();
    expect(buildOptHandoff({ classes: 'ninja' })).toBeNull();
  });

  it('describes the search and shows it as a data card', () => {
    const h = buildOptHandoff({ from: 'opt', q: 'kodachi', total: '12' })!;
    expect(h.context).toHaveLength(1);
    expect(h.context[0]).toContain('query "kodachi"');
    expect(h.context[0]).toContain('(12 results)');
    expect(h.context[0]).toContain('/opt?');
    expect(h.data.title).toBe('Current /opt search');
    expect(h.data.lines).toContain('Query: "kodachi"');
    expect(h.data.lines).toContain('12 results');
    // The exact query string the results loader must run.
    expect(h.optQuery).toContain('q=kodachi');
    expect(h.optQuery).not.toContain('from=');
    expect(h.optQuery).not.toContain('total=');
  });

  it('ignores a non-numeric total', () => {
    const h = buildOptHandoff({ from: 'opt', q: 'x', total: 'abc' })!;
    expect(h.context[0]).not.toContain('results)');
  });

  it('with results: the context names the first cards and the card says how many Volzar sees', () => {
    const h = buildOptHandoff({ from: 'opt', q: 'kodachi', total: '40' }, ['Harmonized Kodachi', 'Mask of Momentum'])!;
    expect(h.context).toHaveLength(2);
    expect(h.context[1]).toContain('first 2 of 40');
    expect(h.context[1]).toContain('Harmonized Kodachi; Mask of Momentum');
    expect(h.data.lines).toContain('Volzar can see the first 2 results');
  });

  it('with results covering the whole search: says so instead of "first N"', () => {
    const h = buildOptHandoff({ from: 'opt', q: 'kodachi', total: '2' }, ['Harmonized Kodachi', 'Mask of Momentum'])!;
    expect(h.context[1]).toContain('all 2');
    expect(h.data.lines).toContain('Volzar can see all 2 results');
  });

  it('an empty result list adds nothing', () => {
    const h = buildOptHandoff({ from: 'opt', q: 'kodachi' }, [])!;
    expect(h.context).toHaveLength(1);
  });
});
