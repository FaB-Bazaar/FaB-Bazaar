"use client";

import { useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { promoteArticle } from '@/app/actions/articleActions';

interface Props {
  articleId: string;
  promoted: boolean;
}

export function ArticlePromoteToggle({ articleId, promoted }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (isChecked: boolean) => {
    startTransition(async () => {
      const result = await promoteArticle(articleId, isChecked);

      if (result.success) {
        toast({
          title: isChecked ? "Article Promoted" : "Promotion Removed",
          description: isChecked
            ? "This article will now appear alongside curated content."
            : "Article moved back to community section.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`promote-toggle-${articleId}`}
        checked={promoted}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Toggle article promotion"
      />
      <Label htmlFor={`promote-toggle-${articleId}`} className="text-sm font-medium text-muted-foreground">
        {isPending ? 'Updating...' : promoted ? 'Promoted' : 'Community'}
      </Label>
    </div>
  );
}
