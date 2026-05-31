// lib/profile/group-binders-by-tag.test.ts
import { describe, it, expect } from 'vitest';
import { groupBindersByTag } from './group-binders-by-tag';

// minimal binder shape: id, tags, value (tcg_low), card count
const b = (id: string, tags: string[], value: number, cards = 1) => ({
  _id: id,
  tags,
  totalValue: { tcg_low: value },
  totalQuantity: cards,
});

describe('groupBindersByTag', () => {
  it('returns an empty array for no binders', () => {
    expect(groupBindersByTag([])).toEqual([]);
  });

  it('puts all untagged binders in a single trailing section with tag=null', () => {
    const sections = groupBindersByTag([b('1', [], 10), b('2', [], 20)]);
    expect(sections).toHaveLength(1);
    expect(sections[0].tag).toBeNull();
    expect(sections[0].binders.map(x => x._id)).toEqual(['2', '1']); // value desc
  });

  it('groups binders by tag', () => {
    const sections = groupBindersByTag([
      b('inv1', ['inventory'], 100),
      b('tr1', ['trades'], 50),
    ]);
    const tags = sections.map(s => s.tag);
    expect(tags).toContain('inventory');
    expect(tags).toContain('trades');
  });

  it('sorts binders within a group by value descending', () => {
    const sections = groupBindersByTag([
      b('low', ['inventory'], 10),
      b('high', ['inventory'], 900),
      b('mid', ['inventory'], 100),
    ]);
    expect(sections[0].binders.map(x => x._id)).toEqual(['high', 'mid', 'low']);
  });

  it('orders groups by total value descending', () => {
    const sections = groupBindersByTag([
      b('cheap', ['trades'], 5),
      b('rich', ['inventory'], 1000),
    ]);
    expect(sections[0].tag).toBe('inventory');
    expect(sections[1].tag).toBe('trades');
  });

  it('places a multi-tag binder in every matching group', () => {
    const sections = groupBindersByTag([b('x', ['inventory', 'foil'], 100)]);
    const tags = sections.map(s => s.tag).sort();
    expect(tags).toEqual(['foil', 'inventory']);
    expect(sections.every(s => s.binders[0]._id === 'x')).toBe(true);
  });

  it('keeps the untagged "More" section last when the set is mixed', () => {
    const sections = groupBindersByTag([
      b('u', [], 9999),                 // huge value, but untagged
      b('inv', ['inventory'], 1),
    ]);
    expect(sections[sections.length - 1].tag).toBeNull();
    expect(sections[0].tag).toBe('inventory');
  });

  it('omits the untagged section when every binder is tagged', () => {
    const sections = groupBindersByTag([b('inv', ['inventory'], 1)]);
    expect(sections.some(s => s.tag === null)).toBe(false);
  });

  it('aggregates totalValue and totalCards per section', () => {
    const sections = groupBindersByTag([
      b('a', ['inventory'], 100, 5),
      b('b', ['inventory'], 50, 3),
    ]);
    expect(sections[0].totalValue).toBe(150);
    expect(sections[0].totalCards).toBe(8);
  });

  it('treats blank-only tags as untagged', () => {
    const sections = groupBindersByTag([b('x', ['', '  '], 10)]);
    expect(sections).toHaveLength(1);
    expect(sections[0].tag).toBeNull();
  });
});
