"use client"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Copy, ExternalLink } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface DiscordContactPromptProps {
  username: string
  discordUsername?: string
  trigger: React.ReactNode
  context?: string
}

export function DiscordContactPrompt({
  username,
  discordUsername,
  trigger,
  context = "discuss trading",
}: DiscordContactPromptProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyUsername = () => {
    if (discordUsername) {
      navigator.clipboard.writeText(discordUsername)
      setCopied(true)
      toast({
        title: "Copied to clipboard",
        description: `${discordUsername} has been copied to your clipboard.`,
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenDiscord = () => {
    // Open Discord in a new tab
    window.open("https://discord.com/app", "_blank")
    setOpen(false)
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact {username} on Discord</DialogTitle>
            <DialogDescription>Reach out directly on Discord to {context}.</DialogDescription>
          </DialogHeader>
          {discordUsername ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                <span className="font-medium text-gray-900 dark:text-gray-100">{discordUsername}</span>
                <Button variant="ghost" size="sm" onClick={handleCopyUsername}>
                  {copied ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center">
                      <Copy className="h-4 w-4 mr-2" />
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-700 dark:text-gray-300">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </span>
                  )}
                </Button>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>1. Copy the Discord username above</p>
                <p>
                  2. Join the{" "}
                  <a
                    href="https://discord.gg/Rx8eBhhQtk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    FabBazaar Discord server
                  </a>
                </p>
                <p>3. Open Discord and search for this username</p>
                <p>4. Send a message mentioning you found them on FAB Bazaar</p>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {username} hasn't added their Discord username yet. Please try another method of contact.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {discordUsername && (
              <Button onClick={handleOpenDiscord}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Discord
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Also export as default for backward compatibility
export default DiscordContactPrompt
// "use client"

// import type React from "react"

// import { useState } from "react"
// import { Button } from "@/components/ui/button"
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { AlertCircle, Copy, ExternalLink } from "lucide-react"
// import { toast } from "@/components/ui/use-toast"

// interface DiscordContactPromptProps {
//   username: string
//   discordUsername?: string
//   trigger: React.ReactNode
//   context?: string
// }

// export function DiscordContactPrompt({
//   username,
//   discordUsername,
//   trigger,
//   context = "discuss trading",
// }: DiscordContactPromptProps) {
//   const [open, setOpen] = useState(false)
//   const [copied, setCopied] = useState(false)

//   const handleCopyUsername = () => {
//     if (discordUsername) {
//       navigator.clipboard.writeText(discordUsername)
//       setCopied(true)
//       toast({
//         title: "Copied to clipboard",
//         description: `${discordUsername} has been copied to your clipboard.`,
//       })

//       setTimeout(() => setCopied(false), 2000)
//     }
//   }

//   const handleOpenDiscord = () => {
//     // Open Discord in a new tab
//     window.open("https://discord.com/app", "_blank")
//     setOpen(false)
//   }

//   return (
//     <>
//       <div onClick={() => setOpen(true)}>{trigger}</div>

//       <Dialog open={open} onOpenChange={setOpen}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle>Contact {username} on Discord</DialogTitle>
//             <DialogDescription>Reach out directly on Discord to {context}.</DialogDescription>
//           </DialogHeader>

//           {discordUsername ? (
//             <div className="space-y-4">
//               <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
//                 <span className="font-medium">{discordUsername}</span>
//                 <Button variant="ghost" size="sm" onClick={handleCopyUsername}>
//                   {copied ? (
//                     <span className="text-green-600 flex items-center">
//                       <Copy className="h-4 w-4 mr-2" />
//                       Copied
//                     </span>
//                   ) : (
//                     <span className="flex items-center">
//                       <Copy className="h-4 w-4 mr-2" />
//                       Copy
//                     </span>
//                   )}
//                 </Button>
//               </div>

//               <div className="text-sm text-gray-500">
//                 <p>1. Copy the Discord username above</p>
//                 <p>2. Open Discord and search for this username</p>
//                 <p>3. Send a message mentioning you found them on FAB Bazaar</p>
//               </div>
//             </div>
//           ) : (
//             <Alert variant="destructive">
//               <AlertCircle className="h-4 w-4" />
//               <AlertDescription>
//                 {username} hasn't added their Discord username yet. Please try another method of contact.
//               </AlertDescription>
//             </Alert>
//           )}

//           <DialogFooter className="sm:justify-between">
//             <Button variant="outline" onClick={() => setOpen(false)}>
//               Cancel
//             </Button>
//             {discordUsername && (
//               <Button onClick={handleOpenDiscord}>
//                 <ExternalLink className="h-4 w-4 mr-2" />
//                 Open Discord
//               </Button>
//             )}
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </>
//   )
// }

// // Also export as default for backward compatibility
// export default DiscordContactPrompt
