'use client';

import { useState } from 'react';
import { Link, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  url?: string;
  className?: string;
}

export function ShareButton({ url, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    const target = url ?? window.location.href;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      toast({ title: 'Link copied', description: 'Share it anywhere!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
      aria-label="Copy link"
    >
      {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Link className="h-4 w-4 mr-1.5" />}
      {copied ? 'Copied!' : 'Share'}
    </Button>
  );
}
