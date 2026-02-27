// components/browse/ImportActions.tsx
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UploadCloud, Heart, PlusCircle } from 'lucide-react';
// --- Import the new component ---
import BinderVisibilitySettings from './BinderVisibilitySettings';

// Simplified slug generator for the frontend
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // Remove invalid chars
    .replace(/[\s-]+/g, '-');      // Collapse whitespace and dashes
};

interface ImportActionsProps {
  isImporting: boolean;
  resultsCount: number;
  binders: any[];
  selectedBinderSlug: string;
  onSelectBinder: (slug: string) => void;
  // --- Update the handler's signature ---
  onCreateBinder: (name: string, slug: string, visibility: any) => Promise<void>;
  onAddToBinder: () => void;
  onAddToWants: () => void;
}

// Default visibility settings for a new binder
const defaultVisibility = {
  level: 'public',
  allowInSearch: true,
  allowInMatching: true,
  allowDiscordCommands: true,
  allowMcpFeatures: true,
  allowWebhooks: true,
};

export default function ImportActions({
  isImporting,
  resultsCount,
  binders,
  selectedBinderSlug,
  onSelectBinder,
  onCreateBinder,
  onAddToBinder,
  onAddToWants,
}: ImportActionsProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newBinderName, setNewBinderName] = useState("");
  const [newBinderSlug, setNewBinderSlug] = useState("");
  // --- Add state for visibility settings ---
  const [newBinderVisibility, setNewBinderVisibility] = useState(defaultVisibility);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewBinderName(name);
    setNewBinderSlug(generateSlug(name));
  };

  const handleCreateClick = async () => {
    if (!newBinderName || !newBinderSlug) return;
    // --- Pass the visibility state to the handler ---
    await onCreateBinder(newBinderName, newBinderSlug, newBinderVisibility);
    setIsCreateDialogOpen(false);
    // Reset state for next time
    setNewBinderName("");
    setNewBinderSlug("");
    setNewBinderVisibility(defaultVisibility);
  };

  if (resultsCount === 0) {
    return null;
  }

  return (
    <>
      <div className="sticky top-4 z-10 p-4 mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-semibold text-gray-900 dark:text-white text-center sm:text-left">
          Ready to import {resultsCount} card(s)?
        </span>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-stretch w-full sm:w-auto">
            <Select value={selectedBinderSlug} onValueChange={onSelectBinder}>
              <SelectTrigger className="flex-1 sm:w-[180px] rounded-r-none">
                <SelectValue placeholder="Select a binder..." />
              </SelectTrigger>
              <SelectContent>
                {binders.map(b => <SelectItem key={b._id} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-l-none border-l-0" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <Button onClick={onAddToWants} disabled={isImporting} variant="outline" className="flex-1">
              <Heart className="mr-2 h-4 w-4" />
              {isImporting ? 'Adding...' : 'To Wants'}
            </Button>
            <Button onClick={onAddToBinder} disabled={isImporting || !selectedBinderSlug} className="bg-blue-600 hover:bg-blue-700 flex-1">
              <UploadCloud className="mr-2 h-4 w-4" />
              {isImporting ? 'Importing...' : 'To Binder'}
            </Button>
          </div>
        </div>
      </div>

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
              <label htmlFor="binderName" className="text-sm font-medium">Binder Name</label>
              <Input id="binderName" value={newBinderName} onChange={handleNameChange} placeholder="e.g., Modern Staples" />
            </div>
            <div>
              <label htmlFor="binderSlug" className="text-sm font-medium">Binder Slug (URL & Bot Commands)</label>
              <Input id="binderSlug" value={newBinderSlug} onChange={e => setNewBinderSlug(e.target.value)} placeholder="e.g., modern-staples" />
              <p className="text-xs text-muted-foreground mt-1">
                Must be unique. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            {/* --- ADD THE VISIBILITY COMPONENT HERE --- */}
            <BinderVisibilitySettings
              visibility={newBinderVisibility}
              onVisibilityChange={setNewBinderVisibility}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateClick} disabled={!newBinderName || !newBinderSlug}>Create Binder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}