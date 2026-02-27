"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { X, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Link {
  label?: string;
  url?: string;
  icon?: string;
}

interface CreatorSpotlightEditorProps {
  section: {
    imageUrl?: string;
    name?: string;
    description?: string;
    links?: Link[];
  };
  onChange?: (updates: Partial<typeof section>) => void;
  onUpdate?: (updates: Partial<typeof section>) => void;
  disableImageUpload?: boolean;
  userAvatar?: string;
}

export function CreatorSpotlightEditor({ section, onChange, onUpdate, disableImageUpload = false, userAvatar }: CreatorSpotlightEditorProps) {
  // Support both onChange and onUpdate for backward compatibility
  const handleChange = onChange || onUpdate || (() => {});
  const links = section.links || [];

  // When disableImageUpload is true and userAvatar is provided, automatically use it
  React.useEffect(() => {
    if (disableImageUpload && userAvatar && section.imageUrl !== userAvatar) {
      handleChange({ imageUrl: userAvatar });
    }
  }, [disableImageUpload, userAvatar]);

  const handleLinkChange = (index: number, field: keyof Link, value: string) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    handleChange({ links: newLinks });
  };

  const addLink = () => {
    const newLinks = [...links, { label: '', url: '', icon: '' }];
    handleChange({ links: newLinks });
  };

  const removeLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    handleChange({ links: newLinks });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="creatorName">Creator Name</Label>
        <Input
          id="creatorName"
          value={section.name || ''}
          onChange={(e) => handleChange({ name: e.target.value })}
          placeholder="Creator's display name"
        />
      </div>
      {!disableImageUpload ? (
        <div>
          <ImageUpload
            label="Creator Image"
            description="Upload a profile image or provide a URL"
            value={section.imageUrl || ''}
            onChange={(url) => handleChange({ imageUrl: url })}
          />
        </div>
      ) : (
        <div>
          <Label>Creator Image</Label>
          <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={userAvatar} alt="Your avatar" />
              <AvatarFallback>You</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Your Discord Avatar</p>
              <p className="text-xs text-muted-foreground">
                Your Discord profile picture will be used automatically
              </p>
            </div>
          </div>
        </div>
      )}
       <div>
        <Label htmlFor="creatorDescription">Description</Label>
        <Textarea
          id="creatorDescription"
          value={section.description || ''}
          onChange={(e) => handleChange({ description: e.target.value })}
          placeholder="A short bio or description of their content"
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-semibold">Creator Links</h4>
        {links.map((link, index) => (
          <div key={index} className="flex items-start gap-2 p-3 border rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-grow">
               <Input
                value={link.label || ''}
                onChange={(e) => handleLinkChange(index, 'label', e.target.value)}
                placeholder="Link Label (e.g., Twitter)"
              />
              <Input
                value={link.url || ''}
                onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
                placeholder="Full URL (https://...)"
              />
              <Input
                value={link.icon || ''}
                onChange={(e) => handleLinkChange(index, 'icon', e.target.value)}
                placeholder="Icon: decklist, patreon, discord, guide, metafy"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeLink(index)}
              title="Remove Link"
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addLink}>
          <Plus className="h-4 w-4 mr-2" />
          Add Link
        </Button>
      </div>
    </div>
  );
}