import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProfileLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="h-24 w-24 rounded-full bg-muted animate-pulse"></div>
            <div className="flex-1">
              <CardTitle className="h-8 w-48 bg-muted animate-pulse rounded mb-4"></CardTitle>
              <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-10 w-full bg-muted animate-pulse rounded"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
