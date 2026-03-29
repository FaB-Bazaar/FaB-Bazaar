// app/collection/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { generateUniqueBinderSlug } from "@/lib/utils"
import { Package, Plus, ChevronDown, BarChart3, Coins, ArrowLeftRight } from "lucide-react"

import { CollectionTile } from "@/components/collection/CollectionTile"
import BulkTransferDialog from "@/components/collection/BulkTransferDialog"
import { CollectionHighlights } from "@/components/collection/EnhancedCollectionDashboard"
import { InlineCardSearch } from "@/components/collection/InlineCardSearch"

import { bindersClient } from "@/lib/client"

// Types
export interface CollectionStats {
  totalQuantity: number
  quantityForTrade: number
  quantityNotForTrade: number
  totalValues: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  valueForTrade: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  valueNotForTrade: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  rarityCounts: Record<string, number>
  rarityCountsForTrade: Record<string, number>
  rarityCountsNotForTrade: Record<string, number>
  binderCount: number
  publicBinderCount: number
}

export interface CollectionOverview {
  userId: string
  username: string
  countryCode?: string
  calculatedAt: string
  collection: CollectionStats
}

export interface BinderWithStats {
  _id: string
  name: string
  description?: string
  tags?: string[]
  slug?: string
  discordExternalId?: string
  discordUsername?: string
  isOnHand?: boolean
  visibility?: any
  isPublic?: boolean
  totalQuantity?: number
  quantityForTrade?: number
  quantityNotForTrade?: number
  totalValue?: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  valueForTrade?: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  valueNotForTrade?: {
    tcg_market: number
    tcg_low: number
    tcg_mid: number
    tcg_high: number
  }
  rarityCounts?: Record<string, number>
  rarityCountsForTrade?: Record<string, number>
  rarityCountsNotForTrade?: Record<string, number>
  total_value?: number
  total_cards_with_pricing?: number
  total_cards_without_pricing?: number
  sampleCards?: Array<{
    _id: string
    name: string
    display_name: string
    image_url?: string
    printingId: string
  }>
}

