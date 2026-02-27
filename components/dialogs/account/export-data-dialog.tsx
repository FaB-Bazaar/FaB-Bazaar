"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, BookOpen, Star, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export function ExportDataDialog() {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isExportingBinder, setIsExportingBinder] = useState(false)
  const [isExportingWants, setIsExportingWants] = useState(false)
  const [isExportingAllBinders, setIsExportingAllBinders] = useState(false)
  const [lastExportedBinder, setLastExportedBinder] = useState<any | null>(null)
  const [lastExportedWants, setLastExportedWants] = useState<any | null>(null)
  const { user } = useAuth()
  const [binders, setBinders] = useState<any[]>([])
  const [selectedBinderId, setSelectedBinderId] = useState<string>("")

  useEffect(() => {
    if (!isOpen || !user) return;
    fetch(`/api/users/${user.id}/binders`)
      .then(res => res.json())
      .then(data => {
        setBinders(data.binders || [])
        if (data.binders && data.binders.length > 0) {
          setSelectedBinderId(data.binders[0]._id)
        }
      })
      .catch(() => setBinders([]))
  }, [isOpen, user])

  const saveFileWithPrompt = async (data: any, suggestedName: string) => {
    const jsonString = JSON.stringify(data, null, 2)

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "JSON Files",
              accept: { "application/json": [".json"] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(jsonString)
        await writable.close()

        toast({
          title: "File saved successfully",
          description: `Saved as ${handle.name}`,
        })
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("File save failed:", err)
          toast({
            title: "Save Failed",
            description: err.message,
            variant: "destructive",
          })
        }
      }
    } else {
      // Fallback: auto-download via blob
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = suggestedName
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 100)
    }
  }

  const handleExport = async (type: "binder" | "wants") => {
    const setLoading = type === "binder" ? setIsExportingBinder : setIsExportingWants
    const setExported = type === "binder" ? setLastExportedBinder : setLastExportedWants
    const filename = `${type}-export-${new Date().toISOString().split("T")[0]}.json`

    setLoading(true)
    try {
      const response = await fetch(`/api/user/export/${type}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to export ${type}`)
      }
      const data = await response.json()
      setExported(data)
      await saveFileWithPrompt(data, filename)

      toast({
        title: `${type === "binder" ? "Binder" : "Wants List"} Exported`,
        description: `Your ${type === "binder" ? "binder" : "wants list"} has been successfully exported`,
      })
    } catch (error) {
      console.error(`Export ${type} error:`, error)
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : `Failed to export ${type}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Your Data</DialogTitle>
          <DialogDescription>Download your card collection and wants list in JSON format.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Export All Binders */}
          <div className="flex flex-col gap-2 p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Export All Binders</p>
                <p className="text-sm text-muted-foreground">Download all your binders in a single file</p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                setIsExportingAllBinders(true)
                try {
                  const response = await fetch("/api/user/export/all-binders")
                  if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || "Failed to export all binders")
                  }
                  const data = await response.json()
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const filename = `all-binders-export-${new Date().toISOString().split("T")[0]}.json`
                  const a = document.createElement("a")
                  a.href = url
                  a.download = filename
                  document.body.appendChild(a)
                  a.click()
                  setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }, 100)
                  toast({
                    title: "All Binders Exported",
                    description: `Successfully exported ${data.totalBinders} binders with ${data.totalCards} total cards`,
                  })
                } catch (error) {
                  console.error("Export all binders error:", error)
                  toast({
                    title: "Export Failed",
                    description: error instanceof Error ? error.message : "Failed to export all binders",
                    variant: "destructive",
                  })
                } finally {
                  setIsExportingAllBinders(false)
                }
              }}
              disabled={isExportingAllBinders}
              className="w-full"
            >
              {isExportingAllBinders ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Binders
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Trade Binder</p>
                <p className="text-sm text-muted-foreground">Export a specific trade binder</p>
              </div>
            </div>
            {binders.length > 0 ? (
              <Select value={selectedBinderId} onValueChange={setSelectedBinderId}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select a binder" />
                </SelectTrigger>
                <SelectContent>
                  {binders.map((binder: any) => (
                    <SelectItem key={binder._id} value={binder._id}>
                      {binder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground">No binders found.</div>
            )}
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!selectedBinderId) return;
                  setIsExportingBinder(true)
                  try {
                    const response = await fetch(`/api/user/export/binder?binderId=${selectedBinderId}`)
                    if (!response.ok) {
                      const errorData = await response.json()
                      throw new Error(errorData.error || "Failed to export binder")
                    }
                    const data = await response.json()
                    setLastExportedBinder(data)
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                    const url = URL.createObjectURL(blob)
                    const filename = `binder-export-${new Date().toISOString().split("T")[0]}.json`
                    const a = document.createElement("a")
                    a.href = url
                    a.download = filename
                    document.body.appendChild(a)
                    a.click()
                    setTimeout(() => {
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }, 100)
                    toast({
                      title: "Binder Exported",
                      description: "Your binder has been successfully exported",
                    })
                  } catch (error) {
                    console.error("Export binder error:", error)
                    toast({
                      title: "Export Failed",
                      description: error instanceof Error ? error.message : "Failed to export binder",
                      variant: "destructive",
                    })
                  } finally {
                    setIsExportingBinder(false)
                  }
                }}
                disabled={isExportingBinder || !selectedBinderId}
              >
                {isExportingBinder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Wants List</p>
                <p className="text-sm text-muted-foreground">Export your wants list</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsExportingWants(true)
                  try {
                    const response = await fetch("/api/user/export/wants")
                    if (!response.ok) {
                      const errorData = await response.json()
                      throw new Error(errorData.error || "Failed to export wants list")
                    }
                    const data = await response.json()
                    setLastExportedWants(data)
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                    const url = URL.createObjectURL(blob)
                    const filename = `wants-export-${new Date().toISOString().split("T")[0]}.json`
                    const a = document.createElement("a")
                    a.href = url
                    a.download = filename
                    document.body.appendChild(a)
                    a.click()
                    setTimeout(() => {
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }, 100)
                    toast({
                      title: "Wants List Exported",
                      description: "Your wants list has been successfully exported",
                    })
                  } catch (error) {
                    console.error("Export wants list error:", error)
                    toast({
                      title: "Export Failed",
                      description: error instanceof Error ? error.message : "Failed to export wants list",
                      variant: "destructive",
                    })
                  } finally {
                    setIsExportingWants(false)
                  }
                }}
                disabled={isExportingWants}
              >
                {isExportingWants ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
