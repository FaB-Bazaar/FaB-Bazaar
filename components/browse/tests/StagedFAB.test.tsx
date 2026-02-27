// components/browse/tests/StagedFAB.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StagedFAB from '../StagedFAB';

describe('StagedFAB Component', () => {
  it('should not render when count is 0', () => {
    const mockOnClick = vi.fn();
    const { container } = render(<StagedFAB count={0} onClick={mockOnClick} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when count is greater than 0', () => {
    const mockOnClick = vi.fn();
    render(<StagedFAB count={3} onClick={mockOnClick} />);

    // Check that the badge with count is visible
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should call onClick when button is clicked', () => {
    const mockOnClick = vi.fn();
    render(<StagedFAB count={5} onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should display correct count in badge', () => {
    const mockOnClick = vi.fn();
    render(<StagedFAB count={10} onClick={mockOnClick} />);

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should have mobile-only class (lg:hidden)', () => {
    const mockOnClick = vi.fn();
    const { container } = render(<StagedFAB count={1} onClick={mockOnClick} />);

    const button = container.querySelector('button');
    expect(button).toHaveClass('lg:hidden');
  });
});
