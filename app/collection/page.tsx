// app/collection/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { generateUniqueBinderSlug } from "@/lib/utils";

// Existing components
import { CollectionTile } from "@/components/collection/CollectionTile"
import BulkTransferDialog from "@/components/collection/BulkTransferDialog"

// Import the enhanced dashboard
import { EnhancedCollectionDashboard } from "@/components/collection/EnhancedCollectionDashboard"

// Inline collection overview (simplified version of your previous component)
import { TrendingUp, Package, Coins, Star, Eye, EyeOff, Users } from "lucide-react"

// Types (keeping your existing interfaces)
export interface CollectionStats {
  totalQuantity: number;
  quantityForTrade: number;
  quantityNotForTrade: number;
  totalValues: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts: Record<string, number>;
  rarityCountsForTrade: Record<string, number>;
  rarityCountsNotForTrade: Record<string, number>;
  binderCount: number;
  publicBinderCount: number;
}

export interface CollectionOverview {
  userId: string;
  username: string;
  countryCode?: string;
  calculatedAt: string;
  collection: CollectionStats;
}

export interface BinderWithStats {
  _id: string;
  name: string;
  description?: string;
  tags?: string[];
  slug?: string;
  discordExternalId?: string;
  discordUsername?: string;
  isOnHand?: boolean;
  visibility?: any;
  isPublic?: boolean;
  totalQuantity?: number;
  quantityForTrade?: number;
  quantityNotForTrade?: number;
  totalValue?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  valueNotForTrade?: {
    tcg_market: number;
    tcg_low: number;
    tcg_mid: number;
    tcg_high: number;
  };
  rarityCounts?: Record<string, number>;
  rarityCountsForTrade?: Record<string, number>;
  rarityCountsNotForTrade?: Record<string, number>;
  total_value?: number;
  total_cards_with_pricing?: number;
  total_cards_without_pricing?: number;
  sampleCards?: Array<{
    _id: string;
    name: string;
    display_name: string;
    image_url?: string;
    printingId: string;
  }>;
}

import Link from "next/link"
import { bindersClient } from "@/lib/client"

