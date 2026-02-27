// components/deck/mobile/MobileDeckNameEditSheet.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface MobileDeckNameEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSave: (name: string) => Promise<void>;
}

export default function MobileDeckNameEditSheet({
  open,
  onOpenChange,
  currentName,
  onSave,
}: MobileDeckNameEditSheetProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Update local state when currentName changes
  useEffect(() => {
    if (open) {
      setName(currentName);
      setError("");
    }
  }, [open, currentName]);

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Deck name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSave(trimmedName);
      onOpenChange(false);
    } catch (err) {
      setError("Failed to save deck name");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(currentName);
    setError("");
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Edit Deck Name</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-4">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              maxLength={100}
              placeholder="Enter deck name"
              className={error ? "border-red-500" : ""}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {name.length}/100 characters
            </p>
          </div>

          <DrawerFooter className="flex flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || loading}
              className="flex-1"
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
