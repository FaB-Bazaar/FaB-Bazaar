// app/my-articles/[publicId]/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, X, ArrowLeft, ChevronUp, ChevronDown, Eye, Trash2 } from 'lucide-react';
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

const CONTENT_TYPE_LABELS: Record<string, string> = {
  strategy: 'Strategy',
  hero: 'Hero Guide',
  tournament: 'Tournament Report',
};

const AUTOSAVE_DELAY_MS = 2000;

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Helper to capitalize hero names for display
const capitalizeHeroName = (name: string) => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function EditArticlePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const publicId = params.publicId as string;

  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [coverImageDialogOpen, setCoverImageDialogOpen] = useState(false);
  const [coverCardDetails, setCoverCardDetails] = useState<any>(null);
  const hasFetched = useRef(false);
  // Suppress the autosave effect when `article` is set from a server response
  // (initial fetch, manual save, publish toggle) rather than a user edit.
  const skipNextAutosave = useRef(true);
  const articleRef = useRef<any>(null);
  articleRef.current = article;

  // Fetch article — guard with ref so tab-focus session refreshes don't re-fetch and
  // overwrite unsaved edits (NextAuth re-creates the user object on window focus).
  useEffect(() => {
    if (user && publicId && !hasFetched.current) {
      hasFetched.current = true;
      fetchArticle();
    }
  }, [user, publicId]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const result = await articlesClient.getArticle(publicId);

      if (result.success) {
        skipNextAutosave.current = true;
        setArticle(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error fetching article:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load article',
        variant: 'destructive'
      });
      router.push('/my-articles');
    } finally {
      setLoading(false);
    }
  };

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
    if (article?.image) {
      const currentPrintingId = coverCardDetails?.printing_id || coverCardDetails?.unique_id;
      if (article.image !== currentPrintingId) {
        fetchCoverCardDetails(article.image);
      }
    } else {
      // Clear cover card details if no image is set
      setCoverCardDetails(null);
    }
  }, [article?.image]);

  // Autosave content edits (never status — publish/unpublish stays explicit).
  // Doesn't write the response back into state, so in-flight typing is never clobbered.
  const autosave = async () => {
    const current = articleRef.current;
    if (!current?.title?.trim()) return; // don't persist a titleless article

    setSaveState('saving');
    try {
      const result = await articlesClient.updateArticle(publicId, {
        title: current.title,
        subtitle: current.subtitle,
        contentType: current.contentType,
        image: current.image,
        sections: current.sections,
        heroClass: current.heroClass,
        heroSlug: current.heroSlug,
      });
      setSaveState(result.success ? 'saved' : 'error');
    } catch {
      setSaveState('error');
    }
  };

  useEffect(() => {
    if (!article) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    setSaveState('pending');
    const timer = setTimeout(autosave, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [article]);

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

    setArticle((prev: any) => ({
      ...prev,
      sections: [...(prev?.sections || []), newSection]
    }));
  };

  // Update section
  const updateSection = (index: number, updates: any) => {
    setArticle((prev: any) => ({
      ...prev,
      sections: prev.sections.map((s: any, i: number) => i === index ? { ...s, ...updates } : s)
    }));
  };

  // Delete section
  const deleteSection = (index: number) => {
    setArticle((prev: any) => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== index)
    }));
  };

  // Move section
  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!article) return;
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === article.sections.length - 1)) {
      return;
    }

    const newSections = [...article.sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

    setArticle((prev: any) => ({ ...prev, sections: newSections }));
  };

  // Save article
  const handleSave = async () => {
    if (!article?.title) {
      toast({
        title: 'Missing fields',
        description: 'Please provide a title',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    try {
      const result = await articlesClient.updateArticle(publicId, {
        title: article.title,
        subtitle: article.subtitle,
        status: article.status,
        contentType: article.contentType,
        image: article.image,
        sections: article.sections,
        heroClass: article.heroClass,
        heroSlug: article.heroSlug,
      });

      if (result.success) {
        toast({
          title: 'Article updated!',
          description: 'Your changes have been saved',
        });
        skipNextAutosave.current = true;
        setArticle(result.data);
        setSaveState('saved');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error updating article:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update article',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle status
  const toggleStatus = async () => {
    if (!article) return;

    const newStatus = article.status === 'draft' ? 'published' : 'draft';

    // Metadata is deferred until publish — enforce it here, not while drafting
    if (newStatus === 'published') {
      if ((article.contentType === 'hero' || article.contentType === 'tournament') && !article.heroSlug) {
        toast({
          title: 'Hero required',
          description: `Select a hero in Article Details before publishing a ${CONTENT_TYPE_LABELS[article.contentType] || article.contentType}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      // Persist current edits alongside the status change so publish
      // never races a pending autosave.
      const result = await articlesClient.updateArticle(publicId, {
        title: article.title,
        subtitle: article.subtitle,
        contentType: article.contentType,
        image: article.image,
        sections: article.sections,
        heroClass: article.heroClass,
        heroSlug: article.heroSlug,
        status: newStatus,
      });

      if (result.success) {
        skipNextAutosave.current = true;
        setArticle(result.data);
        setSaveState('saved');
        toast({
          title: `Article ${newStatus}`,
          description: newStatus === 'published' ? 'Your article is now live!' : 'Article moved to drafts',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete article
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) return;

    try {
      const result = await articlesClient.deleteArticle(publicId);

      if (result.success) {
        toast({
          title: 'Article deleted',
          description: 'Article has been removed successfully',
        });
        router.push('/my-articles');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete article',
        variant: 'destructive'
      });
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Render a prompt instead of redirecting: `user` populates one render after
  // authLoading clears (AuthContext race), and a render-time push lands on a
  // nonexistent /auth route.
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Sign in to edit your articles</p>
        <Button onClick={() => router.push('/auth/login')}>Sign In</Button>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Article not found</p>
      </div>
    );
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Edit Article</h1>
            <div className="flex items-center gap-2">
              <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                {article.status}
              </Badge>
              <Badge variant="outline">{CONTENT_TYPE_LABELS[article.contentType] || article.contentType}</Badge>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {saveState === 'pending' && 'Unsaved changes…'}
                {saveState === 'saving' && 'Saving…'}
                {saveState === 'saved' && 'All changes saved'}
                {saveState === 'error' && 'Autosave failed — use Save Changes'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {article.status === 'published' && (
              <Button
                variant="outline"
                onClick={() => window.open(`/articles/${publicId}`, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Live
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Cover Image Dialog */}
      <CardSearchDialog
        open={coverImageDialogOpen}
        onOpenChange={setCoverImageDialogOpen}
        onSelectCard={(data) => {
          setArticle((prev: any) => ({ ...prev, image: data.printing?.printing_id || data.printing?.unique_id }));
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
              onChange={(e) => setArticle((prev: any) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter article title"
            />
          </div>

          {/* Subtitle */}
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={article.subtitle || ''}
              onChange={(e) => setArticle((prev: any) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Optional subtitle"
            />
          </div>

          {/* Content Type — editable until you settle on what the piece is */}
          <div>
            <Label htmlFor="contentType">Content Type</Label>
            <Select
              value={article.contentType}
              onValueChange={(value) => setArticle((prev: any) => ({ ...prev, contentType: value }))}
            >
              <SelectTrigger className="mt-1 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Keep a legacy value (e.g. 'guide', 'article') selectable so existing articles don't break */}
                {!CONTENT_TYPE_LABELS[article.contentType] && (
                  <SelectItem value={article.contentType} className="capitalize">
                    {article.contentType}
                  </SelectItem>
                )}
                <SelectItem value="strategy">Strategy</SelectItem>
                <SelectItem value="hero">Hero Guide</SelectItem>
                <SelectItem value="tournament">Tournament Report</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Hero Guides and Tournament Reports need a hero selected before publishing.
            </p>
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
            <Label htmlFor="heroClass">Hero Class (Optional)</Label>
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
              <Label htmlFor="heroSlug">Hero (Optional)</Label>
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
          <CardDescription>Edit your article content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {article.sections?.map((section: any, index: number) => (
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
          onClick={toggleStatus}
          disabled={saving}
          variant="outline"
          className="flex-1"
        >
          {article.status === 'draft' ? 'Publish' : 'Unpublish'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
