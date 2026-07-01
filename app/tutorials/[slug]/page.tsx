import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Youtube, PlayCircle, GraduationCap, MonitorPlay } from "lucide-react"
import { tutorials } from "@/lib/tutorials-data"
import type { Metadata } from "next"

export function generateStaticParams() {
  return tutorials.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tutorial = tutorials.find((t) => t.slug === slug)
  if (!tutorial) return {}
  return {
    title: `${tutorial.title} Tutorial | FaB Bazaar`,
    description: tutorial.description,
  }
}

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tutorial = tutorials.find((t) => t.slug === slug)

  if (!tutorial) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link
          href="/tutorials"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          All Tutorials
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {tutorial.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {tutorial.description}
          </p>
          {tutorial.videos.length > 0 && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
              <PlayCircle className="h-4 w-4" />
              <span>
                {tutorial.videos.length} {tutorial.videos.length === 1 ? "topic" : "topics"}
              </span>
            </div>
          )}
        </div>

        {tutorial.videos.length > 0 ? (
          <div className="space-y-6">
            {tutorial.videos.map((video, index) => (
              <div
                key={index}
                className="rounded-xl border border-gray-300 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800/60"
              >
                {video.videoId ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.videoId}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                    <div className="text-center">
                      <MonitorPlay className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">Video coming soon</p>
                    </div>
                  </div>
                )}
                <div className="p-5 md:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {video.title}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                        {video.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <GraduationCap className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Coming Soon
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Video tutorials for {tutorial.title.toLowerCase()} are being recorded.
              Check back soon!
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
