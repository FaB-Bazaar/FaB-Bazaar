"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UploadCloud, Heart, PlusCircle, X } from 'lucide-react';
import BinderVisibilitySettings from '@/components/browse/BinderVisibilitySettings';

// Simplified slug generator
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-');
};

// Default visibility settings
const defaultVisibility = {
  level: 'public',
  allowInSearch: true,
  allowInMatching: true,
  allowDiscordCommands: true,
  allowMcpFeatures: true,
  allowWebhooks: true,
};

interface SearchActionBarProps {
  selectedCount: number;
  isImporting: boolean;
  binders: any[];
  selectedBinderSlug: string;
  onSelectBinder: (slug: string) => void;
  onCreateBinder: (name: string, slug: string, visibility: any) => Promise<void>;
  onAddToBinder: () => void;
  onAddToWants: () => void;
  onClearSelection: () => void;
}

export function SearchActionBar({
  selectedCount,
  isImporting,
  binders,
  selectedBinderSlug,
  onSelectBinder,
  onCreateBinder,
  onAddToBinder,
  onAddToWants,
  onClearSelection,
}: SearchActionBarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");
  const [newBinderSlug, setNewBinderSlug] = useState("");
  const [newBinderVisibility, setNewBinderVisibility] = useState(defaultVisibility);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewBinderName(name);
    setNewBinderSlug(generateSlug(name));
  };

  const handleCreateClick = async () => {
    if (!newBinderName || !newBinderSlug) return;
    await onCreateBinder(newBinderName, newBinderSlug, newBinderVisibility);
    setIsCreateDialogOpen(false);
    setNewBinderName("");
    setNewBinderSlug("");
    setNewBinderVisibility(defaultVisibility);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className="sticky top-[73px] z-10 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Selection count and clear button */}
            <div className="flex items-center gap-3">
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {/* Binder selector */}
              <div className="flex items-stretch w-full sm:w-auto">
                <Select value={selectedBinderSlug} onValueChange={onSelectBinder}>
                  <SelectTrigger className="flex-1 sm:w-[180px] rounded-r-none">
                    <SelectValue placeholder="Select a binder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {binders.map(b => (
                      <SelectItem key={b._id} value={b.slug}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="rounded-l-none border-l-0"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* Add to wants button */}
              <Button
                onClick={onAddToWants}
                disabled={isImporting}
                variant="outline"
                className="flex-1 sm:flex-initial gap-2"
              >
                <Heart className="h-4 w-4" />
                {isImporting ? 'Adding...' : 'To Wants'}
              </Button>

              {/* Add to binder button */}
              <Button
                onClick={onAddToBinder}
                disabled={isImporting || !selectedBinderSlug}
                className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-initial gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                {isImporting ? 'Importing...' : 'To Binder'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Binder Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Binder</DialogTitle>
            <DialogDescription>
              Create a new home for your cards. You can customize privacy settings below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="binderName" className="text-sm font-medium">
                Binder Name
              </label>
              <Input
                id="binderName"
                value={newBinderName}
                onChange={handleNameChange}
                placeholder="e.g., Modern Staples"
              />
            </div>
            <div>
              <label htmlFor="binderSlug" className="text-sm font-medium">
                Binder Slug (URL & Bot Commands)
              </label>
              <Input
                id="binderSlug"
                value={newBinderSlug}
                onChange={e => setNewBinderSlug(e.target.value)}
                placeholder="e.g., modern-staples"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be unique. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            <BinderVisibilitySettings
              visibility={newBinderVisibility}
              onVisibilityChange={setNewBinderVisibility}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClick} disabled={!newBinderName || !newBinderSlug}>
              Create Binder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
