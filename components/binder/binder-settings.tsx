"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertCircle, Save, ChevronDown, ChevronUp, ImageIcon, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { bindersClient } from '@/lib/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface BinderSettingsProps {
  binder: {
    id: string
    name: string
    description?: string
    isPublic?: boolean
    thumbnailPrintingId?: string
    visibility?: {
      level: string
      allowInSearch: boolean
      allowInMatching: boolean
      allowApiExport: boolean
      allowWhoHas: boolean
      allowWebhooks: boolean
    }
  }
  onSave: (settings: {
    name: string
    description: string
    thumbnailPrintingId?: string
    visibility: {
      level: string
      allowInSearch: boolean
      allowInMatching: boolean
      allowApiExport: boolean
      allowWhoHas: boolean
      allowWebhooks: boolean
    }
  }) => Promise<void>
  onSetAllForTrade: (forTradeValue: boolean) => void
  loading: boolean
}

export default function BinderSettings({ binder, onSave, onSetAllForTrade, loading }: BinderSettingsProps) {
  const [name, setName] = useState(binder.name || "My Trade Binder")
  const [description, setDescription] = useState(binder.description || "")
  const [thumbnailPrintingId, setThumbnailPrintingId] = useState(binder.thumbnailPrintingId || "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showAdvancedVisibility, setShowAdvancedVisibility] = useState(false)
  const [showCardSelector, setShowCardSelector] = useState(false)
  const [binderCards, setBinderCards] = useState<any[]>([])
  const [loadingCards, setLoadingCards] = useState(false)

  // Initialize visibility state from binder data
  const [visibility, setVisibility] = useState(() => {
    if (binder.visibility) {
      return binder.visibility;
    }
    // Fallback to legacy isPublic field
    const isPublic = binder.isPublic ?? true;
    return {
      level: isPublic ? 'public' : 'private',
      allowInSearch: isPublic,
      allowInMatching: isPublic,
      allowApiExport: isPublic,
      allowWhoHas: isPublic,
      allowWebhooks: isPublic
    };
  });

  const handleVisibilityLevelChange = (level: string) => {
    const newVisibility = { ...visibility, level };
    if (level === 'private') {
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = false;
      newVisibility.allowApiExport = false;
      newVisibility.allowWhoHas = false;
      newVisibility.allowWebhooks = false;
    } else if (level === 'public') {
      newVisibility.allowInSearch = true;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    } else if (level === 'unlisted') {
      newVisibility.allowInSearch = false;
      newVisibility.allowInMatching = true;
      newVisibility.allowApiExport = true;
      newVisibility.allowWhoHas = true;
      newVisibility.allowWebhooks = true;
    }
    setVisibility(newVisibility);
  };

  const handleAdvancedVisibilityChange = (field: string, value: boolean) => {
    setVisibility(prev => ({ ...prev, [field]: value }));
  };

  // Fetch cards when card selector dialog opens
  useEffect(() => {
    const fetchCards = async () => {
      if (showCardSelector && binderCards.length === 0) {
        setLoadingCards(true);

        const result = await bindersClient.getBinderCards(binder.id, {}, { limit: 50 });

        setLoadingCards(false);

        if (result.success) {
          setBinderCards(result.data.cards || []);
        } else {
          console.error('Error fetching cards:', result.error);
        }
      }
    };
    fetchCards();
  }, [showCardSelector, binder.id, binderCards.length]);

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(false)
      await onSave({
        name,
        description,
        thumbnailPrintingId: thumbnailPrintingId || undefined,
        visibility,
      })
      setSuccess(true)
    } catch (err) {
      console.error("Error saving binder settings:", err)
      setError("Failed to save binder settings. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Binder Settings</CardTitle>
        <CardDescription>Customize your trade binder settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Success</AlertTitle>
            <AlertDescription className="text-green-600">Your binder settings have been saved.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="binder-name">Binder Name</Label>
          <Input
            id="binder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Trade Binder"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="binder-description">Description (Optional)</Label>
          <Textarea
            id="binder-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for your trade binder"
            rows={3}
          />
        </div>

        {/* Thumbnail Selection */}
        <div className="space-y-2">
          <Label>Binder Thumbnail</Label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose a card from your binder to display when sharing your binder link on Discord, Twitter, etc.
          </p>
          <div className="flex items-center gap-3">
            {thumbnailPrintingId && (
              <div className="relative">
                <img
                  src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${thumbnailPrintingId}/public`}
                  alt="Binder thumbnail"
                  className="w-24 h-auto rounded border-2 border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setThumbnailPrintingId("")}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Dialog open={showCardSelector} onOpenChange={setShowCardSelector}>
              <DialogTrigger asChild>
                <Button variant="outline" type="button">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {thumbnailPrintingId ? "Change Card" : "Select Card"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Select a Card for Thumbnail</DialogTitle>
                  <DialogDescription>
                    Choose a card from your binder to represent it when sharing.
                  </DialogDescription>
                </DialogHeader>
                {loadingCards ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4">
                    {binderCards.map((card) => {
                      const printingId = card.printingId || card.printing_id || card.printingDetails?.printing_id;
                      return (
                        <button
                          key={card.id || card._id}
                          type="button"
                          onClick={() => {
                            setThumbnailPrintingId(printingId);
                            setShowCardSelector(false);
                          }}
                          className="hover:opacity-75 transition-opacity border-2 border-transparent hover:border-primary rounded"
                        >
                          <img
                            src={`https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${printingId}/public`}
                            alt={card.name || card.display_name}
                            className="w-full h-auto rounded"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Modern Visibility Controls */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility:</Label>
            <select
              value={visibility.level}
              onChange={e => handleVisibilityLevelChange(e.target.value)}
              className="text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {visibility.level === 'public' && "Visible to everyone and appears in searches."}
            {visibility.level === 'unlisted' && "Visible via link but not in public searches."}
            {visibility.level === 'private' && "Only visible to you."}
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedVisibility(!showAdvancedVisibility)}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            {showAdvancedVisibility ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Privacy Settings
          </button>

          {/* Advanced Settings Panel */}
          {showAdvancedVisibility && (
            <div className="mt-3 space-y-3 pl-3 border-l-2 border-gray-200 dark:border-gray-600">
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={visibility.allowInSearch}
                  onChange={e => handleAdvancedVisibilityChange('allowInSearch', e.target.checked)}
                  className="rounded"
                />
                Show in card searches
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={visibility.allowInMatching}
                  onChange={e => handleAdvancedVisibilityChange('allowInMatching', e.target.checked)}
                  className="rounded"
                />
                Allow trade matching
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={visibility.allowWhoHas}
                  onChange={e => handleAdvancedVisibilityChange('allowWhoHas', e.target.checked)}
                  className="rounded"
                />
                Show in "who has" queries
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={visibility.allowWebhooks}
                  onChange={e => handleAdvancedVisibilityChange('allowWebhooks', e.target.checked)}
                  className="rounded"
                />
                Allow webhooks
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={visibility.allowApiExport}
                  onChange={e => handleAdvancedVisibilityChange('allowApiExport', e.target.checked)}
                  className="rounded"
                />
                Allow API access
              </label>
            </div>
          )}
        </div>

        {/* --- NEW: BULK ACTIONS SECTION --- */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-2">Bulk Actions</h3>
          <p className="text-sm text-gray-500 mb-4">
            Quickly mark all cards in this binder as for trade or not for trade. This action cannot be undone.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* "All For Trade" Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" disabled={loading || isSaving} className="flex-1">
                  All For Trade
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will mark all cards in this binder as 'For Trade'.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onSetAllForTrade(true)}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* "All Not For Trade" Dialog */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={loading || isSaving} className="flex-1">
                  All Not For Trade
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will mark all cards in this binder as 'Not For Trade'.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onSetAllForTrade(false)}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex justify-between">
          <Button onClick={handleSave} disabled={isSaving || loading}>
            {isSaving ? (
              <>
                <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
// "use client"

// import { CardFooter } from "@/components/ui/card"

// import { useState } from "react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Textarea } from "@/components/ui/textarea"
// import { Label } from "@/components/ui/label"
// import { Switch } from "@/components/ui/switch"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { AlertCircle, Save } from "lucide-react"
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// interface BinderSettingsProps {
//   binder: {
//     id: string
//     name: string
//     description?: string
//     isPublic: boolean
//   }
//   onSave: (settings: {
//     name: string
//     description: string
//     isPublic: boolean
//   }) => Promise<void>
// }

// export default function BinderSettings({ binder, onSave }: BinderSettingsProps) {
//   const [name, setName] = useState(binder.name || "My Trade Binder")
//   const [description, setDescription] = useState(binder.description || "")
//   const [isPublic, setIsPublic] = useState(binder.isPublic)
//   const [isSaving, setIsSaving] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [success, setSuccess] = useState(false)

//   const handleSave = async () => {
//     try {
//       setIsSaving(true)
//       setError(null)
//       setSuccess(false)

//       await onSave({
//         name,
//         description,
//         isPublic,
//       })

//       setSuccess(true)
//     } catch (err) {
//       console.error("Error saving binder settings:", err)
//       setError("Failed to save binder settings. Please try again.")
//     } finally {
//       setIsSaving(false)
//     }
//   }

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Binder Settings</CardTitle>
//         <CardDescription>Customize your trade binder settings</CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         {error && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertTitle>Error</AlertTitle>
//             <AlertDescription>{error}</AlertDescription>
//           </Alert>
//         )}

//         {success && (
//           <Alert className="bg-green-50 border-green-200">
//             <AlertCircle className="h-4 w-4 text-green-600" />
//             <AlertTitle className="text-green-600">Success</AlertTitle>
//             <AlertDescription className="text-green-600">Your binder settings have been saved.</AlertDescription>
//           </Alert>
//         )}

//         <div className="space-y-2">
//           <Label htmlFor="binder-name">Binder Name</Label>
//           <Input
//             id="binder-name"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             placeholder="My Trade Binder"
//           />
//         </div>

//         <div className="space-y-2">
//           <Label htmlFor="binder-description">Description (Optional)</Label>
//           <Textarea
//             id="binder-description"
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//             placeholder="Add a description for your trade binder"
//             rows={3}
//           />
//         </div>

//         <div className="flex items-center justify-between">
//           <div className="space-y-0.5">
//             <Label htmlFor="public-binder">Public Binder</Label>
//             <p className="text-sm text-gray-500">When enabled, other users can view your trade binder</p>
//           </div>
//           <Switch id="public-binder" checked={isPublic} onCheckedChange={setIsPublic} />
//         </div>
//       </CardContent>
//       <CardFooter>
//         <div className="flex justify-between">
//           {/* Assuming user object is available in this component's scope.  If not, it needs to be passed as a prop or accessed via context. */}
//           {/* For demonstration purposes, I'm commenting out the user check.  You'll need to adapt this to your actual user object. */}
//           {/* {user && (
//             <ViewBinderButton 
//               userId={user.id} 
//               username={user.username || "User"} 
//               variant="outline"
//             />
//           )} */}
//           <Button onClick={handleSave} disabled={isSaving}>
//             {isSaving ? (
//               <>
//                 <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
//                 Saving...
//               </>
//             ) : (
//               <>
//                 <Save className="h-4 w-4 mr-2" />
//                 Save Settings
//               </>
//             )}
//           </Button>
//         </div>
//       </CardFooter>
//     </Card>
//   )
// }
