// app/my-articles/create/page.tsx
// Quick-write flow: title + one markdown box. Creates a draft and drops the
// writer into the full editor (/my-articles/[publicId]) where sections,
// autosave and publish-time metadata live.
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, PenLine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { articlesClient } from '@/lib/client';
import { MdxEditor } from '@/components/MdxEditor';
import { ARTICLE_TEMPLATES, buildTemplateArticle, type ArticleTemplateKey } from '@/lib/articles/templates';

// Unsaved quick-write drafts survive refresh/accidental close via localStorage.
const DRAFT_STORAGE_KEY = 'fab-quickwrite-draft';

export default function CreateArticlePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState<ArticleTemplateKey>('blank');
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore an unsaved draft once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.title || draft.content) {
          setTitle(draft.title || '');
          setContent(draft.content || '');
          if (ARTICLE_TEMPLATES.some(t => t.key === draft.template)) {
            setTemplate(draft.template);
          }
          setRestored(true);
        }
      }
    } catch {
      // Corrupt draft — ignore and start fresh
    }
    hydrated.current = true;
  }, []);

  // Persist as the user types (skip until restore has run)
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (title || content) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ title, content, template }));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // Storage full/unavailable — quick-write still works without recovery
    }
  }, [title, content, template]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please give your article a title',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { contentType, sections } = buildTemplateArticle(template, content);
      const result = await articlesClient.createArticle({
        title: title.trim(),
        contentType,
        sections,
      });

      if (result.success) {
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {}
        toast({
          title: 'Draft created',
          description: 'Keep writing — your changes now save automatically.',
        });
        router.push(`/my-articles/${result.data.publicId}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error creating article:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create article',
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  if (authLoading) {
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
        <p className="text-muted-foreground">Sign in to write articles</p>
        <Button onClick={() => router.push('/auth/login')}>Sign In</Button>
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
        <h1 className="text-3xl font-bold mb-2">Write an Article</h1>
        <p className="text-muted-foreground">
          Just a title and your words. Cards, decklists and article details can be
          added later in the editor — everything saves as a draft until you publish.
        </p>
      </div>

      {restored && (
        <p className="mb-4 text-sm text-muted-foreground">
          Restored your unsaved draft from last time.
        </p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Write</CardTitle>
          <CardDescription>Markdown supported — headings, lists, links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Start from</Label>
            <div role="radiogroup" aria-label="Article template" className="grid gap-3 sm:grid-cols-3 mt-2">
              {ARTICLE_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={template === t.key}
                  onClick={() => setTemplate(t.key)}
                  className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    template === t.key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="block font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground mt-1">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Taking Enigma to a 5-1 finish at Road to Nationals"
            />
          </div>

          <div>
            <Label>Your article</Label>
            <div className="mt-2">
              <MdxEditor value={content} onChange={setContent} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleCreate} disabled={saving} className="w-full" size="lg">
        {saving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <PenLine className="h-4 w-4 mr-2" />
        )}
        Create Draft & Continue
      </Button>
    </div>
  );
}
