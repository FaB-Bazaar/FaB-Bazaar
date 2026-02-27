"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface MatchRateDisplayProps {
  userId: string
  userName: string
}

interface MatchRateData {
  currentUserHasTargetWantsRate: number
  targetUserHasCurrentUserWantsRate: number
  matchCounts?: {
    youHaveTheirWants: number
    theyHaveYourWants: number
    totalTheirWants: number
    totalYourWants: number
  }
}

export default function MatchRateDisplay({ userId, userName }: MatchRateDisplayProps) {
  const [matchData, setMatchData] = useState<MatchRateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMatchRate = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/users/match-rate?userId=${userId}`)

        if (!response.ok) {
          throw new Error("Failed to fetch match rate")
        }

        const data = await response.json()

        if (data.success) {
          setMatchData(data)
        } else {
          setError(data.error || "Failed to fetch match rate")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchMatchRate()
    }
  }, [userId])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Calculating trade match...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-red-500 p-4">Error loading match rate: {error}</div>
        </CardContent>
      </Card>
    )
  }

  if (!matchData) {
    return null
  }

  const { currentUserHasTargetWantsRate, targetUserHasCurrentUserWantsRate, matchCounts } = matchData

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Trade Match Analysis</h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">
                You have {matchCounts ? `${matchCounts.youHaveTheirWants}/${matchCounts.totalTheirWants}` : ""} of{" "}
                {userName}'s wants
              </span>
              <span className="text-sm font-medium">{currentUserHasTargetWantsRate.toFixed(1)}%</span>
            </div>
            <Progress value={currentUserHasTargetWantsRate} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">
                {userName} has {matchCounts ? `${matchCounts.theyHaveYourWants}/${matchCounts.totalYourWants}` : ""} of
                your wants
              </span>
              <span className="text-sm font-medium">{targetUserHasCurrentUserWantsRate.toFixed(1)}%</span>
            </div>
            <Progress value={targetUserHasCurrentUserWantsRate} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
