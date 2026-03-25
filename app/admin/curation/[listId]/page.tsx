"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SearchableHeroSelect } from '@/components/deck/SearchableHeroSelect';
import { getHeroesGroupedByClass, getAllClasses } from '@/lib/fab-constants';
import QuickAddCardDialog from '@/components/deck/editor/QuickAddCardDialog';

const FORMATS = ['Classic Constructed', 'Silver Age', 'Blitz', 'Limited', 'Commoner', 'Living Legend'];

type Scope = 'general' | 'class' | 'hero';

interface CuratedListCard {
  id: string;
  printingId: string;
  sortOrder: number;
  displayName?: string;
  imageUrl?: string;
  setCode?: string;
  comment?: string | null;
}

interface CuratedList {
  id: string;
  name: string;
  description: string | null;
  heroName: string | null;
  className: string | null;
  format: string | null;
  tags: string[];
  isPublished: boolean;
  sortOrder: number;
  parentId: string | null;
  variantType: 'budget' | 'mid' | 'premium' | null;
  cards?: CuratedListCard[];
}

function deriveScope(list: CuratedList): Scope {
  if (list.heroName) return 'hero';
  if (list.className) return 'class';
  return 'general';
}

export default function CurationListEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const listId = params.listId as string;
  const isNew = listId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<Scope>('general');
  const [heroName, setHeroName] = useState('');
  const [className, setClassName] = useState('');
  const [format, setFormat] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [cards, setCards] = useState<CuratedListCard[]>([]);
  const [addingCard, setAddingCard] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);
  const [cardComments, setCardComments] = useState<Record<string, string>>({}); // cardName → comment
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const [assignedHeroNames, setAssignedHeroNames] = useState<string[] | null>(null); // null = no restriction (superadmin)
  const allHeroesUnfiltered = useMemo(() => getHeroesGroupedByClass(), []);
  const allClasses = useMemo(() => getAllClasses(), []);

  const allHeroes = useMemo(() => {
    if (!assignedHeroNames || assignedHeroNames.length === 0) return allHeroesUnfiltered;
    const lowerAssigned = new Set(assignedHeroNames.map(h => h.toLowerCase()));
    const filtered: Record<string, string[]> = {};
    for (const [cls, heroes] of Object.entries(allHeroesUnfiltered)) {
      const matching = heroes.filter(h => lowerAssigned.has(h.toLowerCase()));
      if (matching.length > 0) filtered[cls] = matching;
    }
    return filtered;
  }, [allHeroesUnfiltered, assignedHeroNames]);

  useEffect(() => {
    fetch('/api/curator-heroes/me')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setAssignedHeroNames(data.data.map((a: { heroName: string }) => a.heroName));
        }
        // If no assignments (superadmin), leave null — no restriction
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;

    fetch(`/api/curated-lists/${listId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const list: CuratedList = data.data;
          setName(list.name);
          setDescription(list.description ?? '');
          setScope(deriveScope(list));
          setHeroName(list.heroName ?? '');
          setClassName(list.className ?? '');
          setFormat(list.format ?? '');
          setTagsInput((list.tags ?? []).join(', '));
          setIsPublished(list.isPublished);
          const loadedCards = list.cards ?? [];
          setCards(loadedCards);
          // Seed comments map (one per unique card name, first non-null wins)
          const commentMap: Record<string, string> = {};
          for (const c of loadedCards) {
            if (c.displayName && c.comment && !commentMap[c.displayName]) {
              commentMap[c.displayName] = c.comment;
            }
          }
          setCardComments(commentMap);
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
      })
      .catch(() => toast({ title: 'Error', description: 'Failed to load list', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [listId, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name,
        description: description || null,
        heroName: scope === 'hero' ? (heroName || null) : null,
        className: scope === 'class' ? (className || null) : null,
        format: format || null,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        isPublished,
      };

      if (isNew) {
        const res = await fetch('/api/curated-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Created', description: 'Curated list created.' });
          router.replace(`/admin/curation/${data.data.id}`);
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
      } else {
        const res = await fetch(`/api/curated-lists/${listId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Saved', description: 'Changes saved.' });
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComment = async (cardName: string, comment: string) => {
    if (isNew) return;
    setSavingComment(cardName);
    try {
      await fetch(`/api/curated-lists/${listId}/cards/comment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardName, comment: comment || null }),
      });
    } finally {
      setSavingComment(null);
    }
  };

  const handleAddCard = async (printing: any, quantity: number) => {
    if (isNew) return;
    setAddingCard(true);
    try {
      const results = await Promise.all(
        Array.from({ length: quantity }, () =>
          fetch(`/api/curated-lists/${listId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printingId: printing.printing_id }),
          }).then(r => r.json())
        )
      );
      const newCards = results.filter(d => d.success).map(d => d.data);
      if (newCards.length > 0) setCards(prev => [...prev, ...newCards]);
      const failed = results.find(d => !d.success);
      if (failed) toast({ title: 'Error', description: failed.error, variant: 'destructive' });
    } finally {
      setAddingCard(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    setRemovingCardId(cardId);
    try {
      const res = await fetch(`/api/curated-lists/${listId}/cards/${cardId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCards(prev => prev.filter(c => c.id !== cardId));
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setRemovingCardId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/curation" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">{isNew ? 'New Curated List' : 'Edit Curated List'}</h1>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arakni Aggro Core" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
        </div>

        {/* Scope selector */}
        <div className="space-y-1.5">
          <Label>Scope</Label>
          <Select value={scope} onValueChange={v => setScope(v as Scope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General (all heroes)</SelectItem>
              <SelectItem value="class">Class</SelectItem>
              <SelectItem value="hero">Hero</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope === 'class' && (
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={className || '__none__'} onValueChange={v => setClassName(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a class</SelectItem>
                {allClasses.map(cls => (
                  <SelectItem key={cls} value={cls}>
                    {cls.charAt(0).toUpperCase() + cls.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scope === 'hero' && (
          <div className="space-y-1.5">
            <Label>Hero</Label>
            <SearchableHeroSelect
              heroes={allHeroes}
              format="Classic Constructed"
              value={heroName || undefined}
              onSelect={setHeroName}
              showGeneric
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={format || '__all__'}
              onValueChange={v => setFormat(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All formats</SelectItem>
                {FORMATS.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. aggro, stealth" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch id="isPublished" checked={isPublished} onCheckedChange={setIsPublished} />
          <Label htmlFor="isPublished">Published (visible to users)</Label>
        </div>

        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : isNew ? 'Create List' : 'Save Changes'}
        </Button>
      </div>

      {!isNew && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Cards ({cards.length})</h2>

          {/* Cards grouped by name with comment inputs */}
          {(() => {
            const groups: Array<{ name: string; cards: CuratedListCard[] }> = [];
            const seen = new Map<string, CuratedListCard[]>();
            for (const card of cards) {
              const key = card.displayName || card.printingId;
              if (!seen.has(key)) { seen.set(key, []); groups.push({ name: key, cards: seen.get(key)! }); }
              seen.get(key)!.push(card);
            }
            return (
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group.name} className="flex gap-4 items-start">
                    {/* Card tiles for this name */}
                    <div className="flex gap-2 flex-shrink-0">
                      {group.cards.map(card => (
                        <div key={card.id} className="relative flex-shrink-0 group" style={{ width: 72 }}>
                          <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '63/88' }}>
                            {card.imageUrl ? (
                              <img src={card.imageUrl} alt={card.displayName || card.printingId} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground text-center px-1 leading-tight">{card.displayName || card.printingId}</span>
                              </div>
                            )}
                            <button
                              onClick={() => handleRemoveCard(card.id)}
                              disabled={removingCardId === card.id}
                              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {removingCardId === card.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <X className="h-4 w-4 text-white" />}
                            </button>
                          </div>
                          {card.setCode && <p className="text-[9px] text-muted-foreground text-center uppercase mt-0.5 truncate">{card.setCode}</p>}
                        </div>
                      ))}
                    </div>
                    {/* Comment for this card name */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-xs font-medium text-foreground mb-1 truncate">{group.name} ×{group.cards.length}</p>
                      <Textarea
                        rows={2}
                        placeholder="Add a note for deck builders..."
                        className="text-xs resize-none"
                        value={cardComments[group.name] ?? ''}
                        onChange={e => setCardComments(prev => ({ ...prev, [group.name]: e.target.value }))}
                        onBlur={() => handleSaveComment(group.name, cardComments[group.name] ?? '')}
                      />
                      {savingComment === group.name && <p className="text-[10px] text-muted-foreground mt-0.5">Saving...</p>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setAddCardOpen(true)} disabled={addingCard}>
              {addingCard ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Card
            </Button>
          </div>

          {cards.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">No cards yet. Click + to add cards.</p>
          )}
        </div>
      )}

      <QuickAddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onAdd={handleAddCard}
        targetCategory="inventory"
        deckFormat={format || undefined}
        currentDeck={undefined}
      />
    </div>
  );
}
