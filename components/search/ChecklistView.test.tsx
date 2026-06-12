// components/search/ChecklistView.test.tsx

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChecklistView } from './ChecklistView';

const PRINTINGS = [
  {
    printing_id: 'p-en',
    name: 'Sink Below',
    display_name: 'Sink Below',
    set: 'wtr',
    collector_number: 'WTR215',
    color: 'red',
    edition: 'u',
    type_text: 'Defense Reaction',
    rarity: 'c',
    foiling: 's',
    language: 'en',
    tcg_low: 0.9,
  },
  {
    printing_id: 'p-fr',
    name: 'Sink Below',
    display_name: 'Sink Below',
    set: '1hp',
    collector_number: '1HP408',
    color: 'red',
    edition: 'n',
    type_text: 'Defense Reaction',
    rarity: 'c',
    foiling: 's',
    language: 'fr',
    tcg_low: null,
  },
];

describe('ChecklistView — language column', () => {
  it('renders a LANG column header', () => {
    render(<ChecklistView printings={PRINTINGS} />);
    expect(screen.getByText('LANG')).toBeInTheDocument();
  });

  it('shows each printing language as flag + code text (not flag alone)', () => {
    render(<ChecklistView printings={PRINTINGS} />);
    const rows = screen.getAllByRole('row').slice(1);

    expect(within(rows[0]).getByText(/EN/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/🇬🇧/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/FR/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/🇫🇷/)).toBeInTheDocument();
  });

  it('treats a missing language as English', () => {
    const noLang = [{ ...PRINTINGS[0], printing_id: 'p-x', language: undefined }];
    render(<ChecklistView printings={noLang} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText(/EN/)).toBeInTheDocument();
  });
});
