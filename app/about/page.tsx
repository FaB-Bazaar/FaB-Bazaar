"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Layers,
  Heart,
  MapPin,
  Users,
  Shield,
  TrendingUp,
  ArrowRight,
  Bot,
  Code,
  MessageCircle,
  CheckCircle,
  Trophy,
  Zap
} from "lucide-react"
export default function AboutPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full opacity-30 z-0">
        <img
          src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/9db6013d-6684-4ee4-bfb7-330b1c23a300/public"
          alt="FaB Bazaar Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Background overlay */}
      <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/85 backdrop-blur-sm z-0"></div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            About FaB Bazaar
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            The community-driven platform connecting Flesh and Blood traders worldwide
          </p>
        </div>

        {/* Mission Statement */}
        <Card className="mb-12 border-2">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              Why FaB Bazaar Exists
            </CardTitle>
          </CardHeader>
          <CardContent className="text-gray-700 dark:text-gray-300 space-y-4">
            <p className="text-lg font-medium">
              Born from frustration with spreadsheets and clunky tools that nobody sticks with.
            </p>

            <div className="space-y-3">
              <p>I kept seeing the same pattern:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Repetitive "looking for X" posts cluttering Discord and Facebook</li>
                <li>Manual checking of who has what, every single time</li>
                <li>General lack of trust when trading with strangers</li>
                <li>Digital tools that were supposed to help, but got in the way</li>
              </ul>
            </div>

            <p>
              FaB Bazaar bridges the gap. It's 2026. Your collection shouldn't live in a spreadsheet.
              Manage it via Discord bot, AI assistant, or web. Whatever works for you.
            </p>

            <p className="text-lg font-medium">
              The goal: <strong>help you finish your deck or complete that collection</strong>. Everything else is just getting you there faster.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Trade-only, always.</strong> Sales are not permitted. We focus on connecting traders, not facilitating transactions.
                All trades carry the same risks as trading on Facebook or Discord. We just make it easier to match you with people who have the cards you need.
                Meet at your local game store whenever possible.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Local Trading */}
        <Card className="mb-12 border-2 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <MapPin className="h-6 w-6 text-red-600 dark:text-red-400" />
              Find Your Local Community
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              The best trades happen in person. FaB Bazaar helps you connect with the people you already play with.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Discover Local Stores</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Find game stores near you and see which traders visit them
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Connect with Your Playgroup</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    See what cards the people you play with have and need
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Features */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Collection Management
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Organize your cards in digital binders with automatic pricing updates,
                  rarity tracking, and detailed statistics.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Want Lists
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Create detailed want lists with priority levels and get instant notifications
                  when traders near you have what you need.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-red-500 dark:hover:border-red-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-red-600 dark:text-red-400" />
                  Local Discovery
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Find traders, stores, and events in your area. See who has the cards
                  you need nearby for safe, in-person trading.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-green-500 dark:hover:border-green-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Trade Matching
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Our intelligent matching system automatically finds traders who have
                  your wants and want your haves.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-orange-500 dark:hover:border-orange-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Safe Trading
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Digital trade workflow tracking helps coordinate trades safely.
                  We encourage in-store trading for added security.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-teal-500 dark:hover:border-teal-400 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Daily TCGPlayer Price Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-300">
                <p>
                  Daily TCGPlayer market data keeps your collection values
                  up-to-date automatically.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <CardTitle className="text-lg">Sign Up</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-300">
                Create your free account using Discord OAuth
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">2</span>
                </div>
                <CardTitle className="text-lg">Build Binder</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-300">
                Add your collection with bulk import or manual entry
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">3</span>
                </div>
                <CardTitle className="text-lg">Create Wants</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-300">
                List cards you're looking for with priority levels
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">4</span>
                </div>
                <CardTitle className="text-lg">Find Matches</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-300">
                Discover traders near you with matching wants/haves
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">5</span>
                </div>
                <CardTitle className="text-lg">Trade Safely</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-300">
                Connect and complete trades at local stores
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Technology & Integrations */}
        <Card className="mb-12 border-2">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              Technology & Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Discord Bot</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your collection directly from Discord with our integrated bot
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Code className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">MCP Integration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Connect with AI assistants like Claude via Model Context Protocol
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </main>
  )
}
