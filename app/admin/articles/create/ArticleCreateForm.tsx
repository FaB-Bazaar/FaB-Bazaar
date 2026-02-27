// app/admin/articles/create/ArticleCreateForm.tsx
"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, X, ArrowLeft, Eye, ChevronUp, ChevronDown, Search } from 'lucide-react';
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

// --- REUSING ALL YOUR POWERFUL EDITOR COMPONENTS ---
import { MdxEditor } from '@/components/MdxEditor';
import { CarouselSectionEditor } from '@/components/CarouselSectionEditor';
import { VideoSectionEditor } from '../edit/[articleId]/VideoSectionEditor';
import { CreatorSpotlightEditor } from '../edit/[articleId]/CreatorSpotlightEditor';
import { CalloutSectionEditor } from '../edit/[articleId]/CalloutSectionEditor';
import { OpportunityCardSectionEditor } from '../edit/[articleId]/OpportunityCardSectionEditor';
import { IntroSectionEditor } from '../edit/[articleId]/IntroSectionEditor';
import { BylineSectionEditor } from '../edit/[articleId]/BylineSectionEditor';
import { SectionHeaderEditor } from '../edit/[articleId]/SectionHeaderEditor';
import { KeyTakeawaysSectionEditor } from '../edit/[articleId]/KeyTakeawaysSectionEditor';
import { MatchReportSectionEditor } from '../edit/[articleId]/MatchReportSectionEditor';
import { DecklistBlockEditor } from '../edit/[articleId]/DecklistBlockEditor';

// Import Preview Components (same as edit form)
import {
    PreviewCreatorSpotlight,
    PreviewSpotlightHeader,
    PreviewSpotlightLinks,
    PreviewSpotlightLink,
    PreviewFeaturedVideo,
    PreviewCardCarousel,
    PreviewHeroCard
  } from '../edit/[articleId]/PreviewComponents';
import Callout from '@/components/heroes/Callout'; // Import the front-end Callout for preview
import OpportunityCard from '@/components/heroes/OpportunityCard'; // Import OpportunityCard for preview
import { SpotlightCardSectionEditor } from '../edit/[articleId]/SpotlightCardSectionEditor';

// Import Card Search Dialog for cover image selection
import CardSearchDialog from '@/components/dialogs/cards/card-search-dialog';

// Import the client-side Preview Renderer
import { PreviewRenderer } from '../edit/[articleId]/PreviewRenderer';

// The server action to create the article
import { createArticle } from '@/app/actions/articleActions';

// Import hero data for class/hero selection
import { HERO_INFO } from '@/lib/fab-constants';

// Hero classes for the dropdown
const HERO_CLASSES = [
  'assassin',
  'brute',
  'guardian',
  'illusionist',
  'mechanologist',
  'necromancer',
  'ninja',
  'ranger',
  'runeblade',
  'warrior',
  'wizard',
] as const;

// Get heroes by class from HERO_INFO
function getHeroesByClass(heroClass: string): string[] {
  return Object.entries(HERO_INFO)
    .filter(([_, info]) => info.classes.includes(heroClass as any))
    .map(([name]) => name)
    .sort();
}

// Format hero name for display (title case)
function formatHeroName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format class name for display
function formatClassName(className: string): string {
  return className.charAt(0).toUpperCase() + className.slice(1);
}

// --- A more helpful starting template for new articles ---
const initialArticleState = {
  title: '',
  subtitle: '',
  slug: '',
  contentType: 'article' as 'hero' | 'article' | 'tournament',
  categories: [] as string[],
  status: 'draft',
  image: '',
  heroSlug: '',
  heroClass: '',
  sections: [
    { 
      type: 'text', 
      content: '## Introduction\n\nWelcome to your new article! Start by replacing this text with a compelling opening paragraph that grabs the reader\'s attention.' 
    },
    {
      type: 'callout',
      title: 'Pro Tip!',
      text: 'Use callout sections like this one to highlight important information, tips, or links for your readers.',
      linkHref: '',
      linkText: ''
    },
    {
      type: 'text',
      content: '## Main Content\n\nThis is where the body of your article will go. You can add as many sections as you need to structure your content effectively.'
    }
  ],
};

