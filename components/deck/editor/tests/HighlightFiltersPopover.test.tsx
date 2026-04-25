// components/deck/editor/tests/HighlightFiltersPopover.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HighlightFiltersPopover, { HighlightFilter } from '../HighlightFiltersPopover';

describe('HighlightFiltersPopover', () => {
  it('renders trigger button labeled "Highlight"', () => {
    render(
      <HighlightFiltersPopover activeFilters={[]} onRemoveFilter={vi.fn()} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    expect(screen.getByRole('button', { name: /highlight/i })).toBeInTheDocument();
  });

  it('shows active filter count badge when filters are present', () => {
    const filters: HighlightFilter[] = [
      { stat: 'pitch', value: 1 },
      { stat: 'cost', value: 3 },
    ];
    render(
      <HighlightFiltersPopover activeFilters={filters} onRemoveFilter={vi.fn()} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    expect(screen.getByLabelText(/2 active filter/i)).toBeInTheDocument();
  });

  it('does not show count badge when filters are empty', () => {
    render(
      <HighlightFiltersPopover activeFilters={[]} onRemoveFilter={vi.fn()} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    expect(screen.queryByLabelText(/active filter/i)).not.toBeInTheDocument();
  });

  it('renders a chip for each active filter with a remove button', () => {
    const filters: HighlightFilter[] = [
      { stat: 'pitch', value: 1 },
      { stat: 'power', value: 4 },
    ];
    render(
      <HighlightFiltersPopover activeFilters={filters} onRemoveFilter={vi.fn()} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    expect(screen.getByText(/pitch.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/power.*4/i)).toBeInTheDocument();
    // Each chip has its own remove button
    expect(screen.getAllByLabelText(/remove .* filter/i)).toHaveLength(2);
  });

  it('calls onRemoveFilter with the filter when chip × is clicked', () => {
    const onRemoveFilter = vi.fn();
    const filters: HighlightFilter[] = [{ stat: 'pitch', value: 1 }];
    render(
      <HighlightFiltersPopover activeFilters={filters} onRemoveFilter={onRemoveFilter} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    fireEvent.click(screen.getByLabelText(/remove .* filter/i));
    expect(onRemoveFilter).toHaveBeenCalledWith({ stat: 'pitch', value: 1 });
  });

  it('calls onClearAll when clear-all button is clicked', () => {
    const onClearAll = vi.fn();
    const filters: HighlightFilter[] = [
      { stat: 'pitch', value: 1 },
      { stat: 'cost', value: 3 },
    ];
    render(
      <HighlightFiltersPopover activeFilters={filters} onRemoveFilter={vi.fn()} onClearAll={onClearAll}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('trigger has focus ring and text-sm minimum', () => {
    render(
      <HighlightFiltersPopover activeFilters={[]} onRemoveFilter={vi.fn()} onClearAll={vi.fn()}>
        <div>grid</div>
      </HighlightFiltersPopover>
    );
    const trigger = screen.getByRole('button', { name: /highlight/i });
    expect(trigger).toHaveClass('focus-visible:ring-2');
    expect(trigger.className).toContain('text-sm');
    expect(trigger.className).not.toContain('text-xs');
    expect(trigger.className).not.toContain('text-[10px]');
  });
});
