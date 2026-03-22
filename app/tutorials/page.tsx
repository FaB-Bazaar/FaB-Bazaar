import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Layers, Search, LayoutGrid, Swords, PlayCircle, GraduationCap } from "lucide-react"
import { tutorials } from "@/lib/tutorials-data"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tutorials | FaB Bazaar",
  description: "Learn how to use FaB Bazaar with short video tutorials covering collection management, card search, deck building, and more.",
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  Search,
  LayoutGrid,
  Swords,
}

export default function TutorialsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GraduationCap className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Tutorials
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Short video guides to help you get the most out of FaB Bazaar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tutorials.map((tutorial) => {
            const Icon = iconMap[tutorial.icon] || Layers
            const hasVideos = tutorial.videos.length > 0

            return (
              <Link key={tutorial.slug} href={`/tutorials/${tutorial.slug}`}>
                <Card className="h-full border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        {tutorial.title}
                      </CardTitle>
                      {hasVideos ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <PlayCircle className="h-3 w-3" />
                          {tutorial.videos.length} {tutorial.videos.length === 1 ? "video" : "videos"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          Coming soon
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300">
                      {tutorial.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
