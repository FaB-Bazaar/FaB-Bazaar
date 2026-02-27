// components/binder/ShareBinderButton.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Link, Clipboard, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSetName, getRarityName, getFoilingName } from "@/lib/fab-formatters";

interface ShareBinderButtonProps {
  binder: any;
  cards: any[]; 
}

export const ShareBinderButton: React.FC<ShareBinderButtonProps> = ({ binder, cards }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);

  if (!binder?.isPublic && !binder?.visibility?.level === 'public') {
    return null;
  }

  const handleCopy = (type: 'link' | 'text') => {
    let contentToCopy = '';

    if (type === 'link') {
      const binderUrl = `${window.location.origin}/binder/${binder._id}`;
      contentToCopy = binderUrl;
    } else {
      contentToCopy = cards.map(card => {
        const qty = card.quantity || 1;
        const name = card.printingDetails?.display_name || card.name;
        const set = getSetName(card.printingDetails?.set_id);
        const rarity = getRarityName(card.printingDetails?.rarity);
        const foiling = getFoilingName(card.printingDetails?.foiling);
        
        return `${qty}x ${name} (${set}, ${rarity}, ${foiling})`;
      }).join('\n');
    }

    navigator.clipboard.writeText(contentToCopy).then(() => {
      setCopied(type);
      toast({
        title: `Copied ${type === 'link' ? 'link' : 'list'} to clipboard!`,
      });
      setTimeout(() => setCopied(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Share Binder
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleCopy('link')}>
          {copied === 'link' ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Link className="mr-2 h-4 w-4" />
          )}
          <span>Copy Link</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleCopy('text')} disabled={cards.length === 0}>
          {copied === 'text' ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Clipboard className="mr-2 h-4 w-4" />
          )}
          <span>Copy as Text List</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};