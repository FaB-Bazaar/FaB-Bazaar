"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface KeyTakeawaysSectionEditorProps {
  section: {
    title?: string;
    items?: string; // Pipe-separated
  };
  onChange: (updates: Partial<{ title?: string; items?: string }>) => void;
}

export function KeyTakeawaysSectionEditor({ section, onChange }: KeyTakeawaysSectionEditorProps) {
  // Use local state for the items array to handle empty items during editing
  const [itemsArray, setItemsArray] = useState<string[]>(() => {
    return section.items?.split('|').filter(Boolean) || [];
  });

  // Sync local state when section.items changes from outside
  useEffect(() => {
    const externalItems = section.items?.split('|').filter(Boolean) || [];
    // Only update if the arrays are different (to avoid loops)
    if (JSON.stringify(externalItems) !== JSON.stringify(itemsArray.filter(Boolean))) {
      setItemsArray(externalItems);
    }
  }, [section.items]);

  const saveItems = (newArray: string[]) => {
    // Only save non-empty items to the parent
    onChange({ items: newArray.filter(Boolean).join('|') });
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...itemsArray];
    newItems[index] = value;
    setItemsArray(newItems);
    saveItems(newItems);
  };

  const addItem = () => {
    // Add empty item to local state (it will show in UI)
    setItemsArray([...itemsArray, '']);
  };

  const removeItem = (index: number) => {
    const newItems = itemsArray.filter((_, i) => i !== index);
    setItemsArray(newItems);
    saveItems(newItems);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === itemsArray.length - 1) return;

    const newItems = [...itemsArray];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
    updateItems(newItems);
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="takeawaysTitle" className="font-semibold">Title</Label>
        <Input
          id="takeawaysTitle"
          value={section.title || 'Key Takeaways'}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., TL;DR, Key Takeaways, Quick Summary"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="font-semibold">
          Takeaway Items <span className="text-muted-foreground text-sm font-normal">(3-5 recommended)</span>
        </Label>

        <div className="space-y-2 mt-2">
          {itemsArray.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              No takeaways added yet. Click "Add Takeaway" to start.
            </p>
          ) : (
            itemsArray.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                  >
                    <span className="text-xs">▲</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === itemsArray.length - 1}
                  >
                    <span className="text-xs">▼</span>
                  </Button>
                </div>
                <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
                <Input
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder={`Takeaway ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:text-destructive/80 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="mt-3"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Takeaway
        </Button>
      </div>
    </div>
  );
}
