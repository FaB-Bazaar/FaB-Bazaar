"use client";

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// The 'section' prop will have the shape of your FeaturedVideoSectionSchema
// The 'onChange' prop is a function to pass updated data back to the parent form
interface VideoSectionEditorProps {
  section: {
    videoId?: string;
    title?: string;
    description?: string;
    creatorName?: string;
    creatorUrl?: string;
  };
  onChange: (updates: Partial<typeof section>) => void;
}

export function VideoSectionEditor({ section, onChange }: VideoSectionEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="videoId">YouTube Video ID</Label>
        <Input
          id="videoId"
          value={section.videoId || ''}
          onChange={(e) => onChange({ videoId: e.target.value })}
          placeholder="e.g., dQw4w9WgXcQ"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Just the ID from the YouTube URL, not the full link.
        </p>
      </div>
      <div>
        <Label htmlFor="videoTitle">Video Title</Label>
        <Input
          id="videoTitle"
          value={section.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title to display above the video"
        />
      </div>
      <div>
        <Label htmlFor="videoDescription">Description</Label>
        <Textarea
          id="videoDescription"
          value={section.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="A short description of the video"
        />
      </div>
       <div>
        <Label htmlFor="creatorName">Creator's Name</Label>
        <Input
          id="creatorName"
          value={section.creatorName || ''}
          onChange={(e) => onChange({ creatorName: e.target.value })}
          placeholder="e.g., The Commander's Quarters"
        />
      </div>
      <div>
        <Label htmlFor="creatorUrl">Creator's URL</Label>
        <Input
          id="creatorUrl"
          type="url"
          value={section.creatorUrl || ''}
          onChange={(e) => onChange({ creatorUrl: e.target.value })}
          placeholder="https://www.youtube.com/@CommandersQuarters"
        />
      </div>
    </div>
  );
}