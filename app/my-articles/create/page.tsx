// app/my-articles/create/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, X, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { articlesClient } from '@/lib/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Reuse all admin section editors
import { MdxEditor } from '@/components/MdxEditor';
import { CarouselSectionEditor } from '@/components/CarouselSectionEditor';
import { VideoSectionEditor } from '@/app/admin/articles/edit/[articleId]/VideoSectionEditor';
import { CreatorSpotlightEditor } from '@/app/admin/articles/edit/[articleId]/CreatorSpotlightEditor';
import { CalloutSectionEditor } from '@/app/admin/articles/edit/[articleId]/CalloutSectionEditor';
import { OpportunityCardSectionEditor } from '@/app/admin/articles/edit/[articleId]/OpportunityCardSectionEditor';
import { IntroSectionEditor } from '@/app/admin/articles/edit/[articleId]/IntroSectionEditor';
import { BylineSectionEditor } from '@/app/admin/articles/edit/[articleId]/BylineSectionEditor';
import { SectionHeaderEditor } from '@/app/admin/articles/edit/[articleId]/SectionHeaderEditor';
import { KeyTakeawaysSectionEditor } from '@/app/admin/articles/edit/[articleId]/KeyTakeawaysSectionEditor';
import { MatchReportSectionEditor } from '@/app/admin/articles/edit/[articleId]/MatchReportSectionEditor';
import { DecklistBlockEditor } from '@/app/admin/articles/edit/[articleId]/DecklistBlockEditor';
import { SpotlightCardSectionEditor } from '@/app/admin/articles/edit/[articleId]/SpotlightCardSectionEditor';

// Preview components
import { PreviewRenderer } from '@/app/admin/articles/edit/[articleId]/PreviewRenderer';
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';
import { HERO_INFO } from '@/lib/fab-constants';

// User-allowed sections in logical order
const USER_ALLOWED_SECTIONS = [
  { type: 'intro', label: 'Intro' },
  { type: 'byline', label: 'Byline' },
  { type: 'section-header', label: 'Section Header' },
  { type: 'text', label: 'Text / Markdown' },
  { type: 'spotlight-card', label: 'Spotlight Card' },
  { type: 'card-carousel', label: 'Card Carousel' },
  { type: 'decklist-block', label: 'Decklist Block' },
  { type: 'match-report', label: 'Match Report' },
  { type: 'key-takeaways', label: 'Key Takeaways' },
  { type: 'video', label: 'Video' },
];

const HERO_CLASSES = [
  'Guardian', 'Warrior', 'Brute', 'Ninja', 'Runeblade',
  'Wizard', 'Mechanologist', 'Ranger', 'Assassin',
  'Illusionist', 'Necromancer'
];

// Helper to capitalize hero names for display
const capitalizeHeroName = (name: string) => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const initialArticleState = {
  title: '',
  subtitle: '',
  contentType: 'strategy' as 'strategy' | 'hero' | 'tournament',
  status: 'draft' as 'draft' | 'published',
  image: '',
  heroClass: '',
  heroSlug: '',
  sections: [
    {
      type: 'text',
      content: '## Introduction\n\nStart writing your article here!'
    }
  ],
};

