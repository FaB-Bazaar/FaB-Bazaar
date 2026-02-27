"use client";

import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface IntroSectionEditorProps {
  section: {
    text?: string;
    tags?: string; // Comma-separated
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function IntroSectionEditor({ section, onChange }: IntroSectionEditorProps) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="introText" className="font-semibold">
          Article Summary <span className="text-muted-foreground text-sm">(1-2 sentences)</span>
        </Label>
        <Textarea
          id="introText"
          value={section.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="This tournament report covers my journey to Top 8 at the Atlanta regional with Dromai..."
          className="mt-1"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="introTags" className="font-semibold">
          Tags <span className="text-muted-foreground text-sm">(comma-separated)</span>
        </Label>
        <Input
          id="introTags"
          value={section.tags || ''}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="CC,Tournament Report,Dromai,Regional"
          className="mt-1"
        />
      </div>
    </div>
  );
}
