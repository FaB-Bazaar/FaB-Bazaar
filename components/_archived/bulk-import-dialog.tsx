"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
  aiPrintingImports?: { printingId: string; quantity: number }[] // Optional for AI import
}

interface ParsedCard {
  name: string
  quantity: number
}

interface ProcessedCard {
  name: string
  quantity: number
  pitch?: string
  cardId?: string
  printingId?: string
}

export default function BulkImportDialog({ open, onOpenChange, onImportComplete, aiPrintingImports }: BulkImportDialogProps) {
  const [importText, setImportText] = useState("")
  const [activeTab, setActiveTab] = useState("paste")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([])
  const [aiPrintings, setAiPrintings] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const { toast } = useToast()

  // Fetch printing details if aiPrintingImports is provided
  useEffect(() => {
    if (aiPrintingImports && aiPrintingImports.length > 0) {
      setAiLoading(true)
      // Fetch printings in batch
      fetch(`/api/printings/search?printingIds=${aiPrintingImports.map(p => p.printingId).join(",")}&limit=${aiPrintingImports.length}`)
        .then(res => res.json())
        .then(data => {
          // Map by printingId for fast lookup
          const printingMap: Record<string, any> = {}
          for (const p of data.printings || []) {
            printingMap[p.printing_id || p.unique_id] = p
          }
          // Merge with quantities
          const merged = aiPrintingImports.map(item => ({
            ...printingMap[item.printingId],
            printingId: item.printingId,
            quantity: item.quantity,
          }))
          setAiPrintings(merged)
        })
        .catch(() => setAiPrintings([]))
        .finally(() => setAiLoading(false))
    } else {
      setAiPrintings([])
    }
  }, [aiPrintingImports])

  const handleImport = async () => {
    try {
      setLoading(true)
      setError(null)
      setImportResult(null)

      const cards = parseFabraryExport(importText)
      setParsedCards(cards)

      if (cards.length === 0) {
        throw new Error("No valid cards found in the import text. Please check the format and try again.")
      }

      const processedCards = await processCards(cards)

      // Add each processed card to wants list via /api/wants/add
      let added = 0, failed = 0;
      await Promise.all(processedCards.map(async (card) => {
        if (!card.printingId) { failed++; return; }
        const res = await fetch('/api/wants/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printingId: card.printingId, quantity: card.quantity }),
        });
        if (res.ok) { added++; }
        else { failed++; }
      }));
      setImportResult({ summary: { added, failed } });
      toast({
        title: 'Import Complete',
        description: `Added ${added} cards to your wants list${failed ? ", " + failed + " failed" : ''}`,
      });
      if (added > 0) onImportComplete();
    } catch (err: any) {
      setError(err.message || "Failed to import cards")
      toast({
        title: "Import Failed",
        description: err.message || "Failed to import cards",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handler for AI import submit
  const handleAiImport = async () => {
    try {
      setLoading(true)
      setError(null)
      setImportResult(null)
      // Prepare processed cards
      const processedCards = aiPrintings.map(p => ({
        printingId: p.printing_id || p.printingId || p.unique_id,
        quantity: p.quantity,
      }))
      // Add each processed card to wants list via /api/wants/add
      let added = 0, failed = 0;
      await Promise.all(processedCards.map(async (card) => {
        if (!card.printingId) { failed++; return; }
        const res = await fetch('/api/wants/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printingId: card.printingId, quantity: card.quantity }),
        });
        if (res.ok) { added++; }
        else { failed++; }
      }));
      setImportResult({ summary: { added, failed } });
      toast({
        title: 'Import Complete',
        description: `Added ${added} cards to your wants list${failed ? ", " + failed + " failed" : ''}`,
      });
      if (added > 0) onImportComplete();
    } catch (err: any) {
      setError(err.message || "Failed to import cards")
      toast({
        title: "Import Failed",
        description: err.message || "Failed to import cards",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handler for quantity change/removal in AI import
  const handleAiQuantityChange = (idx: number, newQty: number) => {
    setAiPrintings(prev => prev.map((p, i) => i === idx ? { ...p, quantity: newQty } : p))
  }
  const handleAiRemove = (idx: number) => {
    setAiPrintings(prev => prev.filter((_, i) => i !== idx))
  }

  const parseFabraryExport = (text: string): ParsedCard[] => {
    const cards: ParsedCard[] = []
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")

    for (const line of lines) {
      // Skip section headers
      if (
        line.toLowerCase().includes("arena cards") ||
        line.toLowerCase().includes("deck cards") ||
        line.toLowerCase().includes("sideboard")
      ) {
        continue;
      }

      // Skip metadata lines
      if (
        line.startsWith("Name:") ||
        line.startsWith("Hero:") ||
        line.startsWith("Format:") ||
        line.startsWith("Made with") ||
        line.startsWith("See the full")
      ) {
        continue;
      }

      const quantityMatch = line.match(/^(\d+)x\s+/)
      if (!quantityMatch) continue

      const quantity = Number.parseInt(quantityMatch[1], 10)
      let remainingText = line.substring(quantityMatch[0].length)

      // Always strip (red), (yellow), (blue) from anywhere in the name
      remainingText = remainingText.replace(/\s*\((red|yellow|blue)\)/gi, "").trim()

      cards.push({ name: remainingText, quantity })
    }

    return cards
  }

  const processCards = async (cards: ParsedCard[]): Promise<ProcessedCard[]> => {
    const processedCards: ProcessedCard[] = []
    const notFoundCards: ProcessedCard[] = []

    for (const card of cards) {
      try {
        // Use the cleaned name from the parser directly
        const searchName = card.name;
        console.log(`[BulkImport] Searching for card: '${searchName}'`);
        const response = await fetch(`/api/cards?query=${encodeURIComponent(searchName)}&limit=20`)

        if (!response.ok) {
          console.log(`[BulkImport] API search failed for:`, searchName)
          throw new Error(`Failed to search for card: ${searchName}`)
        }

        const data = await response.json()
        console.log(`[BulkImport] API response for ${searchName}:`, data)

        if (data.cards && data.cards.length > 0) {
          // Find all cards with the exact base name
          const exactNameMatches = data.cards.filter((c: any) => c.name.toLowerCase() === searchName.toLowerCase())
          console.log(`[BulkImport] Exact name matches for ${searchName}:`, exactNameMatches)

          // If no pitch or not found, fall back to first match
          if (exactNameMatches.length > 0) {
            const selectedCard = exactNameMatches[0]

            if (selectedCard) {
              // Select printing with lowest tcgMarket
              const bestPrinting = (selectedCard.printings || []).filter((p: any) => typeof p.tcgMarket === 'number' && !isNaN(p.tcgMarket)).sort((a: any, b: any) => a.tcgMarket - b.tcgMarket)[0]
                || (selectedCard.printings || [])[0];
              console.log(`[BulkImport] Selected printing for ${searchName}:`, bestPrinting)
              processedCards.push({
                name: card.name, // keep original name (with pitch color for user clarity)
                quantity: card.quantity,
                pitch: selectedCard.pitch || "",
                cardId: selectedCard.unique_id,
                printingId: bestPrinting?.unique_id,
              })
              continue
            } else {
              console.log(`[BulkImport] No matching card found for ${searchName}`)
            }
          }
        } else {
          console.log(`[BulkImport] No cards found for ${searchName}`)
        }

        notFoundCards.push({
          name: card.name,
          quantity: card.quantity,
        })
      } catch (error) {
        console.log(`[BulkImport] Error processing card ${card.name}:`, error)
        notFoundCards.push({
          name: card.name,
          quantity: card.quantity,
        })
      }
    }

    return [...processedCards, ...notFoundCards]
  }

  const handleClose = () => {
    setImportText("")
    setActiveTab("paste")
    setError(null)
    setImportResult(null)
    setParsedCards([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">Bulk Import Cards</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">Paste Text</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          {/* AI Import Mode */}
          {aiPrintingImports && aiPrintingImports.length > 0 ? (
            <TabsContent value="paste" className="flex-1 overflow-hidden flex flex-col">
              {aiLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="animate-spin h-6 w-6 mr-2 text-gray-600 dark:text-gray-300" /> 
                  <span className="text-gray-600 dark:text-gray-300">Loading printings...</span>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Review and adjust your import list below.</p>
                    <div className="space-y-2">
                      {aiPrintings.map((p, idx) => (
                        <div key={p.printingId} className="flex items-center gap-3 border border-gray-200 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-700">
                          <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-14 h-20 object-contain rounded" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{p.set_id} {p.edition} {p.rarity} {p.foiling}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleAiQuantityChange(idx, Math.max(1, p.quantity - 1))} 
                              disabled={p.quantity <= 1}
                              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              -
                            </Button>
                            <span className="w-6 text-center text-gray-900 dark:text-gray-100">{p.quantity}</span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleAiQuantityChange(idx, p.quantity + 1)}
                              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              +
                            </Button>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" 
                            onClick={() => handleAiRemove(idx)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>
          ) : (
            <>
              <TabsContent value="paste" className="flex-1 overflow-hidden flex flex-col">
                {!importResult ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Click the "Copy card list to clipboard." and paste directly into here.</p>
                      <textarea
                        className="w-full h-64 p-3 border border-gray-200 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder={"Click the 'Copy card list to clipboard.' and paste directly into here."}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    {parsedCards.length > 0 && !loading && !error && (
                      <Alert className="mb-4">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Ready to Import</AlertTitle>
                        <AlertDescription>Found {parsedCards.length} cards in your list</AlertDescription>
                      </Alert>
                    )}

                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <div className="overflow-y-auto flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                        <div className="font-medium flex items-center text-gray-900 dark:text-gray-100">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
                          Added
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{importResult.summary.added}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                        <div className="font-medium flex items-center text-gray-900 dark:text-gray-100">
                          <XCircle className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />
                          Failed
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{importResult.summary.failed}</div>
                      </div>
                    </div>

                    {importResult.failed?.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Failed to Find</h3>
                        <div className="flex flex-wrap gap-2">
                          {importResult.failed.map((card: any, index: number) => (
                            <Badge key={index} variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {card.quantity}x {card.name} {card.pitch ? `(${card.pitch})` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="help" className="flex-1 overflow-y-auto p-4 text-sm text-gray-500 dark:text-gray-400">
                <p>Paste a text export from Fabrary or another card manager.</p>
                <p>Each line should look like:</p>
                <pre className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 rounded mt-2 border border-gray-200 dark:border-gray-600">3x Enlightened Strike (red)</pre>
                <p className="mt-2">Only lines with this format will be parsed.</p>
              </TabsContent>
            </>
          )}
        </Tabs>

        <DialogFooter className="pt-4">
          {aiPrintingImports && aiPrintingImports.length > 0 ? (
            <Button onClick={handleAiImport} disabled={loading || aiLoading || aiPrintings.length === 0} className="w-full">
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              {loading ? "Importing..." : "Start Import"}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading || !importText.trim()} className="w-full">
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              {loading ? "Importing..." : "Start Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// "use client"

// import { useState, useEffect } from "react"
// import { Button } from "@/components/ui/button"
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// import { Badge } from "@/components/ui/badge"
// import { Loader2, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react"
// import { useToast } from "@/hooks/use-toast"

// interface BulkImportDialogProps {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   onImportComplete: () => void
//   aiPrintingImports?: { printingId: string; quantity: number }[] // Optional for AI import
// }

// interface ParsedCard {
//   name: string
//   quantity: number
// }

// interface ProcessedCard {
//   name: string
//   quantity: number
//   pitch?: string
//   cardId?: string
//   printingId?: string
// }

// export default function BulkImportDialog({ open, onOpenChange, onImportComplete, aiPrintingImports }: BulkImportDialogProps) {
//   const [importText, setImportText] = useState("")
//   const [activeTab, setActiveTab] = useState("paste")
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [importResult, setImportResult] = useState<any>(null)
//   const [parsedCards, setParsedCards] = useState<ParsedCard[]>([])
//   const [aiPrintings, setAiPrintings] = useState<any[]>([])
//   const [aiLoading, setAiLoading] = useState(false)
//   const { toast } = useToast()

//   // Fetch printing details if aiPrintingImports is provided
//   useEffect(() => {
//     if (aiPrintingImports && aiPrintingImports.length > 0) {
//       setAiLoading(true)
//       // Fetch printings in batch
//       fetch(`/api/printings/search?printingIds=${aiPrintingImports.map(p => p.printingId).join(",")}&limit=${aiPrintingImports.length}`)
//         .then(res => res.json())
//         .then(data => {
//           // Map by printingId for fast lookup
//           const printingMap: Record<string, any> = {}
//           for (const p of data.printings || []) {
//             printingMap[p.printing_id || p.unique_id] = p
//           }
//           // Merge with quantities
//           const merged = aiPrintingImports.map(item => ({
//             ...printingMap[item.printingId],
//             printingId: item.printingId,
//             quantity: item.quantity,
//           }))
//           setAiPrintings(merged)
//         })
//         .catch(() => setAiPrintings([]))
//         .finally(() => setAiLoading(false))
//     } else {
//       setAiPrintings([])
//     }
//   }, [aiPrintingImports])

//   const handleImport = async () => {
//     try {
//       setLoading(true)
//       setError(null)
//       setImportResult(null)

//       const cards = parseFabraryExport(importText)
//       setParsedCards(cards)

//       if (cards.length === 0) {
//         throw new Error("No valid cards found in the import text. Please check the format and try again.")
//       }

//       const processedCards = await processCards(cards)

//       // Add each processed card to wants list via /api/wants/add
//       let added = 0, failed = 0;
//       await Promise.all(processedCards.map(async (card) => {
//         if (!card.printingId) { failed++; return; }
//         const res = await fetch('/api/wants/add', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ printingId: card.printingId, quantity: card.quantity }),
//         });
//         if (res.ok) { added++; }
//         else { failed++; }
//       }));
//       setImportResult({ summary: { added, failed } });
//       toast({
//         title: 'Import Complete',
//         description: `Added ${added} cards to your wants list${failed ? ", " + failed + " failed" : ''}`,
//       });
//       if (added > 0) onImportComplete();
//     } catch (err: any) {
//       setError(err.message || "Failed to import cards")
//       toast({
//         title: "Import Failed",
//         description: err.message || "Failed to import cards",
//         variant: "destructive",
//       })
//     } finally {
//       setLoading(false)
//     }
//   }

//   // Handler for AI import submit
//   const handleAiImport = async () => {
//     try {
//       setLoading(true)
//       setError(null)
//       setImportResult(null)
//       // Prepare processed cards
//       const processedCards = aiPrintings.map(p => ({
//         printingId: p.printing_id || p.printingId || p.unique_id,
//         quantity: p.quantity,
//       }))
//       // Add each processed card to wants list via /api/wants/add
//       let added = 0, failed = 0;
//       await Promise.all(processedCards.map(async (card) => {
//         if (!card.printingId) { failed++; return; }
//         const res = await fetch('/api/wants/add', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ printingId: card.printingId, quantity: card.quantity }),
//         });
//         if (res.ok) { added++; }
//         else { failed++; }
//       }));
//       setImportResult({ summary: { added, failed } });
//       toast({
//         title: 'Import Complete',
//         description: `Added ${added} cards to your wants list${failed ? ", " + failed + " failed" : ''}`,
//       });
//       if (added > 0) onImportComplete();
//     } catch (err: any) {
//       setError(err.message || "Failed to import cards")
//       toast({
//         title: "Import Failed",
//         description: err.message || "Failed to import cards",
//         variant: "destructive",
//       })
//     } finally {
//       setLoading(false)
//     }
//   }

//   // Handler for quantity change/removal in AI import
//   const handleAiQuantityChange = (idx: number, newQty: number) => {
//     setAiPrintings(prev => prev.map((p, i) => i === idx ? { ...p, quantity: newQty } : p))
//   }
//   const handleAiRemove = (idx: number) => {
//     setAiPrintings(prev => prev.filter((_, i) => i !== idx))
//   }

//   const parseFabraryExport = (text: string): ParsedCard[] => {
//     const cards: ParsedCard[] = []
//     const lines = text
//       .split("\n")
//       .map((line) => line.trim())
//       .filter((line) => line !== "")

//     for (const line of lines) {
//       // Skip section headers
//       if (
//         line.toLowerCase().includes("arena cards") ||
//         line.toLowerCase().includes("deck cards") ||
//         line.toLowerCase().includes("sideboard")
//       ) {
//         continue;
//       }

//       // Skip metadata lines
//       if (
//         line.startsWith("Name:") ||
//         line.startsWith("Hero:") ||
//         line.startsWith("Format:") ||
//         line.startsWith("Made with") ||
//         line.startsWith("See the full")
//       ) {
//         continue;
//       }

//       const quantityMatch = line.match(/^(\d+)x\s+/)
//       if (!quantityMatch) continue

//       const quantity = Number.parseInt(quantityMatch[1], 10)
//       let remainingText = line.substring(quantityMatch[0].length)

//       // Always strip (red), (yellow), (blue) from anywhere in the name
//       remainingText = remainingText.replace(/\s*\((red|yellow|blue)\)/gi, "").trim()

//       cards.push({ name: remainingText, quantity })
//     }

//     return cards
//   }

//   const processCards = async (cards: ParsedCard[]): Promise<ProcessedCard[]> => {
//     const processedCards: ProcessedCard[] = []
//     const notFoundCards: ProcessedCard[] = []

//     for (const card of cards) {
//       try {
//         // Use the cleaned name from the parser directly
//         const searchName = card.name;
//         console.log(`[BulkImport] Searching for card: '${searchName}'`);
//         const response = await fetch(`/api/cards?query=${encodeURIComponent(searchName)}&limit=20`)

//         if (!response.ok) {
//           console.log(`[BulkImport] API search failed for:`, searchName)
//           throw new Error(`Failed to search for card: ${searchName}`)
//         }

//         const data = await response.json()
//         console.log(`[BulkImport] API response for ${searchName}:`, data)

//         if (data.cards && data.cards.length > 0) {
//           // Find all cards with the exact base name
//           const exactNameMatches = data.cards.filter((c: any) => c.name.toLowerCase() === searchName.toLowerCase())
//           console.log(`[BulkImport] Exact name matches for ${searchName}:`, exactNameMatches)

//           // If no pitch or not found, fall back to first match
//           if (exactNameMatches.length > 0) {
//             const selectedCard = exactNameMatches[0]

//             if (selectedCard) {
//               // Select printing with lowest tcgMarket
//               const bestPrinting = (selectedCard.printings || []).filter((p: any) => typeof p.tcgMarket === 'number' && !isNaN(p.tcgMarket)).sort((a: any, b: any) => a.tcgMarket - b.tcgMarket)[0]
//                 || (selectedCard.printings || [])[0];
//               console.log(`[BulkImport] Selected printing for ${searchName}:`, bestPrinting)
//               processedCards.push({
//                 name: card.name, // keep original name (with pitch color for user clarity)
//                 quantity: card.quantity,
//                 pitch: selectedCard.pitch || "",
//                 cardId: selectedCard.unique_id,
//                 printingId: bestPrinting?.unique_id,
//               })
//               continue
//             } else {
//               console.log(`[BulkImport] No matching card found for ${searchName}`)
//             }
//           }
//         } else {
//           console.log(`[BulkImport] No cards found for ${searchName}`)
//         }

//         notFoundCards.push({
//           name: card.name,
//           quantity: card.quantity,
//         })
//       } catch (error) {
//         console.log(`[BulkImport] Error processing card ${card.name}:`, error)
//         notFoundCards.push({
//           name: card.name,
//           quantity: card.quantity,
//         })
//       }
//     }

//     return [...processedCards, ...notFoundCards]
//   }

//   const handleClose = () => {
//     setImportText("")
//     setActiveTab("paste")
//     setError(null)
//     setImportResult(null)
//     setParsedCards([])
//     onOpenChange(false)
//   }

//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
//         <DialogHeader>
//           <DialogTitle>Bulk Import Cards</DialogTitle>
//         </DialogHeader>

//         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
//           <TabsList className="grid w-full grid-cols-2">
//             <TabsTrigger value="paste">Paste Text</TabsTrigger>
//             <TabsTrigger value="help">Help</TabsTrigger>
//           </TabsList>

//           {/* AI Import Mode */}
//           {aiPrintingImports && aiPrintingImports.length > 0 ? (
//             <TabsContent value="paste" className="flex-1 overflow-hidden flex flex-col">
//               {aiLoading ? (
//                 <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading printings...</div>
//               ) : (
//                 <>
//                   <div className="mb-4">
//                     <p className="text-sm text-gray-500 mb-2">Review and adjust your import list below.</p>
//                     <div className="space-y-2">
//                       {aiPrintings.map((p, idx) => (
//                         <div key={p.printingId} className="flex items-center gap-3 border rounded p-2 bg-muted">
//                           <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-14 h-20 object-contain rounded" />
//                           <div className="flex-1">
//                             <div className="font-medium">{p.name}</div>
//                             <div className="text-xs text-gray-600">{p.set_id} {p.edition} {p.rarity} {p.foiling}</div>
//                           </div>
//                           <div className="flex items-center gap-1">
//                             <Button size="icon" variant="ghost" onClick={() => handleAiQuantityChange(idx, Math.max(1, p.quantity - 1))} disabled={p.quantity <= 1}>-</Button>
//                             <span className="w-6 text-center">{p.quantity}</span>
//                             <Button size="icon" variant="ghost" onClick={() => handleAiQuantityChange(idx, p.quantity + 1)}>+</Button>
//                           </div>
//                           <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleAiRemove(idx)}><XCircle className="h-4 w-4" /></Button>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                   {error && (
//                     <Alert variant="destructive" className="mb-4">
//                       <AlertCircle className="h-4 w-4" />
//                       <AlertTitle>Error</AlertTitle>
//                       <AlertDescription>{error}</AlertDescription>
//                     </Alert>
//                   )}
//                 </>
//               )}
//             </TabsContent>
//           ) : (
//             <>
//               <TabsContent value="paste" className="flex-1 overflow-hidden flex flex-col">
//                 {!importResult ? (
//                   <>
//                     <div className="mb-4">
//                       <p className="text-sm text-gray-500 mb-2">Click the "Copy card list to clipboard." and paste directly into here.</p>
//                       <textarea
//                         className="w-full h-64 p-3 border rounded-md font-mono text-sm"
//                         placeholder={"Click the 'Copy card list to clipboard.' and paste directly into here."}
//                         value={importText}
//                         onChange={(e) => setImportText(e.target.value)}
//                         disabled={loading}
//                       />
//                     </div>

//                     {parsedCards.length > 0 && !loading && !error && (
//                       <Alert className="mb-4">
//                         <Info className="h-4 w-4" />
//                         <AlertTitle>Ready to Import</AlertTitle>
//                         <AlertDescription>Found {parsedCards.length} cards in your list</AlertDescription>
//                       </Alert>
//                     )}

//                     {error && (
//                       <Alert variant="destructive" className="mb-4">
//                         <AlertCircle className="h-4 w-4" />
//                         <AlertTitle>Error</AlertTitle>
//                         <AlertDescription>{error}</AlertDescription>
//                       </Alert>
//                     )}
//                   </>
//                 ) : (
//                   <div className="overflow-y-auto flex-1 space-y-4">
//                     <div className="grid grid-cols-2 gap-2 mb-4">
//                       <div className="bg-muted rounded-md p-3">
//                         <div className="font-medium flex items-center">
//                           <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
//                           Added
//                         </div>
//                         <div className="text-2xl font-bold">{importResult.summary.added}</div>
//                       </div>
//                       <div className="bg-muted rounded-md p-3">
//                         <div className="font-medium flex items-center">
//                           <XCircle className="h-4 w-4 mr-2 text-destructive" />
//                           Failed
//                         </div>
//                         <div className="text-2xl font-bold">{importResult.summary.failed}</div>
//                       </div>
//                     </div>

//                     {importResult.failed?.length > 0 && (
//                       <div>
//                         <h3 className="font-semibold mb-2">Failed to Find</h3>
//                         <div className="flex flex-wrap gap-2">
//                           {importResult.failed.map((card: any, index: number) => (
//                             <Badge key={index} variant="secondary">
//                               {card.quantity}x {card.name} {card.pitch ? `(${card.pitch})` : ""}
//                             </Badge>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </TabsContent>

//               <TabsContent value="help" className="flex-1 overflow-y-auto p-4 text-sm text-gray-500">
//                 <p>Paste a text export from Fabrary or another card manager.</p>
//                 <p>Each line should look like:</p>
//                 <pre className="bg-muted p-2 rounded mt-2">3x Enlightened Strike (red)</pre>
//                 <p className="mt-2">Only lines with this format will be parsed.</p>
//               </TabsContent>
//             </>
//           )}
//         </Tabs>

//         <DialogFooter className="pt-4">
//           {aiPrintingImports && aiPrintingImports.length > 0 ? (
//             <Button onClick={handleAiImport} disabled={loading || aiLoading || aiPrintings.length === 0} className="w-full">
//               {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
//               {loading ? "Importing..." : "Start Import"}
//             </Button>
//           ) : (
//             <Button onClick={handleImport} disabled={loading || !importText.trim()} className="w-full">
//               {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
//               {loading ? "Importing..." : "Start Import"}
//             </Button>
//           )}
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }
