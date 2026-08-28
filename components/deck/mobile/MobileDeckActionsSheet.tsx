// components/deck/mobile/MobileDeckActionsSheet.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Copy, Download, ImageDown, Eye, Tv, Settings, ArrowLeftRight, Languages, QrCode } from "lucide-react";

interface MobileDeckActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyList: () => void;
  onExport: () => void;
  onExportImage: () => void;
  onAnalyze: () => void;
  onPresent: () => void;
  onStickers: () => void;
  onSettings: () => void;
  /** Optional — owner-only: swap unowned printings to owned alternatives. */
  onUpdateOwnedPrintings?: () => void;
  /** Optional — owner-only: convert every deck card to a specific printing language. */
  onConvertLanguage?: () => void;
  isOwner: boolean;
}

/** Mobile counterpart of DeckToolbarMoreMenu — same action set, bottom-sheet form. */
export default function MobileDeckActionsSheet({
  open,
  onOpenChange,
  onCopyList,
  onExport,
  onExportImage,
  onAnalyze,
  onPresent,
  onStickers,
  onSettings,
  onUpdateOwnedPrintings,
  onConvertLanguage,
  isOwner,
}: MobileDeckActionsSheetProps) {
  const handleAction = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Deck actions</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onCopyList)}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy list
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onExport)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onExportImage)}
            >
              <ImageDown className="h-4 w-4" aria-hidden="true" />
              Export image
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onAnalyze)}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Analyze
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onPresent)}
            >
              <Tv className="h-4 w-4" aria-hidden="true" />
              Present
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-base"
              onClick={() => handleAction(onStickers)}
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              QR sticker sheet
            </Button>
            {isOwner && onUpdateOwnedPrintings && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-base"
                onClick={() => handleAction(onUpdateOwnedPrintings)}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Update to owned printings
              </Button>
            )}
            {isOwner && onConvertLanguage && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-base"
                onClick={() => handleAction(onConvertLanguage)}
              >
                <Languages className="h-4 w-4" aria-hidden="true" />
                Convert to language
              </Button>
            )}
            {isOwner && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-base"
                onClick={() => handleAction(onSettings)}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
