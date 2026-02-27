"use client";

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CalloutSectionEditorProps {
  section: {
    title?: string;
    text?: string;
    linkHref?: string;
    linkText?: string;
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function CalloutSectionEditor({ section, onChange }: CalloutSectionEditorProps) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="calloutTitle" className="font-semibold">Title</Label>
        <Input
          id="calloutTitle"
          value={section.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., New to Oscilio?"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="calloutText" className="font-semibold">Text</Label>
        <Textarea
          id="calloutText"
          value={section.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="This guide is for players with a basic understanding..."
          className="mt-1"
          rows={4}
        />
      </div>
       <div>
        <Label htmlFor="calloutLinkHref" className="font-semibold">Link URL (Optional)</Label>
        <Input
          id="calloutLinkHref"
          type="url"
          value={section.linkHref || ''}
          onChange={(e) => onChange({ linkHref: e.target.value })}
          placeholder="https://..."
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="calloutLinkText" className="font-semibold">Link Text (Optional)</Label>
        <Input
          id="calloutLinkText"
          value={section.linkText || ''}
          onChange={(e) => onChange({ linkText: e.target.value })}
          placeholder="e.g., View Beginner's Guide"
          className="mt-1"
        />
      </div>
    </div>
  );
}