// Simplified inline overview component
function SimpleCollectionOverview({ overview }: { overview: CollectionOverview | null }) {
  if (!overview) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-32"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-muted rounded w-16"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { collection } = overview;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Collection Overview
          </span>
          <Badge variant="secondary" className="text-xs">
            Updated {new Date(overview.calculatedAt).toLocaleDateString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {collection.totalQuantity.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Cards</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(collection.totalValues.tcg_market)}
            </div>
            <div className="text-sm text-muted-foreground">Total Value</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-accent-foreground">
              {collection.quantityForTrade.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">For Trade</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {collection.binderCount} ({collection.publicBinderCount} public)
            </div>
            <div className="text-sm text-muted-foreground">Binders</div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export default function CollectionPage() {
  const { user } = useAuth()
  const [binders, setBinders] = useState<BinderWithStats[]>([])
  const [collectionOverview, setCollectionOverview] = useState<CollectionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("manage") 
  
  // Form and edit state
  const [newBinderName, setNewBinderName] = useState("")
  const [newBinderTags, setNewBinderTags] = useState("")
  const [newBinderSlug, setNewBinderSlug] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nameTouched, setNameTouched] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState("")

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [binderToDelete, setBinderToDelete] = useState<any>(null);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [binderToArchive, setBinderToArchive] = useState<any>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [binderToTransfer, setBinderToTransfer] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true)

    const loadData = async () => {
      try {
        // Fetch collection overview (keep using fetch for now as there's no client service method)
        fetch('/api/collection?view=complete')
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setCollectionOverview(data.data);
            } else {
              console.warn('[Collection] Failed to load collection overview:', data.error);
            }
          })
          .catch(err => {
            console.warn('[Collection] Failed to load collection overview:', err);
          });

        // Fetch binders using client service
        const result = await bindersClient.getUserBinders({ includeStats: true });
        if (result.success) {
          setBinders(result.data.binders || []);
        } else {
          console.error('[Collection] Failed to load binders:', result.error);
          setError("Failed to load binders.");
        }
      } catch (err) {
        console.error('[Collection] Failed to load data:', err);
        setError("Failed to load binders.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user])

  useEffect(() => {
    if (!slugTouched && newBinderName.trim()) {
      const existingSlugs = binders.map(b => b.slug || b.discordExternalId).filter(Boolean);
      setNewBinderSlug(generateUniqueBinderSlug(newBinderName, existingSlugs));
    }
  }, [newBinderName, binders, slugTouched]);

  const validateSlug = (slug: string) => {
    if (!slug) return "Slug is required.";
    if (!/^[a-z0-9_-]{3,20}$/.test(slug)) return "Slug must be 3-20 chars, lowercase letters, numbers, dashes, or underscores.";
    if (binders.some(b => (b.slug || b.discordExternalId) === slug)) return "You already have a binder with this slug.";
    return null;
  };

  const handleCreateBinder = async (e: React.FormEvent, shouldRedirect = false) => {
    e.preventDefault();
    setNameTouched(true);
    setSlugTouched(true);
    if (!user || !newBinderName.trim()) return;
    const slugErrorCheck = validateSlug(newBinderSlug);
    if (slugErrorCheck) {
      setSlugError(slugErrorCheck);
      return;
    }

    setCreating(true);
    setSlugError(null);

    const result = await bindersClient.createBinder({
      name: newBinderName,
      slug: newBinderSlug,
      tags: newBinderTags.split(",").map(t => t.trim()).filter(Boolean),
    });

    if (result.success) {
      const binder = result.data;

      const newBinder: BinderWithStats = {
        ...binder,
        totalQuantity: 0,
        totalValue: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        rarityCounts: {},
        sampleCards: []
      };

      setBinders(prev => [...prev, newBinder]);

      if (shouldRedirect) {
        // Redirect to the newly created binder
        window.location.href = `/binder/${binder._id}`;
        return; // Don't reset form or show message since we're redirecting
      }

      setNewBinderName("");
      setNewBinderTags("");
      setNewBinderSlug("");
      setSlugTouched(false);
      setNameTouched(false);

      window.dispatchEvent(new CustomEvent('binderCreated'));
      setSuccessMessage(`Binder '${binder.name}' created!`);
      setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
    } else {
      setSlugError(result.error || "Failed to create binder.");
    }
    setCreating(false);
  };

  const handleSaveBinder = async (binder: any, name: string, description: string, tags: string, discordSlug: string, isOnHand: boolean, visibility: any) => {
  try {
    const result = await bindersClient.updateBinder(binder._id, {
      name,
      description,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      slug: discordSlug,
      isOnHand,
      visibility
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update binder');
    }

    setBinders(prev => prev.map(b =>
      b._id === binder._id
        ? { ...b, ...result.data, _id: b._id }
        : b
    ));

    setEditingId(null);
    setSlugError(null);
    setSuccessMessage(`Binder '${name}' updated successfully!`);
    setTimeout(() => setSuccessMessage(""), 3000);

  } catch (error) {
    console.error('[Collection] Failed to update binder:', error);

    if (error instanceof Error) {
      if (error.message.includes('slug')) {
        setSlugError(error.message);
      } else {
        setError(`Failed to update binder: ${error.message}`);
      }
    } else {
      setError('Failed to update binder');
    }
  }
};

  const handleDeleteBinder = async () => {
    if (!user || !binderToDelete) return;

    try {
      const result = await bindersClient.deleteBinder(binderToDelete._id);
      if (!result.success) throw new Error(result.error || "Failed to delete binder");

      setBinders(binders => binders.filter(b => b._id !== binderToDelete._id));
      window.dispatchEvent(new CustomEvent('binderDeleted'));

    } catch (err) {
      console.error('[Collection] Failed to delete binder:', err);
      setError("Failed to delete binder.");
    }
    setDeleteModalOpen(false);
    setBinderToDelete(null);
  };

  const handleTransferBinder = (binder: any) => {
    setBinderToTransfer(binder);
    setTransferModalOpen(true);
  };

  const handleTransferComplete = async () => {
    // Refresh binders list after transfer
    const result = await bindersClient.getUserBinders({ includeStats: true });
    if (result.success) {
      setBinders(result.data.binders || []);
    } else {
      console.error('[Collection] Failed to refresh binders:', result.error);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center text-muted-foreground bg-card rounded-lg mt-12 shadow">
        You must be logged in to view your collection.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-2 md:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">My Collection</h1>
        <Link href="/collection/all-cards">
          <Button variant="default" className="w-full sm:w-auto">
            <Package className="h-4 w-4 mr-2" />
            View All Cards
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive-foreground">{error}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="binders">My Binders</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="overview">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="binders">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <EnhancedCollectionDashboard
              binders={binders}
              overview={collectionOverview}
              onDeleteBinder={(binder) => {
                setBinderToDelete(binder);
                setDeleteModalOpen(true);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Binder</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBinder} className="space-y-4">
                {successMessage && (
                  <div className="text-green-600 text-sm">{successMessage}</div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      placeholder="Binder name"
                      value={newBinderName}
                      onChange={e => setNewBinderName(e.target.value)}
                      onBlur={() => setNameTouched(true)}
                      disabled={!user || creating}
                    />
                    {(nameTouched || creating) && !newBinderName.trim() && !successMessage && (
                      <div className="text-xs text-destructive mt-1">Name is required</div>
                    )}
                  </div>
                  
                  <div>
                    <Input
                      placeholder="Slug (e.g., deckbox1)"
                      value={newBinderSlug}
                      onChange={e => {
                        setNewBinderSlug(e.target.value);
                        setSlugTouched(true);
                        setSlugError(null);
                      }}
                      className="font-mono"
                      maxLength={20}
                      disabled={!user || creating}
                    />
                    {slugTouched && (!newBinderSlug.trim() || slugError) && (
                      <div className="text-xs text-destructive mt-1">
                        {slugError || "Slug is required"}
                      </div>
                    )}
                  </div>
                </div>
                
                <Input
                  placeholder="Tags (comma separated, optional)"
                  value={newBinderTags}
                  onChange={e => setNewBinderTags(e.target.value)}
                  disabled={!user || creating}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={creating || !newBinderName.trim() || !user}>
                    {creating ? "Creating..." : "Create Binder"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => handleCreateBinder(e, true)}
                    disabled={creating || !newBinderName.trim() || !user}
                  >
                    {creating ? "Creating..." : "Create & Open"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-4">Manage Existing Binders</h3>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : binders.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p>You have no binders yet.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={() => {}}>
                <SortableContext items={binders.map(b => b._id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {binders.map(binder => (
                      <div key={binder._id} className="h-full">
                        <CollectionTile
                          binder={binder}
                          binders={binders}
                          user={user}
                          isEditing={editingId === binder._id}
                          onStartEdit={() => setEditingId(binder._id)}
                          onSave={handleSaveBinder}
                          onCancelEdit={() => setEditingId(null)}
                          onDelete={(binder) => {
                            setBinderToDelete(binder);
                            setDeleteModalOpen(true);
                          }}
                          onTransfer={handleTransferBinder}
                          slugError={slugError}
                          onSlugChange={() => setSlugError(null)}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <SimpleCollectionOverview overview={collectionOverview} />
        </TabsContent>
      </Tabs>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogTitle>Delete Binder?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the binder and all associated cards.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteBinder}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkTransferDialog
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        sourceBinder={binderToTransfer}
        binders={binders}
        onTransferComplete={handleTransferComplete}
      />
    </div>
  );
}