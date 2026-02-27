// components/binder/tests/EditCardDialog.test.tsx


import React from 'react'; 

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditCardDialog from '../EditCardDialog';

// Mock the formatters since they are tested separately
vi.mock('@/lib/fab-formatters', () => ({
  getSetName: (code: string) => ({ 'wtr': 'Welcome to Rathe' }[code] || code),
  getRarityName: (code: string) => ({ 'm': 'Majestic' }[code] || code),
  getFoilingName: (code: string) => ({ 's': 'Non-foil' }[code] || code),
}));

describe('EditCardDialog Component', () => {

  const mockCard = {
    _id: '68aeeb88230bae1364bf9a43',
    id: 'KH7cJBzRJHpgBJQGcp9FR',
    name: 'Bloodrush Bellow',
    quantity: 1,
    condition: 'NM',
    notes: 'A test note',
    forTrade: true,
    printingDetails: {
      set_id: 'wtr',
      rarity: 'm',
      foiling: 's',
    },
  };

  const mockOnOpenChange = vi.fn();
  const mockOnSave = vi.fn();

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the correct initial card details and form values', () => {
    render(
      <EditCardDialog 
        open={true} 
        card={mockCard} 
        onOpenChange={mockOnOpenChange} 
        onSave={mockOnSave} 
      />
    );
    expect(screen.getByText(/Set: Welcome to Rathe/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity')).toHaveValue(1);
    expect(screen.getByLabelText(/Notes/i)).toHaveValue('A test note');
    expect(screen.getByRole('switch', { name: /Available for Trade/i })).toBeChecked();
  });

  it('should call onSave with updated values when form is changed and saved', async () => {
    const user = userEvent.setup();
    render(
      <EditCardDialog 
        open={true} 
        card={mockCard} 
        onOpenChange={mockOnOpenChange} 
        onSave={mockOnSave} 
      />
    );

    // ARRANGE: Find all interactive elements
    const quantityInput = screen.getByLabelText('Quantity');
    const notesInput = screen.getByLabelText(/Notes/i);
    const forTradeSwitch = screen.getByRole('switch', { name: /Available for Trade/i });
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });

    // ACT: Simulate user input
    await act(async () => {
      // FIX for Quantity: Use `fireEvent.change` for number inputs to set value directly.
      fireEvent.change(quantityInput, { target: { value: '3' } });
      
      // `userEvent` is great for textareas.
      await user.clear(notesInput);
      await user.type(notesInput, 'Updated note');

      // FIX for Switch: `userEvent.click` is the most robust way to simulate a real click.
      await user.click(forTradeSwitch);
      
      // Click save to trigger submission
      await user.click(saveButton);
    });

    // ASSERT
    expect(mockOnSave).toHaveBeenCalledOnce();
    expect(mockOnSave).toHaveBeenCalledWith({
      quantity: 3,
      condition: 'NM', // This wasn't changed
      notes: 'Updated note',
      forTrade: false, // Initial was true, one click toggles it to false
    });
  });

  it('should close the dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditCardDialog 
        open={true} 
        card={mockCard} 
        onOpenChange={mockOnOpenChange} 
        onSave={mockOnSave} 
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});