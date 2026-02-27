"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, BookOpen, Star, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export function ExportOptions() {
  const { toast } = useToast()
  const [isExportingBinder, setIsExportingBinder] = useState(false)
  const [isExportingWants, setIsExportingWants] = useState(false)
  const [isExportingAllBinders, setIsExportingAllBinders] = useState(false)
  const { user } = useAuth()
  const [binders, setBinders] = useState<any[]>([])
  const [selectedBinderId, setSelectedBinderId] = useState<string>("")

  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.id}/binders`)
      .then(res => res.json())
      .then(data => {
        setBinders(data.binders || [])
        if (data.binders && data.binders.length > 0) {
          setSelectedBinderId(data.binders[0]._id)
        }
      })
      .catch(() => setBinders([]))
  }, [user])

  const handleExportAllBinders = async () => {
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
  }

  const handleExportBinder = async () => {
    if (!selectedBinderId) return;
    setIsExportingBinder(true)
    try {
      const response = await fetch(`/api/user/export/binder?binderId=${selectedBinderId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to export binder")
      }
      const data = await response.json()
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
  }

  const handleExportWants = async () => {
    setIsExportingWants(true)
    try {
      const response = await fetch("/api/user/export/wants")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to export wants list")
      }
      const data = await response.json()
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
  }

  return (
    <div className="space-y-3">
      {/* Export All Binders */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">All Binders</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportAllBinders}
          disabled={isExportingAllBinders}
        >
          {isExportingAllBinders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </div>

      {/* Export Specific Binder */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Specific Binder</span>
        </div>
        {binders.length > 0 ? (
          <div className="flex gap-2">
            <Select value={selectedBinderId} onValueChange={setSelectedBinderId}>
              <SelectTrigger className="h-9 flex-1">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBinder}
              disabled={isExportingBinder || !selectedBinderId}
            >
              {isExportingBinder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No binders found</div>
        )}
      </div>

      {/* Export Wants List */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Star className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">Wants List</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportWants}
          disabled={isExportingWants}
        >
          {isExportingWants ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
