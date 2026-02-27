"use client";

import { useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateArticleStatus } from '@/app/actions/articleActions'; // Import the action

interface Props {
  articleId: string;
  currentStatus: 'draft' | 'published';
}

export function ArticleStatusToggle({ articleId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (isChecked: boolean) => {
    const newStatus = isChecked ? 'published' : 'draft';

    startTransition(async () => {
      const result = await updateArticleStatus(articleId, newStatus);

      if (result.success) {
        toast({
          title: "Status Updated",
          description: `Article has been set to ${newStatus}.`,
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
        id={`status-toggle-${articleId}`}
        checked={currentStatus === 'published'}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Toggle article status"
      />
      <Label htmlFor={`status-toggle-${articleId}`} className="text-sm font-medium text-muted-foreground">
        {isPending ? 'Updating...' : currentStatus === 'published' ? 'Published' : 'Draft'}
      </Label>
    </div>
  );
}