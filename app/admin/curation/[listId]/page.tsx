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
import { getHeroesGroupedByClass } from '@/lib/fab-constants';
import QuickAddCardDialog from '@/components/deck/editor/QuickAddCardDialog';

const FORMATS = ['Classic Constructed', 'Silver Age', 'Blitz', 'Limited', 'Commoner', 'Living Legend'];

interface CuratedListCard {
  id: string;
  printingId: string;
  sortOrder: number;
  displayName?: string;
  imageUrl?: string;
  setCode?: string;
}

interface CuratedList {
  id: string;
  name: string;
  description: string | null;
  heroName: string | null;
  format: string | null;
  tags: string[];
  isPublished: boolean;
  sortOrder: number;
  parentId: string | null;
  variantType: 'budget' | 'mid' | 'premium' | null;
  cards?: CuratedListCard[];
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
  const [heroName, setHeroName] = useState('');
  const [format, setFormat] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [parentId, setParentId] = useState('');
  const [variantType, setVariantType] = useState<'budget' | 'mid' | 'premium' | ''>('');
  const [cards, setCards] = useState<CuratedListCard[]>([]);
  const [addingCard, setAddingCard] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);
  const [topLevelLists, setTopLevelLists] = useState<Array<{ id: string; name: string }>>([]);

  const allHeroes = useMemo(() => getHeroesGroupedByClass(), []);

  // Load top-level lists for parent selector
  useEffect(() => {
    fetch('/api/curated-lists')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const lists = (data.data ?? []).filter((l: any) => !l.parentId && l.id !== listId);
          setTopLevelLists(lists);
        }
      })
      .catch(() => {});
  }, [listId]);

  useEffect(() => {
    if (isNew) return;

    fetch(`/api/curated-lists/${listId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const list: CuratedList = data.data;
          setName(list.name);
          setDescription(list.description ?? '');
          setHeroName(list.heroName ?? '');
          setFormat(list.format ?? '');
          setTagsInput((list.tags ?? []).join(', '));
          setIsPublished(list.isPublished);
          setParentId(list.parentId ?? '');
          setVariantType(list.variantType ?? '');
          setCards(list.cards ?? []);
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
        heroName: heroName || null,
        format: format || null,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        isPublished,
        parentId: parentId || null,
        variantType: variantType || null,
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Group under (optional)</Label>
            <Select value={parentId || '__none__'} onValueChange={v => setParentId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No parent (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No parent (top-level)</SelectItem>
                {topLevelLists.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Variant</Label>
            <Select
              value={variantType || '__none__'}
              onValueChange={v => setVariantType(v === '__none__' ? '' : v as 'budget' | 'mid' | 'premium')}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground -mt-3">Top-level lists appear as buttons. Child lists appear as variants within a popover.</p>

        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. aggro, stealth, budget" />
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

          <div className="flex gap-2 overflow-x-auto pb-3">
            {cards.map(card => (
              <div
                key={card.id}
                className="relative flex-shrink-0 group"
                style={{ width: 80 }}
              >
                <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '63/88' }}>
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.displayName || card.printingId}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-[9px] text-muted-foreground text-center px-1 leading-tight">
                        {card.displayName || card.printingId}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    disabled={removingCardId === card.id}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {removingCardId === card.id ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <X className="h-5 w-5 text-white" />
                    )}
                  </button>
                </div>
                {card.setCode && (
                  <p className="text-[9px] text-muted-foreground text-center uppercase mt-0.5 truncate">{card.setCode}</p>
                )}
              </div>
            ))}

            {/* Add card tile */}
            <button
              onClick={() => setAddCardOpen(true)}
              disabled={addingCard}
              className="flex-shrink-0 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
              style={{ width: 80, aspectRatio: '63/88' }}
            >
              {addingCard ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </button>
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
      />
    </div>
  );
}
