// components/deck/mobile/MobileDeckMenuSheet.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload,
  Settings,
  BarChart3,
  BookOpen,
  Share2,
  RefreshCw,
} from "lucide-react";

interface MobileDeckMenuSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  binders: any[];
  selectedBinderId: string;
  onBinderChange: (id: string) => void;
  onOpenSettings: () => void;
  onOpenBulkImport: () => void;
  onNavigateAnalysis: () => void;
  onNavigateCollection: () => void;
  onNavigateExport: () => void;
}

export default function MobileDeckMenuSheet({
  isOpen,
  onOpenChange,
  canEdit,
  binders,
  selectedBinderId,
  onBinderChange,
  onOpenSettings,
  onOpenBulkImport,
  onNavigateAnalysis,
  onNavigateCollection,
  onNavigateExport,
}: MobileDeckMenuSheetProps) {
  const handleAction = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Deck Options</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-3">
            {/* Binder selector */}
            {canEdit && binders.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Default Binder
                </label>
                <Select value={selectedBinderId} onValueChange={onBinderChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select binder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {binders.map((binder: any) => (
                      <SelectItem key={binder._id} value={binder._id}>
                        {binder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-1">
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleAction(onOpenBulkImport)}
                  >
                    <Upload className="h-4 w-4" />
                    Import Decklist
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11"
                    onClick={() => handleAction(onOpenSettings)}
                  >
                    <Settings className="h-4 w-4" />
                    Deck Settings
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11"
                onClick={() => handleAction(onNavigateAnalysis)}
              >
                <BarChart3 className="h-4 w-4" />
                Analysis
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11"
                onClick={() => handleAction(onNavigateCollection)}
              >
                <BookOpen className="h-4 w-4" />
                Collection Comparison
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11"
                onClick={() => handleAction(onNavigateExport)}
              >
                <Share2 className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
