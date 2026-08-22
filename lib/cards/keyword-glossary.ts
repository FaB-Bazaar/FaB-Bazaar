/**
 * Keyword glossary for the card-details lightbox: the keywords a card's rules
 * text names (bolded `**Keyword**` runs) or carries (`keywords[]`) that have
 * known reminder text, minus any the card already prints inline (a bold
 * keyword immediately followed by an italic `_(…)_` run).
 */

import { parseRulesText, type RulesSegment } from './rules-text';
import { lookupKeywordReminder, type KeywordReminder } from '@/lib/fab-constants/keyword-reminders';

function plainText(segs: RulesSegment[]): string {
  return segs
    .map((s) => (s.type === 'text' ? s.value : s.type === 'icon' ? '' : plainText(s.children)))
    .join('');
}

export function keywordGlossary(text: string, keywords: readonly string[] = []): KeywordReminder[] {
  const out: KeywordReminder[] = [];
  const seen = new Set<string>();
  const inline = new Set<string>();

  const add = (raw: string) => {
    const hit = lookupKeywordReminder(raw);
    if (!hit || seen.has(hit.key)) return;
    seen.add(hit.key);
    out.push(hit);
  };

  for (const para of parseRulesText(text || '')) {
    for (let i = 0; i < para.length; i++) {
      const seg = para[i];
      if (seg.type !== 'bold') continue;
      const hit = lookupKeywordReminder(plainText(seg.children));
      if (!hit) continue;
      // Reminder already printed inline? (`**Ward 10** _(…)_`, whitespace tolerated)
      let j = i + 1;
      while (j < para.length && para[j].type === 'text' && !(para[j] as { value: string }).value.trim()) j++;
      if (para[j]?.type === 'italic') inline.add(hit.key);
      add(hit.keyword);
    }
  }
  for (const k of keywords) add(k);

  return out.filter((e) => !inline.has(e.key));
}