export default function CreateArticlePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [article, setArticle] = useState(initialArticleState);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverImageDialogOpen, setCoverImageDialogOpen] = useState(false);
  const [coverCardDetails, setCoverCardDetails] = useState<any>(null);

  // Fetch cover card details
  const fetchCoverCardDetails = async (printingId: string) => {
    try {
      const response = await fetch(`/api/search/core?printingId=${printingId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.printings?.[0]) {
          setCoverCardDetails(result.data.printings[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching cover card:', error);
    }
  };

  React.useEffect(() => {
    if (article.image) {
      const currentPrintingId = coverCardDetails?.printing_id || coverCardDetails?.unique_id;
      if (article.image !== currentPrintingId) {
        fetchCoverCardDetails(article.image);
      }
    } else {
      // Clear cover card details if no image is set
      setCoverCardDetails(null);
    }
  }, [article.image]);

  // Add section
  const addSection = (type: string) => {
    const newSection: any = { type };

    // Set defaults based on type
    if (type === 'text') newSection.content = '';
    if (type === 'card-carousel') newSection.cards = [];
    if (type === 'callout') {
      newSection.title = '';
      newSection.text = '';
    }

    setArticle(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  // Update section
  const updateSection = (index: number, updates: any) => {
    setArticle(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => i === index ? { ...s, ...updates } : s)
    }));
  };

  // Delete section
  const deleteSection = (index: number) => {
    setArticle(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  // Move section
  const moveSection = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === article.sections.length - 1)) {
      return;
    }

    const newSections = [...article.sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

    setArticle(prev => ({ ...prev, sections: newSections }));
  };

  // Save article
  const handleSave = async (status?: 'draft' | 'published') => {
    if (!article.title) {
      toast({
        title: 'Missing fields',
        description: 'Please provide a title',
        variant: 'destructive'
      });
      return;
    }

    if ((article.contentType === 'hero' || article.contentType === 'tournament') && !article.heroSlug) {
      toast({
        title: 'Hero required',
        description: `Please select a hero for your ${article.contentType === 'hero' ? 'Hero Guide' : 'Tournament Report'}.`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    try {
      const result = await articlesClient.createArticle({
        title: article.title,
        subtitle: article.subtitle,
        contentType: article.contentType,
        image: article.image,
        sections: article.sections,
        status: status || article.status,
        heroClass: article.heroClass,
        heroSlug: article.heroSlug,
      });

      if (result.success) {
        toast({
          title: 'Article created!',
          description: status === 'published' ? 'Your article is now live' : 'Article saved as draft',
        });
        router.push('/my-articles');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error creating article:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create article',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Render section editor
  const renderSectionEditor = (section: any, index: number) => {
    switch (section.type) {
      case 'text':
        return (
          <MdxEditor
            value={section.content || ''}
            onChange={(content) => updateSection(index, { content })}
          />
        );
      case 'card-carousel':
        return (
          <CarouselSectionEditor
            cards={section.cards || []}
            onChange={(cards) => updateSection(index, { cards })}
          />
        );
      case 'video':
        return (
          <VideoSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'creator-spotlight':
        return (
          <CreatorSpotlightEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
            disableImageUpload={true}
            userAvatar={user?.image}
          />
        );
      case 'callout':
        return (
          <CalloutSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'opportunity-card':
        return (
          <OpportunityCardSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'spotlight-card':
        return (
          <SpotlightCardSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'intro':
        return (
          <IntroSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'byline':
        return (
          <BylineSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'section-header':
        return (
          <SectionHeaderEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'key-takeaways':
        return (
          <KeyTakeawaysSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'match-report':
        return (
          <MatchReportSectionEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      case 'decklist-block':
        return (
          <DecklistBlockEditor
            section={section}
            onChange={(updates) => updateSection(index, updates)}
          />
        );
      default:
        return <p>Unknown section type: {section.type}</p>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/my-articles')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Articles
        </Button>
        <h1 className="text-3xl font-bold mb-2">Create New Article</h1>
        <p className="text-muted-foreground">
          Fill out the details below. The article will be created as a draft.
        </p>
      </div>

      {/* Cover Image Dialog */}
      <CardSearchDialog
        open={coverImageDialogOpen}
        onOpenChange={setCoverImageDialogOpen}
        onSelectCard={(data) => {
          setArticle(prev => ({ ...prev, image: data.printing?.printing_id || data.printing?.unique_id }));
          setCoverImageDialogOpen(false);
        }}
      />

      {/* Metadata Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Article Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={article.title}
              onChange={(e) => setArticle(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter article title"
            />
          </div>

          {/* Subtitle */}
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={article.subtitle}
              onChange={(e) => setArticle(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Optional subtitle"
            />
          </div>

          {/* Content Type */}
          <div>
            <Label htmlFor="contentType">Content Type *</Label>
            <Select
              value={article.contentType}
              onValueChange={(value: 'strategy' | 'hero' | 'tournament') =>
                setArticle(prev => ({ ...prev, contentType: value, heroClass: '', heroSlug: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strategy">Strategy</SelectItem>
                <SelectItem value="hero">Hero Guide</SelectItem>
                <SelectItem value="tournament">Tournament Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cover Image */}
          <div>
            <Label>Cover Image (Optional)</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCoverImageDialogOpen(true)}
              className="w-full mt-2"
            >
              {coverCardDetails ? (coverCardDetails.display_name || coverCardDetails.name || 'Unknown Card') : article.image ? 'Loading card...' : 'Select Cover Image'}
            </Button>
          </div>

          {/* Hero Class Selection */}
          <div>
            <Label htmlFor="heroClass">
              Hero Class {(article.contentType === 'hero' || article.contentType === 'tournament') ? '*' : '(Optional)'}
            </Label>
            <Select
              value={article.heroClass || '__none__'}
              onValueChange={(value) => setArticle((prev: any) => ({
                ...prev,
                heroClass: value === '__none__' ? '' : value,
                heroSlug: '' // Clear hero when class changes
              }))}
            >
              <SelectTrigger className="mt-1 bg-background">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {HERO_CLASSES.map(className => (
                  <SelectItem key={className} value={className.toLowerCase()}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hero Selection - Only show if class is selected */}
          {article.heroClass && (
            <div>
              <Label htmlFor="heroSlug">
                Hero {(article.contentType === 'hero' || article.contentType === 'tournament') ? '*' : '(Optional)'}
              </Label>
              <Select
                value={article.heroSlug || '__none__'}
                onValueChange={(value) => setArticle((prev: any) => ({ ...prev, heroSlug: value === '__none__' ? '' : value }))}
              >
                <SelectTrigger className="mt-1 bg-background">
                  <SelectValue placeholder="Select a hero" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__none__">None</SelectItem>
                  {Object.entries(HERO_INFO)
                    .filter(([_, info]) => info.classes.includes(article.heroClass))
                    .map(([heroName, _]) => (
                      <SelectItem key={heroName} value={heroName}>
                        {capitalizeHeroName(heroName)}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Article Sections</CardTitle>
          <CardDescription>Build your article with different content sections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {article.sections.map((section, index) => (
            <div key={index} className="border rounded-lg p-4">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium capitalize">{section.type}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === article.sections.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSection(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Section Editor */}
              {renderSectionEditor(section, index)}
            </div>
          ))}

          {/* Add Section Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {USER_ALLOWED_SECTIONS.map(section => (
                <DropdownMenuItem
                  key={section.type}
                  onClick={() => addSection(section.type)}
                >
                  {section.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={() => handleSave('draft')}
          disabled={saving}
          variant="outline"
          className="flex-1"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSave('published')}
          disabled={saving}
          className="flex-1"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
