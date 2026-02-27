"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SectionHeaderEditorProps {
  section: {
    title?: string;
    subtitle?: string;
    level?: string; // "2" or "3"
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function SectionHeaderEditor({ section, onChange }: SectionHeaderEditorProps) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div>
        <Label htmlFor="sectionHeaderTitle" className="font-semibold">Title</Label>
        <Input
          id="sectionHeaderTitle"
          value={section.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., The Core Engine"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="sectionHeaderSubtitle" className="font-semibold">
          Subtitle <span className="text-muted-foreground text-sm">(optional)</span>
        </Label>
        <Input
          id="sectionHeaderSubtitle"
          value={section.subtitle || ''}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="e.g., Essential cards that make the deck function"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="sectionHeaderLevel" className="font-semibold">Heading Level</Label>
        <Select
          value={section.level || '2'}
          onValueChange={(value) => onChange({ level: value })}
        >
          <SelectTrigger id="sectionHeaderLevel" className="mt-1">
            <SelectValue placeholder="Select heading level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">H2 (Main Section)</SelectItem>
            <SelectItem value="3">H3 (Subsection)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