// Simple card for view mode
function BinderViewCard({ binder }: { binder: BinderWithStats }) {
  const totalValue = binder.totalValue?.tcg_low || binder.total_value || 0
  const formatValue = (v: number) =>
    v >= 1000
      ? '$' + (v / 1000).toFixed(1) + 'K'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v)

  return (
    <Link href={`/binder/${binder._id}`} className="block h-full">
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardContent className="p-4 flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-foreground">{binder.name}</h3>
              {(binder.slug || binder.discordExternalId) && (
                <Badge variant="secondary" className="text-xs mt-1 font-mono">
                  {binder.slug || binder.discordExternalId}
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Cards</div>
              <div className="font-semibold text-foreground">{(binder.totalQuantity || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Value</div>
              <div className="font-semibold text-green-600 dark:text-green-500">{formatValue(totalValue)}</div>
            </div>
          </div>
          {(binder.quantityForTrade || 0) > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-500 mt-2 flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              {binder.quantityForTrade} for trade
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default function CollectionPage() {
  const { user } = useAuth()
  const [binders, setBinders] = useState<BinderWithStats[]>([])
  const [collectionOverview, setCollectionOverview] = useState<CollectionOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Form state
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [binderToDelete, setBinderToDelete] = useState<any>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [binderToTransfer, setBinderToTransfer] = useState<any>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!user) return
    setLoading(true)

    const loadData = async () => {
      try {
        const overviewResult = await bindersClient.getCollectionOverview()
        if (overviewResult.success) {
          setCollectionOverview(overviewResult.data as CollectionOverview)
        } else {
          console.warn('[Collection] Failed to load collection overview:', overviewResult.error)
        }

        const result = await bindersClient.getUserBinders({ includeStats: true })
        if (result.success) {
          setBinders(result.data.binders || [])
        } else {
          console.error('[Collection] Failed to load binders:', result.error)
          setError("Failed to load binders.")
        }
      } catch (err) {
        console.error('[Collection] Failed to load data:', err)
        setError("Failed to load binders.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  useEffect(() => {
    if (!slugTouched && newBinderName.trim()) {
      const existingSlugs = binders.map(b => b.slug || b.discordExternalId).filter(Boolean)
      setNewBinderSlug(generateUniqueBinderSlug(newBinderName, existingSlugs))
    }
  }, [newBinderName, binders, slugTouched])

  const validateSlug = (slug: string) => {
    if (!slug) return "Slug is required."
    if (!/^[a-z0-9_-]{3,20}$/.test(slug)) return "Slug must be 3-20 chars, lowercase letters, numbers, dashes, or underscores."
    if (binders.some(b => (b.slug || b.discordExternalId) === slug)) return "You already have a binder with this slug."
    return null
  }

  const resetCreateForm = () => {
    setNewBinderName("")
    setNewBinderTags("")
    setNewBinderSlug("")
    setSlugTouched(false)
    setNameTouched(false)
    setSlugError(null)
  }

  const handleCreateBinder = async (e: React.FormEvent, shouldRedirect = false) => {
    e.preventDefault()
    setNameTouched(true)
    setSlugTouched(true)
    if (!user || !newBinderName.trim()) return
    const slugErrorCheck = validateSlug(newBinderSlug)
    if (slugErrorCheck) {
      setSlugError(slugErrorCheck)
      return
    }

    setCreating(true)
    setSlugError(null)

    const result = await bindersClient.createBinder({
      name: newBinderName,
      slug: newBinderSlug,
      tags: newBinderTags.split(",").map(t => t.trim()).filter(Boolean),
    })

    if (result.success) {
      const binder = result.data

      const newBinder: BinderWithStats = {
        ...binder,
        totalQuantity: 0,
        totalValue: { tcg_market: 0, tcg_low: 0, tcg_mid: 0, tcg_high: 0 },
        rarityCounts: {},
        sampleCards: []
      }

      setBinders(prev => [...prev, newBinder])

      if (shouldRedirect) {
        window.location.href = `/binder/${binder._id}`
        return
      }

      resetCreateForm()
      window.dispatchEvent(new CustomEvent('binderCreated'))
      setSuccessMessage(`Binder '${binder.name}' created!`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } else {
      setSlugError(result.error || "Failed to create binder.")
    }
    setCreating(false)
  }

  const handleSaveBinder = async (binder: any, name: string, description: string, tags: string, discordSlug: string, isOnHand: boolean, visibility: any) => {
    try {
      const result = await bindersClient.updateBinder(binder._id, {
        name,
        description,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        slug: discordSlug,
        isOnHand,
        visibility
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to update binder')
      }

      setBinders(prev => prev.map(b =>
        b._id === binder._id ? { ...b, ...result.data, _id: b._id } : b
      ))

      setEditingId(null)
      setSlugError(null)
      setSuccessMessage(`Binder '${name}' updated successfully!`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (error) {
      console.error('[Collection] Failed to update binder:', error)
      if (error instanceof Error) {
        if (error.message.includes('slug')) {
          setSlugError(error.message)
        } else {
          setError(`Failed to update binder: ${error.message}`)
        }
      } else {
        setError('Failed to update binder')
      }
    }
  }

  const handleDeleteBinder = async () => {
    if (!user || !binderToDelete) return

    try {
      const result = await bindersClient.deleteBinder(binderToDelete._id)
      if (!result.success) throw new Error(result.error || "Failed to delete binder")

      setBinders(binders => binders.filter(b => b._id !== binderToDelete._id))
      window.dispatchEvent(new CustomEvent('binderDeleted'))
    } catch (err) {
      console.error('[Collection] Failed to delete binder:', err)
      setError("Failed to delete binder.")
    }
    setDeleteModalOpen(false)
    setBinderToDelete(null)
  }

  const handleTransferBinder = (binder: any) => {
    setBinderToTransfer(binder)
    setTransferModalOpen(true)
  }

  const handleTransferComplete = async () => {
    const result = await bindersClient.getUserBinders({ includeStats: true })
    if (result.success) {
      setBinders(result.data.binders || [])
    }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center text-muted-foreground bg-card rounded-lg mt-12 shadow">
        You must be logged in to view your collection.
      </div>
    )
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

  return (
    <div className="max-w-7xl mx-auto py-6 px-2 md:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">My Collection</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/collection/all-cards">
            <Button variant="outline" className="w-full sm:w-auto">
              <Package className="h-4 w-4 mr-2" />
              All Cards
            </Button>
          </Link>
          <Button onClick={() => setCreateModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Binder
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive-foreground">{error}</p>
        </div>
      )}

      {/* Compact Stats Row */}
      {collectionOverview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Cards</div>
              <div className="text-2xl font-bold text-foreground">
                {collectionOverview.collection.totalQuantity.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" /> Total Value
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                {formatCurrency(collectionOverview.collection.totalValues.tcg_low)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <ArrowLeftRight className="h-3 w-3" /> For Trade
              </div>
              <div className="text-2xl font-bold text-foreground">
                {collectionOverview.collection.quantityForTrade.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Binders</div>
              <div className="text-2xl font-bold text-foreground">
                {collectionOverview.collection.binderCount}
              </div>
              <div className="text-xs text-muted-foreground">
                {collectionOverview.collection.publicBinderCount} public
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cross-Binder Search */}
      <div className="mb-8">
        <InlineCardSearch />
      </div>

      {/* Binder Grid */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            My Binders{binders.length > 0 ? ` (${binders.length})` : ""}
          </h2>
          {binders.length > 0 && (
            <Button
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? "Done" : "Edit"}
            </Button>
          )}
        </div>

        {successMessage && (
          <div className="text-green-600 text-sm mb-3">{successMessage}</div>
        )}

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            {isEditMode ? (
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
                            setBinderToDelete(binder)
                            setDeleteModalOpen(true)
                          }}
                          onTransfer={handleTransferBinder}
                          slugError={slugError}
                          onSlugChange={() => setSlugError(null)}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <Plus className="h-8 w-8" />
                      <span className="text-sm font-medium">New Binder</span>
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {binders.length === 0 ? (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    <p className="mb-4">No binders yet. Create your first one!</p>
                  </div>
                ) : (
                  binders.map(binder => (
                    <BinderViewCard key={binder._id} binder={binder} />
                  ))
                )}
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">New Binder</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Portfolio Insights (collapsible) */}
      {collectionOverview && (
        <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen} className="mb-8">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4" />
              Portfolio Insights
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${insightsOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CollectionHighlights overview={collectionOverview} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Create Binder Dialog */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent>
          <DialogTitle>Create New Binder</DialogTitle>
          <DialogDescription>
            Give your binder a name and a short URL slug.
          </DialogDescription>
          <form onSubmit={handleCreateBinder} className="space-y-4 mt-2">
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
                  disabled={creating}
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
                    setNewBinderSlug(e.target.value)
                    setSlugTouched(true)
                    setSlugError(null)
                  }}
                  className="font-mono"
                  maxLength={20}
                  disabled={creating}
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
              disabled={creating}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => { setCreateModalOpen(false); resetCreateForm(); }}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => handleCreateBinder(e, true)}
                disabled={creating || !newBinderName.trim()}
              >
                {creating ? "Creating..." : "Create & Open"}
              </Button>
              <Button type="submit" disabled={creating || !newBinderName.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Binder Dialog */}
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
  )
}
