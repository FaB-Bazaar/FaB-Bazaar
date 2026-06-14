// components/deck/editor/tests/DeckToolbarMoreMenu.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckToolbarMoreMenu from '../DeckToolbarMoreMenu';

describe('DeckToolbarMoreMenu', () => {
  const baseProps = {
    onCopyList: vi.fn(),
    onExport: vi.fn(),
    onAnalyze: vi.fn(),
    onPresent: vi.fn(),
    onSettings: vi.fn(),
    isOwner: true,
  };

  it('renders trigger button labeled "More"', () => {
    render(<DeckToolbarMoreMenu {...baseProps} />);
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('opens menu on trigger click and shows core items', async () => {
    const user = userEvent.setup();
    render(<DeckToolbarMoreMenu {...baseProps} />);
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /copy list/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /present/i })).toBeInTheDocument();
  });

  it('shows Settings only when isOwner is true', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeckToolbarMoreMenu {...baseProps} isOwner={true} />);
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /settings/i })).toBeInTheDocument();

    rerender(<DeckToolbarMoreMenu {...baseProps} isOwner={false} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /copy list/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('fires onCopyList when Copy list item clicked', async () => {
    const user = userEvent.setup();
    const onCopyList = vi.fn();
    render(<DeckToolbarMoreMenu {...baseProps} onCopyList={onCopyList} />);
    await user.click(screen.getByRole('button', { name: /more/i }));
    await user.click(await screen.findByRole('menuitem', { name: /copy list/i }));
    expect(onCopyList).toHaveBeenCalledTimes(1);
  });

  it('shows "Update to owned printings" only when both isOwner and onUpdateOwnedPrintings are provided', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const { rerender } = render(
      <DeckToolbarMoreMenu {...baseProps} isOwner={true} onUpdateOwnedPrintings={onUpdate} />
    );
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /update to owned printings/i })).toBeInTheDocument();

    // Hidden when not an owner
    rerender(<DeckToolbarMoreMenu {...baseProps} isOwner={false} onUpdateOwnedPrintings={onUpdate} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /^copy list$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /update to owned printings/i })).not.toBeInTheDocument();
  });

  it('fires onUpdateOwnedPrintings when the menu item is clicked', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<DeckToolbarMoreMenu {...baseProps} isOwner={true} onUpdateOwnedPrintings={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /more/i }));
    await user.click(await screen.findByRole('menuitem', { name: /update to owned printings/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows "Convert to language" only when isOwner and onConvertLanguage are provided', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();
    const { rerender } = render(
      <DeckToolbarMoreMenu {...baseProps} isOwner={true} onConvertLanguage={onConvert} />
    );
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /convert to language/i })).toBeInTheDocument();

    rerender(<DeckToolbarMoreMenu {...baseProps} isOwner={false} onConvertLanguage={onConvert} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: /^copy list$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /convert to language/i })).not.toBeInTheDocument();
  });

  it('fires onConvertLanguage when the menu item is clicked', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();
    render(<DeckToolbarMoreMenu {...baseProps} isOwner={true} onConvertLanguage={onConvert} />);
    await user.click(screen.getByRole('button', { name: /more/i }));
    await user.click(await screen.findByRole('menuitem', { name: /convert to language/i }));
    expect(onConvert).toHaveBeenCalledTimes(1);
  });

  it('trigger has focus ring and text-sm minimum', () => {
    render(<DeckToolbarMoreMenu {...baseProps} />);
    const trigger = screen.getByRole('button', { name: /more/i });
    expect(trigger).toHaveClass('focus-visible:ring-2');
    expect(trigger.className).toContain('text-sm');
    expect(trigger.className).not.toContain('text-xs');
    expect(trigger.className).not.toContain('text-[10px]');
  });
});