export function ArticleCreateForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const [article, setArticle] = useState(initialArticleState);
  const [showPreview, setShowPreview] = useState(false);

  // Cover image card search state
  const [coverImageDialogOpen, setCoverImageDialogOpen] = useState(false);
  const [coverCardDetails, setCoverCardDetails] = useState<any>(null);

  // Fetch cover card details when image (printingId) changes
  React.useEffect(() => {
    if (article.image && article.image !== coverCardDetails?.printing_id) {
      fetchCoverCardDetails(article.image);
    }
  }, [article.image]);

  const fetchCoverCardDetails = async (printingId: string) => {
    try {
      const response = await fetch(`/api/printings/search?printingIds=${printingId}&show=all`);
      const data = await response.json();
      if (data.success && data.data?.printings?.[0]) {
        setCoverCardDetails(data.data.printings[0]);
      }
    } catch (error) {
      console.error('Failed to fetch cover card details:', error);
    }
  };

  const handleCoverCardSelect = (selection: any) => {
    const { card, printing } = selection;
    const printingId = printing?.printing_id || printing?.unique_id;
    handleFieldChange('image', printingId);
    setCoverImageDialogOpen(false);
    if (printingId) {
      fetchCoverCardDetails(printingId);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    console.log(`[ArticleCreateForm] handleFieldChange: ${field} =`, value);
    setArticle((prev) => ({ ...prev, [field]: value }));
  };

  const handleSectionChange = (index: number, updates: Partial<any>) => {
    console.log(`[ArticleCreateForm] handleSectionChange: index=${index}`, updates);
    try {
      const newSections = [...article.sections];
      newSections[index] = { ...newSections[index], ...updates };
      setArticle((prev) => ({ ...prev, sections: newSections }));
    } catch (error) {
      console.error(`[ArticleCreateForm] Error in handleSectionChange:`, error);
    }
  };

  const addSection = (type: 'text' | 'card-carousel' | 'video' | 'creator-spotlight' | 'callout' | 'opportunity-card' | 'spotlight-card' | 'intro' | 'byline' | 'section-header' | 'key-takeaways' | 'match-report' | 'decklist-block', index?: number) => {
    console.log(`[ArticleCreateForm] addSection: type=${type}, index=${index}`);
    let newSection: any = { type };
    if (type === 'card-carousel') newSection.cards = [];
    if (type === 'video') {
        newSection.videoId = ""; newSection.title = ""; newSection.description = "";
        newSection.creatorName = ""; newSection.creatorUrl = "";
    }
    if (type === 'creator-spotlight') {
        newSection.imageUrl = ""; newSection.name = ""; newSection.description = "";
        newSection.links = [];
    }
    if (type === 'text') newSection.content = "";
    if (type === 'callout') {
        newSection.title = ""; newSection.text = "";
        newSection.linkHref = ""; newSection.linkText = "";
    }
    if (type === 'opportunity-card') {
        newSection.printingId = "";
        newSection.reason = "underpriced";
        newSection.confidence = "medium";
        newSection.priceChange = null;
        newSection.note = "";
    }
    if (type === 'spotlight-card') {
        newSection.printingId = "";
        newSection.title = "";
        newSection.commentary = "";
    }
    if (type === 'intro') {
        newSection.text = "";
        newSection.tags = "";
    }
    if (type === 'byline') {
        newSection.role = "By";
        newSection.name = "";
        newSection.link = "";
    }
    if (type === 'section-header') {
        newSection.title = "";
        newSection.subtitle = "";
        newSection.level = "2";
    }
    if (type === 'key-takeaways') {
        newSection.title = "Key Takeaways";
        newSection.items = "";
    }
    if (type === 'match-report') {
        newSection.round = "";
        newSection.opponent = "";
        newSection.hero = "";
        newSection.heroPrintingId = "";
        newSection.result = "";
        newSection.record = "";
        newSection.summary = "";
        newSection.sideboard = "";
        newSection.sideboardCards = [];
    }
    if (type === 'decklist-block') {
        newSection.title = "";
        newSection.deckId = ""; // NEW: deck public ID (preferred)
        newSection.sections = JSON.stringify([{ label: "Core", cards: [] }]);
        newSection.exportUrl = "";
        newSection.notes = "";
    }

    setArticle((prev) => {
      const newSections = [...prev.sections];
      if (index !== undefined) {
        newSections.splice(index, 0, newSection);
      } else {
        newSections.push(newSection);
      }
      return { ...prev, sections: newSections };
    });
  };

  const removeSection = (index: number) => {
    setArticle((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...article.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap sections
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

    setArticle((prev) => ({ ...prev, sections: newSections }));
  };

  const handleSubmit = async () => {
    console.log('[ArticleCreateForm] handleSubmit called');
    console.log('[ArticleCreateForm] Current article state:', JSON.stringify(article, null, 2));

    if (!article.title || !article.slug || !article.contentType) {
      console.log('[ArticleCreateForm] Validation failed - missing fields');
      toast({ title: "Missing Fields", description: "Title, Slug, and Content Type are required.", variant: "destructive" });
      return;
    }

    console.log('[ArticleCreateForm] Starting transition to create article...');
    startTransition(async () => {
      try {
        console.log('[ArticleCreateForm] Calling createArticle action...');
        const result = await createArticle(article);
        console.log('[ArticleCreateForm] createArticle result:', result);

        if (result.success) {
          toast({ title: "Success!", description: "Article has been created as a draft." });
          router.push(`/admin/articles`);
        } else {
          console.error('[ArticleCreateForm] createArticle returned error:', result.error);
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
      } catch (error) {
        console.error('[ArticleCreateForm] Exception in createArticle:', error);
        toast({ title: "Error", description: "An unexpected error occurred. Check console.", variant: "destructive" });
      }
    });
  };

  const AddSectionWidget = ({ insertIndex }: { insertIndex: number }) => (
    <div className="py-10 flex justify-center items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Add Section Here
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => addSection('intro', insertIndex)}>Intro / Lead</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('text', insertIndex)}>Text (MDX)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('section-header', insertIndex)}>Section Header</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('key-takeaways', insertIndex)}>Key Takeaways</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('byline', insertIndex)}>Byline / Attribution</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('match-report', insertIndex)}>Match Report</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('decklist-block', insertIndex)}>Decklist Block</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('callout', insertIndex)}>Callout</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('opportunity-card', insertIndex)}>Opportunity Card</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('spotlight-card', insertIndex)}>Spotlight Card</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('card-carousel', insertIndex)}>Card Carousel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('video', insertIndex)}>Video</DropdownMenuItem>
          <DropdownMenuItem onClick={() => addSection('creator-spotlight', insertIndex)}>Creator Spotlight</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      <Card>
        <CardHeader>
          <CardTitle>Article Metadata</CardTitle>
          <CardDescription>Start by filling out the core details of your new article.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={article.title} onChange={(e) => handleFieldChange('title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" value={article.subtitle} onChange={(e) => handleFieldChange('subtitle', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <Input id="slug" value={article.slug} onChange={(e) => handleFieldChange('slug', e.target.value.toLowerCase().trim())} />
          </div>
          <div>
            <Label htmlFor="contentType">Content Type</Label>
            <Select value={article.contentType} onValueChange={(value: 'hero' | 'article' | 'tournament') => handleFieldChange('contentType', value)}>
              <SelectTrigger id="contentType"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hero">Hero Guide</SelectItem>
                <SelectItem value="article">General Article</SelectItem>
                <SelectItem value="tournament">Tournament Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          <div className="pt-4 border-t space-y-3">
            <div>
              <Label className="font-semibold">Additional Categories</Label>
              <p className="text-sm text-muted-foreground">Tag this content with additional categories (optional)</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cat-tournament"
                  checked={article.categories?.includes('tournament')}
                  onCheckedChange={(checked) => {
                    const newCategories = checked
                      ? [...(article.categories || []), 'tournament']
                      : (article.categories || []).filter(c => c !== 'tournament');
                    handleFieldChange('categories', newCategories);
                  }}
                />
                <Label htmlFor="cat-tournament" className="font-normal cursor-pointer">
                  🏆 Tournament Report
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cat-strategy"
                  checked={article.categories?.includes('strategy')}
                  onCheckedChange={(checked) => {
                    const newCategories = checked
                      ? [...(article.categories || []), 'strategy']
                      : (article.categories || []).filter(c => c !== 'strategy');
                    handleFieldChange('categories', newCategories);
                  }}
                />
                <Label htmlFor="cat-strategy" className="font-normal cursor-pointer">
                  ⚔️ Strategy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cat-beginner"
                  checked={article.categories?.includes('beginner')}
                  onCheckedChange={(checked) => {
                    const newCategories = checked
                      ? [...(article.categories || []), 'beginner']
                      : (article.categories || []).filter(c => c !== 'beginner');
                    handleFieldChange('categories', newCategories);
                  }}
                />
                <Label htmlFor="cat-beginner" className="font-normal cursor-pointer">
                  🌱 Beginner-Friendly
                </Label>
              </div>
            </div>
          </div>

          {/* Cover Image (Card Selection) */}
          <div className="pt-4 border-t space-y-2">
            <Label className="font-semibold">Cover Image</Label>
            <div className="flex gap-4">
              <div className="flex-1">
                {article.image ? (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-background">
                    <div className="flex-1">
                      <p className="font-medium">{coverCardDetails?.name || coverCardDetails?.display_name || 'Loading...'}</p>
                      {coverCardDetails && (
                        <p className="text-sm text-muted-foreground font-mono">
                          {coverCardDetails.set?.toUpperCase()} {coverCardDetails.foiling !== 's' ? coverCardDetails.foiling?.toUpperCase() : ''} {coverCardDetails.edition !== 'n' ? coverCardDetails.edition : ''}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">ID: {article.image}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCoverImageDialogOpen(true)}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleFieldChange('image', '');
                          setCoverCardDetails(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCoverImageDialogOpen(true)}
                    className="w-full"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Select Cover Card
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a card to use as the article tile image
                </p>
              </div>
              {article.image && (
                <div className="w-24 h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                  <img
                    src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${article.image}/public`}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cover Image Search Dialog */}
          <CardSearchDialog
            open={coverImageDialogOpen}
            onOpenChange={setCoverImageDialogOpen}
            onSelectCard={handleCoverCardSelect}
          />

          {/* Hero Classification Fields - For Hero Guides and Tournament Reports */}
          {(article.contentType === 'hero' || article.contentType === 'tournament' || article.categories?.includes('tournament')) && (
            <div className="pt-4 border-t space-y-4">
              <Label className="text-sm font-medium text-muted-foreground">
                {article.contentType === 'hero' ? 'Hero Guide Classification (for filtering)' : 'Hero Classification (optional - for filtering tournament reports by hero)'}
              </Label>

              {/* Hero Class Selection */}
              <div className="space-y-2">
                <Label htmlFor="heroClass">Hero Class</Label>
                <Select
                  value={article.heroClass || ''}
                  onValueChange={(value) => {
                    handleFieldChange('heroClass', value);
                    // Clear hero selection when class changes
                    handleFieldChange('heroSlug', '');
                  }}
                >
                  <SelectTrigger id="heroClass">
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HERO_CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        {formatClassName(cls)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hero Selection (filtered by class) */}
              {article.heroClass && (
                <div className="space-y-2">
                  <Label htmlFor="heroSlug">Hero</Label>
                  <Select
                    value={article.heroSlug || ''}
                    onValueChange={(value) => handleFieldChange('heroSlug', value)}
                  >
                    <SelectTrigger id="heroSlug">
                      <SelectValue placeholder="Select a hero..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getHeroesByClass(article.heroClass).map((heroName) => (
                        <SelectItem key={heroName} value={heroName}>
                          {formatHeroName(heroName)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold pt-4 border-t">Content Sections</h2>
      
      <div className="space-y-0">
        {article.sections.map((section: any, index: number) => (
          <React.Fragment key={index}>
             <Card className="mt-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="capitalize">{section.type.replace('-', ' ')} Section</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0}
                    title="Move Up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === article.sections.length - 1}
                    title="Move Down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeSection(index)} title="Remove Section">
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {section.type === 'text' ? (
                  <MdxEditor value={section.content || ''} onChange={(newContent) => handleSectionChange(index, { content: newContent })} />
                ) : section.type === 'callout' ? (
                  <CalloutSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'opportunity-card' ? (
                  <OpportunityCardSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'spotlight-card' ? (
                  <SpotlightCardSectionEditor
                    section={section}
                    onChange={(updates) => handleSectionChange(index, updates)}
                  />
                ) : section.type === 'card-carousel' ? (
                  <CarouselSectionEditor cards={section.cards || []} onChange={(cards) => handleSectionChange(index, { cards })} />
                ) : section.type === 'video' ? (
                  <VideoSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'creator-spotlight' ? (
                  <CreatorSpotlightEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'intro' ? (
                  <IntroSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'byline' ? (
                  <BylineSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'section-header' ? (
                  <SectionHeaderEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'key-takeaways' ? (
                  <KeyTakeawaysSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'match-report' ? (
                  <MatchReportSectionEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : section.type === 'decklist-block' ? (
                  <DecklistBlockEditor section={section} onChange={(updates) => handleSectionChange(index, updates)} />
                ) : (
                  <div className="text-destructive font-mono p-4 bg-muted/30 rounded-md">
                    Error: Unknown section type '{section.type}'
                  </div>
                )}
              </CardContent>
            </Card>
            <AddSectionWidget insertIndex={index + 1} />
          </React.Fragment>
        ))}
      </div>
      
      <div className="flex justify-between items-center sticky bottom-0 py-4 bg-background/80 backdrop-blur-sm z-10 border-t">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Hide Preview' : 'Show Live Preview'}
          </Button>
        </div>
        <Button onClick={handleSubmit} disabled={isPending} size="lg">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Create Article
        </Button>
      </div>

      {/* --- Live Preview Section --- */}
      {showPreview && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Live Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-custom dark:prose-invert max-w-none rounded-lg border p-4">
              <h1>{article.title || 'Article Title'}</h1>
              {article.subtitle && <p className="lead">{article.subtitle}</p>}
              <hr />
              {article.sections.map((section: any, index: number) => {
                if (section.type === 'text') {
                  return <PreviewRenderer key={index} source={section.content || ''} />;
                }
                
                if (section.type === 'callout') {
                  return (
                    <Callout
                      key={index}
                      title={section.title || 'Callout Title'}
                      text={section.text || 'Enter some text for the callout.'}
                      linkHref={section.linkHref || '#'}
                      linkText={section.linkText || 'Button Text'}
                    />
                  );
                }

                if (section.type === 'opportunity-card') {
                  return (
                    <OpportunityCard
                      key={index}
                      printingId={section.printingId || ''}
                      reason={section.reason || 'underpriced'}
                      confidence={section.confidence || 'medium'}
                      priceChange={section.priceChange}
                      note={section.note || ''}
                    />
                  );
                }
                
                if (section.type === 'creator-spotlight') {
                  return (
                    <PreviewCreatorSpotlight key={index} imageUrl={section.imageUrl}>
                      <PreviewSpotlightHeader name={section.name || 'Creator Name'}>
                        {section.description || 'Creator description would appear here.'}
                      </PreviewSpotlightHeader>
                      <PreviewSpotlightLinks>
                        {section.links && section.links.map((link: any, linkIndex: number) => (
                          <PreviewSpotlightLink key={linkIndex} href={link.url} icon={link.icon}>
                            {link.label || 'Link'}
                          </PreviewSpotlightLink>
                        ))}
                      </PreviewSpotlightLinks>
                    </PreviewCreatorSpotlight>
                  );
                }
                
                if (section.type === 'video') {
                  return (
                    <PreviewFeaturedVideo 
                      key={index}
                      videoId={section.videoId}
                      title={section.title}
                      description={section.description}
                      creatorName={section.creatorName}
                      creatorUrl={section.creatorUrl}
                    />
                  );
                }
                
                if (section.type === 'card-carousel') {
                  return (
                    <PreviewCardCarousel key={index}>
                      {section.cards && section.cards.map((card: any, cardIndex: number) => (
                        <PreviewHeroCard key={cardIndex} printingId={card.printingId || card.id} />
                      ))}
                    </PreviewCardCarousel>
                  );
                }

                if (section.type === 'spotlight-card') {
                  return (
                    <div key={index} className="not-prose my-6">
                      <div className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 border-2 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="bg-amber-600 text-white px-2 py-1 rounded text-sm font-medium flex items-center gap-1">
                            ⭐ Card Spotlight
                          </div>
                        </div>
                        <div className="text-lg font-semibold">{section.title || 'Card Spotlight'}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Printing ID: {section.printingId || 'Not selected'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Preview: This will render the actual card display on the live page
                        </div>
                      </div>
                      {/* Render commentary below the card */}
                      {section.commentary && (
                        <div className="prose prose-sm dark:prose-invert max-w-none mt-4">
                          <PreviewRenderer source={section.commentary} />
                        </div>
                      )}
                    </div>
                  );
                }

                // New Web Components
                if (section.type === 'intro') {
                  return (
                    <fab-intro
                      key={index}
                      text={section.text || ''}
                      tags={section.tags || ''}
                    />
                  );
                }

                if (section.type === 'byline') {
                  return (
                    <fab-byline
                      key={index}
                      role={section.role || 'By'}
                      name={section.name || ''}
                      link={section.link || ''}
                    />
                  );
                }

                if (section.type === 'section-header') {
                  return (
                    <fab-section-header
                      key={index}
                      title={section.title || ''}
                      subtitle={section.subtitle || ''}
                      level={section.level || '2'}
                    />
                  );
                }

                if (section.type === 'key-takeaways') {
                  return (
                    <fab-key-takeaways
                      key={index}
                      title={section.title || 'Key Takeaways'}
                      items={section.items || ''}
                    />
                  );
                }

                if (section.type === 'match-report') {
                  const previewSideboardCards = section.sideboardCards?.length > 0
                    ? JSON.stringify(section.sideboardCards)
                    : '';
                  return (
                    <fab-match-report
                      key={index}
                      round={section.round || ''}
                      opponent={section.opponent || ''}
                      hero={section.hero || ''}
                      result={section.result || ''}
                      record={section.record || ''}
                      summary={section.summary || ''}
                      sideboard={section.sideboard || ''}
                      sideboard-cards={previewSideboardCards}
                    />
                  );
                }

                if (section.type === 'decklist-block') {
                  return (
                    <fab-decklist-block
                      key={index}
                      deck-id={section.deckId || ''}
                      title={section.title || ''}
                      sections={section.sections || '[]'}
                      export-url={section.exportUrl || ''}
                      notes={section.notes || ''}
                    />
                  );
                }

                return (
                  <div key={index} className="p-4 border-2 border-dashed rounded-lg my-4">
                    <strong>[{section.type} Preview]</strong>
                    <pre className="text-xs mt-2 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(section, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// TypeScript declarations for Web Components in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'fab-intro': any;
      'fab-byline': any;
      'fab-section-header': any;
      'fab-key-takeaways': any;
      'fab-match-report': any;
      'fab-decklist-block': any;
    }
  }
}
