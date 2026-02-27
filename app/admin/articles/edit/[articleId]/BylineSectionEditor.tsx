"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BylineSectionEditorProps {
  section: {
    role?: string;
    name?: string;
    link?: string;
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function BylineSectionEditor({ section, onChange }: BylineSectionEditorProps) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="bylineRole" className="font-semibold">Role</Label>
        <Input
          id="bylineRole"
          value={section.role || ''}
          onChange={(e) => onChange({ role: e.target.value })}
          placeholder="e.g., Decklist by, Written by, Tournament Report by"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="bylineName" className="font-semibold">Name</Label>
        <Input
          id="bylineName"
          value={section.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Alex Chen"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="bylineLink" className="font-semibold">Link <span className="text-muted-foreground text-sm">(optional)</span></Label>
        <Input
          id="bylineLink"
          type="url"
          value={section.link || ''}
          onChange={(e) => onChange({ link: e.target.value })}
          placeholder="https://..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
