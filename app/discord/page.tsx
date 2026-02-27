"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  BookOpen,
  Users,
  ArrowLeftRight,
  Info,
  ChevronDown,
  Plus,
  Heart,
  Target,
  Layers
} from 'lucide-react'

export default function DiscordPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const faqs = [
    {
      question: 'Do I need to be in your Discord server to use the bot?',
      answer: 'The bot is currently available in the official FaB Bazaar Discord server. If you\'d like it in your own server, reach out and we can discuss adding it.'
    },
    {
      question: 'Is my collection automatically synced?',
      answer: 'Yes! Any changes you make through Discord sync instantly with your FaB Bazaar account on the website.'
    },
    {
      question: 'Can other people see my commands?',
      answer: 'Most bot responses are "ephemeral," meaning only you can see them. This keeps channels clean and your searches private.'
    },
    {
      question: 'What if I find a bug or have a feature request?',
      answer: 'Drop a message in our Discord\'s feedback channel or use the contact form on the website. We\'re always improving the bot.'
    }
  ]

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#5865F2]/20 via-transparent to-purple-900/20 rounded-2xl p-8 md:p-12 mb-16">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5865F2]/10 rounded-full blur-3xl -z-10" />

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-full px-4 py-2 mb-6">
              <svg className="w-5 h-5 text-[#5865F2] dark:text-[#7983F5]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-sm text-[#5865F2] dark:text-[#7983F5] font-medium">Discord Integration</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Your Collection,<br />
              <span className="text-[#5865F2] dark:text-[#7983F5]">Now in Discord</span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
              Search cards, find trading partners, and manage your binder without ever leaving your server.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
                <a href="https://discord.gg/Rx8eBhhQtk" target="_blank" rel="noopener noreferrer">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join Our Discord
                </a>
              </Button>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
            <Image
              src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/d2d28237-f174-4b23-f2ba-ef5a61d6e900/public"
              alt="Discord bot search command showing card results"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* Feature Overview Section */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Everything You Need, One Slash Away
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Four powerful commands give you instant access to your collection and the FaB Bazaar community.
          </p>
        </div>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="search">/search</TabsTrigger>
            <TabsTrigger value="binder">/binder</TabsTrigger>
            <TabsTrigger value="wants">/wants</TabsTrigger>
            <TabsTrigger value="trade">/trade</TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <code className="text-sm text-[#5865F2] dark:text-[#7983F5] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  /search &lt;card name&gt;
                </code>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-3">Find Any Card Instantly</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Looking for a Cold Foil Command and Conquer? Type <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/search command and conquer</code> and see every printing in the database. Each result comes with action buttons to add the card to your binder, add it to your wants list, or find out who owns it.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  See all printings with set, edition, and foiling details. Check current market prices. Add to your collection or wants list with one click.
                </p>
              </div>
              <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden">
                <Image
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/d2d28237-f174-4b23-f2ba-ef5a61d6e900/public"
                  alt="Discord search command showing card results with action buttons"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="binder">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <code className="text-sm text-[#5865F2] dark:text-[#7983F5] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  /binder [username]
                </code>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-3">Browse Any Collection</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Check your own binder or peek at what someone else has. Running <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/binder</code> shows your collection organized by binder, while <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/binder @username</code> lets you see what a trading partner has available. Perfect for checking inventory before proposing a trade.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Switch between multiple binders. Paginated results for large collections. See card details including condition and quantity.
                </p>
              </div>
              <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden">
                <Image
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/bcbb7986-fe1b-4446-ee98-c775cfe8b700/public"
                  alt="Discord binder command showing paginated collection"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="wants">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <code className="text-sm text-[#5865F2] dark:text-[#7983F5] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  /wants &lt;username&gt;
                </code>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-3">See What People Need</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Every trader has a wishlist. Use <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/wants @username</code> to see exactly what cards someone is looking for, complete with their preferred printings. Found something they need in your collection? You just found a trade.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  View prioritized wants lists. See specific printing preferences. Navigate large lists with pagination.
                </p>
              </div>
              <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden">
                <Image
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/a01ac0e6-2c69-4f0f-030d-5d73463bd000/public"
                  alt="Discord wants command showing user's want list"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trade">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <code className="text-sm text-[#5865F2] dark:text-[#7983F5] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  /trade &lt;username&gt;
                </code>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-3">Find Mutual Matches</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  This is where the magic happens. Run <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/trade @username</code> and the bot analyzes both collections instantly. You'll see every card you have that they want, and every card they have that you want. No more spreadsheets, no more cross-referencing—just matches.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Instant two-way analysis. Shows exact printings that match. Makes negotiating trades effortless.
                </p>
              </div>
              <div className="relative w-full aspect-video bg-gray-800 dark:bg-gray-900 rounded-lg overflow-hidden">
                <Image
                  src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/911b03e3-736d-4199-4f54-1263ebb2ef00/public"
                  alt="Discord wants command showing user's want list"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions Section */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Right-Click Trading
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Don't want to type? Right-click any user in Discord and access their collection.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Show Binder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Right-click → Apps → Show Binder. Instantly view any user's collection without typing a command. Great for quick checks during trade negotiations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-amber-500 dark:hover:border-amber-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Heart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Show Wants List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                See what someone needs in two clicks. Spot an opportunity? Start a conversation.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Card Actions Section */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            One Search, Four Actions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Every card you find comes with instant action buttons.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
                <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Add to Binder
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 dark:text-gray-300">
              Found a card you just picked up? Hit the button, select your binder, and it's in your collection.
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
                <Heart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Add to Wants
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 dark:text-gray-300">
              Tracking down a specific printing? Add it to your wants list so other traders know you're looking.
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Who Has?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 dark:text-gray-300">
              The fastest way to find a card. See every FaB Bazaar user who owns that printing.
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-amber-500 dark:hover:border-amber-400 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Who Wants?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 dark:text-gray-300">
              Got extras? See who's looking for the card you're viewing. It's like having a buyer list in your pocket.
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Ready in 30 Seconds
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex gap-6 items-start">
            <div className="text-4xl font-bold text-[#5865F2]/30 dark:text-[#7983F5]/30">01</div>
            <div className="flex-1 pt-2">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Join the Discord</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                Head to our Discord server where the bot lives. You'll get access to trading channels, price discussions, and the bot.
              </p>
              <Button asChild size="sm" className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
                <a href="https://discord.gg/Rx8eBhhQtk" target="_blank" rel="noopener noreferrer">
                  Join Discord Server
                </a>
              </Button>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="text-4xl font-bold text-[#5865F2]/30 dark:text-[#7983F5]/30">02</div>
            <div className="flex-1 pt-2">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Start Using Commands</h3>
              <p className="text-gray-600 dark:text-gray-300">
                That's it! Your FaB Bazaar account is already linked via Discord. Type <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">/search</code> in any channel where the bot is active and you're ready to go.
              </p>
            </div>
          </div>
        </div>

        <Alert className="mt-8 border-[#5865F2]/30 bg-[#5865F2]/10 dark:bg-[#5865F2]/20">
          <Info className="h-4 w-4 text-[#5865F2] dark:text-[#7983F5]" />
          <AlertDescription className="text-gray-700 dark:text-gray-300">
            <strong>Want the bot in your own server?</strong> If you run a local playgroup or store Discord, contact us to get started.
          </AlertDescription>
        </Alert>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Questions?
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <Card key={i} className="border-2 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(i)}
                className="w-full text-left p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 pr-4">{faq.question}</h3>
                  <ChevronDown className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${expandedFaq === i ? 'rotate-180' : ''}`} />
                </div>
                {expandedFaq === i && (
                  <p className="mt-3 text-gray-600 dark:text-gray-300">{faq.answer}</p>
                )}
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="text-center py-16 bg-gradient-to-br from-[#5865F2]/10 to-purple-900/10 dark:from-[#5865F2]/20 dark:to-purple-900/20 rounded-2xl">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Ready to Trade Smarter?
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
          Join hundreds of FaB players who manage their collections right from Discord.
        </p>
        <Button asChild size="lg" className="bg-[#5865F2] hover:bg-[#4752C4] text-white">
          <a href="https://discord.gg/Rx8eBhhQtk" target="_blank" rel="noopener noreferrer">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Our Discord
          </a>
        </Button>
      </div>
    </div>
  )
}
