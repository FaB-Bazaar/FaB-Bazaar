"use client";

import { useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateArticleContentType } from '@/app/actions/articleActions';

interface Props {
  articleId: string;
  currentContentType: string;
}

export function ArticleContentTypeToggle({ articleId, currentContentType }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Only show toggle for hero <-> article types
  if (currentContentType !== 'hero' && currentContentType !== 'article') {
    return null;
  }

  const isHeroGuide = currentContentType === 'hero';

  const handleToggle = (isChecked: boolean) => {
    const newType = isChecked ? 'hero' : 'article';

    startTransition(async () => {
      const result = await updateArticleContentType(articleId, newType);

      if (result.success) {
        toast({
          title: "Content Type Updated",
          description: `Changed to ${newType === 'hero' ? 'Hero Guide' : 'Article'}.`,
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
        id={`type-toggle-${articleId}`}
        checked={isHeroGuide}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Toggle content type"
      />
      <Label htmlFor={`type-toggle-${articleId}`} className="text-xs text-muted-foreground">
        {isPending ? 'Updating...' : isHeroGuide ? 'Hero Guide' : 'Article'}
      </Label>
    </div>
  );
}
