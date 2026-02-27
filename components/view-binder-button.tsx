"use client"
import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import Link from "next/link"

interface ViewBinderButtonProps {
  userId: string
  username: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  className?: string
}

export default function ViewBinderButton({
  userId,
  username,
  size = "default",
  variant = "default",
  className = "",
}: ViewBinderButtonProps) {
  return (
    <Button size={size} variant={variant} className={className} asChild>
      <Link href={`/binder/${userId}`}>
        <BookOpen className="h-4 w-4 mr-2" />
        View {username}'s Binder
      </Link>
    </Button>
  )
}
