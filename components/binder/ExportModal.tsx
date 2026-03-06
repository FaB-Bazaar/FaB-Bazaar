import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileText, MessageSquare, Table, Code, Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { bindersClient } from '@/lib/client';

interface ExportModalProps {
  binderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  binderId,
  open,
  onOpenChange,
  isOwner = true
}) => {
  const [format, setFormat] = useState<'discord' | 'plaintext' | 'csv'>('plaintext');
  const [includePrice, setIncludePrice] = useState(true);
  const [priceField, setPriceField] = useState<'tcg_low' | 'tcg_market' | 'tcg_mid' | 'tcg_high'>('tcg_low');
  const [includeCondition, setIncludeCondition] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [isCopying, setIsCopying] = useState(false);
  const [isCopyingToClipboard, setIsCopyingToClipboard] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const handleExport = () => {
    const params = new URLSearchParams({
      format,
      includePrice: includePrice.toString(),
      priceField,
      includeCondition: includeCondition.toString(),
      includeNotes: includeNotes.toString(),
      sortBy
    });

    const exportUrl = `/api/binders/${binderId}/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
    onOpenChange(false);
  };

  const handleCopyToClipboard = async () => {
    setIsCopyingToClipboard(true);
    const params = new URLSearchParams({
      format,
      includePrice: includePrice.toString(),
      priceField,
      includeCondition: includeCondition.toString(),
      includeNotes: includeNotes.toString(),
      sortBy
    });
    try {
      const res = await fetch(`/api/binders/${binderId}/export?${params.toString()}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard!' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard.', variant: 'destructive' });
    } finally {
      setIsCopyingToClipboard(false);
    }
  };

  const handleCopyBinder = async () => {
    setIsCopying(true);

    const result = await bindersClient.copyBinder(binderId, 'Copy', {});

    setIsCopying(false);

    if (result.success) {
      toast({
        title: 'Binder copied successfully!',
        description: 'Your personal copy is ready.',
      });

      onOpenChange(false);

      // Navigate to the new binder
      router.push(`/binder/${result.data._id}`);
    } else {
      console.error('Error copying binder:', result.error);
      toast({
        title: 'Error',
        description: result.error || 'Failed to copy binder. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const formatOptions = [
    { value: 'plaintext', label: 'Plain Text', icon: FileText, description: 'Clean text format without formatting' },
    { value: 'discord', label: 'Discord', icon: MessageSquare, description: 'With bold formatting for Discord/chat' },
    { value: 'csv', label: 'CSV', icon: Table, description: 'Spreadsheet format with columns' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'tcg-low-desc', label: 'Price (High to Low)' },
    { value: 'tcg-low-asc', label: 'Price (Low to High)' },
    { value: 'tcg-market-desc', label: 'Market Price (High to Low)' },
    { value: 'tcg-market-asc', label: 'Market Price (Low to High)' },
    { value: 'quantity-desc', label: 'Quantity (High to Low)' },
    { value: 'quantity-asc', label: 'Quantity (Low to High)' },
    { value: 'default', label: 'Recently Added' }
  ];

  const priceFieldOptions = [
    { value: 'tcg_low', label: 'TCG Low' },
    { value: 'tcg_market', label: 'TCG Market' },
    { value: 'tcg_mid', label: 'TCG Mid' },
    { value: 'tcg_high', label: 'TCG High' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Card List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Copy Binder Option (only shown to non-owners) */}
          {!isOwner && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Make a Personal Copy
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Create a private copy of this binder in your collection. All cards will be set to not for trade.
                </p>
              </div>
              <Button
                onClick={handleCopyBinder}
                disabled={isCopying}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isCopying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy This Binder
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(value: any) => setFormat(value)}>
              {formatOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div key={option.value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <div className="flex items-center gap-2 flex-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor={option.value} className="font-medium cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Sort Options */}
          <div className="space-y-3">
            <Label htmlFor="sort-select" className="text-sm font-medium">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger id="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-price" 
                checked={includePrice} 
                onCheckedChange={setIncludePrice}
              />
              <Label htmlFor="include-price" className="text-sm font-medium cursor-pointer">
                Include Prices
              </Label>
            </div>

            {includePrice && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="price-field" className="text-sm">Price Source</Label>
                <Select value={priceField} onValueChange={(value: any) => setPriceField(value)}>
                  <SelectTrigger id="price-field" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priceFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Additional Information</Label>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-condition" 
                  checked={includeCondition} 
                  onCheckedChange={setIncludeCondition}
                />
                <Label htmlFor="include-condition" className="text-sm cursor-pointer">
                  Include Card Condition (NM, LP, etc.)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-notes" 
                  checked={includeNotes} 
                  onCheckedChange={setIncludeNotes}
                />
                <Label htmlFor="include-notes" className="text-sm cursor-pointer">
                  Include Personal Notes
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-muted p-3 rounded-lg">
            <Label className="text-xs font-medium text-muted-foreground">Preview:</Label>
            <div className="mt-1 text-sm font-mono">
              {format === 'discord' && "3x **Command and Conquer** - $25.00 - WTR (Majestic, Rainbow Foil)"}
              {format === 'plaintext' && "3x Command and Conquer - $25.00 - WTR (Majestic, Rainbow Foil)"}
              {format === 'csv' && "Quantity,Name,Price,Set,Rarity,Foiling,Edition"}
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyToClipboard}
              disabled={isCopyingToClipboard || format === 'csv'}
              title={format === 'csv' ? 'Clipboard not available for CSV format' : undefined}
            >
              {isCopyingToClipboard ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copy to Clipboard
            </Button>
            <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export List
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};