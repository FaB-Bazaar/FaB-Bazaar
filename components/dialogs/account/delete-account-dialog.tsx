"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"

export function DeleteAccountDialog() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    if (confirmation !== "DELETE") {
      setError("Please type DELETE to confirm")
      return
    }

    setError(null)
    setIsDeleting(true)

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setIsOpen(false)
        // Redirect to home page after successful deletion
        router.push("/")
        router.refresh()
      } else {
        setError(data.error || "Failed to delete account")
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. All your data will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">This will delete:</p>
            <ul className="list-disc pl-5 text-sm">
              <li>Your user account</li>
              <li>Your trade binder and all cards</li>
              <li>Your wants list</li>
              <li>All your listings</li>
              <li>All trade agreements and offers</li>
              <li>All messages and notifications</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Type DELETE to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeleting || confirmation !== "DELETE"}
          >
            {isDeleting ? (
              <span className="flex items-center">
                <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Deleting...
              </span>
            ) : (
              "Delete Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
