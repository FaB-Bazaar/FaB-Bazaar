import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuildProgressStrip from '../BuildProgressStrip';
import type { BuildProgress } from '@/lib/deck-builder/build-progress';

const mockProgress = (overrides: Partial<BuildProgress> = {}): BuildProgress => ({
  steps: {
    gear: { current: 3, target: 4, complete: false },
    attacks: { current: 6, target: 24, complete: false },
    defense: { current: 3, target: 15, complete: false },
    utility: { current: 2, target: 12, complete: false },
  },
  totalCards: { current: 11, target: 80 },
  overallComplete: false,
  ...overrides,
});

describe('BuildProgressStrip', () => {
  it('renders the deck name and total card count', () => {
    render(<BuildProgressStrip deckName="Salty Bones Brew" progress={mockProgress()} />);

    expect(screen.getByText(/Salty Bones Brew/i)).toBeInTheDocument();
    expect(screen.getByText(/11\s*\/\s*80/)).toBeInTheDocument();
  });

  it('renders all 4 step labels', () => {
    render(<BuildProgressStrip deckName="Test" progress={mockProgress()} />);

    expect(screen.getByRole('button', { name: /gear/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attacks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /defense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /utility/i })).toBeInTheDocument();
  });

  it('shows current/target counts inside each step', () => {
    render(<BuildProgressStrip deckName="Test" progress={mockProgress()} />);

    const gearStep = screen.getByRole('button', { name: /gear/i });
    expect(within(gearStep).getByText(/3\s*\/\s*4/)).toBeInTheDocument();

    const attacksStep = screen.getByRole('button', { name: /attacks/i });
    expect(within(attacksStep).getByText(/6\s*\/\s*24/)).toBeInTheDocument();
  });

  it('marks complete steps with data-complete=true', () => {
    const progress = mockProgress({
      steps: {
        gear: { current: 4, target: 4, complete: true },
        attacks: { current: 6, target: 24, complete: false },
        defense: { current: 3, target: 15, complete: false },
        utility: { current: 2, target: 12, complete: false },
      },
    });
    render(<BuildProgressStrip deckName="Test" progress={progress} />);

    expect(screen.getByRole('button', { name: /gear/i })).toHaveAttribute('data-complete', 'true');
    expect(screen.getByRole('button', { name: /attacks/i })).toHaveAttribute('data-complete', 'false');
  });

  it('calls onStepClick with the step key when a step is clicked', async () => {
    const onStepClick = vi.fn();
    render(<BuildProgressStrip deckName="Test" progress={mockProgress()} onStepClick={onStepClick} />);

    await userEvent.click(screen.getByRole('button', { name: /attacks/i }));

    expect(onStepClick).toHaveBeenCalledWith('attacks');
  });

  it('shows a "Tune your deck" cue when overallComplete is true', () => {
    const progress = mockProgress({
      steps: {
        gear: { current: 4, target: 4, complete: true },
        attacks: { current: 24, target: 24, complete: true },
        defense: { current: 15, target: 15, complete: true },
        utility: { current: 12, target: 12, complete: true },
      },
      totalCards: { current: 80, target: 80 },
      overallComplete: true,
    });
    render(<BuildProgressStrip deckName="Test" progress={progress} />);

    expect(screen.getByText(/tune/i)).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<BuildProgressStrip deckName="Test" progress={mockProgress()} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss|hide/i }));

    expect(onDismiss).toHaveBeenCalled();
  });
});
