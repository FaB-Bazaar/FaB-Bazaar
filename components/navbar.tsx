"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Menu,
  X,
  Plus,
  User,
  LogOut,
  BookOpen,
  ChevronDown,
  FileText,
  Trophy,
  MapPin,
  Bot,
  Search,
  Copy,
  Check,
  Upload,
  ExternalLink,
  ArrowLeftRight,
  Send,
  Inbox,
  Users,
  Clock,
  Star,
  Info,
  Layers,
  GraduationCap,
  Link2,
  Pin,
  TrendingUp,
  Shield,
  Tags,
  ListChecks,
  Ban,
  Swords,
  UserCog,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { accessibleAdminLinks } from "@/components/nav/admin-links"
import { canUseVolzar } from "@/lib/ai/volzar-access"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DarkModeToggle } from '@/components/DarkModeToggle'
import MobileSearch from '@/components/search/MobileSearch'
import MobileTabBar from '@/components/navbar/MobileTabBar'
import { profileHref, displayUsername } from '@/lib/utils/display-username'
import { handleSignOut } from "@/app/actions/auth"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [binders, setBinders] = useState<any[]>([])
  const [bindersHasPinned, setBindersHasPinned] = useState(true)
  const [bindersLoading, setBindersLoading] = useState(false)
  const [decks, setDecks] = useState<any[]>([]) // DECKS-FEATURE
  const [decksHasPinned, setDecksHasPinned] = useState(true)
  const [decksLoading, setDecksLoading] = useState(false) // DECKS-FEATURE
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [mobileCollectionExpanded, setMobileCollectionExpanded] = useState(false)
  const [mobileDecksExpanded, setMobileDecksExpanded] = useState(false) // DECKS-FEATURE
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isProfileLinkCopied, setIsProfileLinkCopied] = useState(false);
  const [decksLoaded, setDecksLoaded] = useState(false) // DECKS-FEATURE
  const [bindersLoaded, setBindersLoaded] = useState(false)
  const [navDeckSort, setNavDeckSort] = useState<'updated' | 'name' | 'created'>('updated')
  const [followedStores, setFollowedStores] = useState<any[]>([])
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesLoaded, setStoresLoaded] = useState(false)

  // Check for URL parameters to auto-open search
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('openSearch') === 'true') {
      const query = urlParams.get('query') || ''
      setSearchQuery(query)
      setIsMobileSearchOpen(true)
      // Clean up the URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('openSearch')
      newUrl.searchParams.delete('query')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [])
  


  /* DECKS-FEATURE: Commented out deck loading logic */
  const loadDecksOnDemand = () => {
    if (decksLoaded || decksLoading || !user) return
    
    setDecksLoading(true)
    
    fetch("/api/decks/user?limit=5&pinned=true")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDecks(data.decks || [])
          setDecksHasPinned(Boolean(data.hasPinned))
        } else {
          setDecks([])
          setDecksHasPinned(false)
        }
        setDecksLoaded(true)
        setDecksLoading(false)
      })
      .catch(() => {
        setDecks([])
        setDecksHasPinned(false)
        setDecksLoaded(true)
        setDecksLoading(false)
      })
  }
  

  const loadStoresOnDemand = () => {
    if (storesLoaded || storesLoading || !user) return
    setStoresLoading(true)
    fetch('/api/stores/followed')
      .then(res => res.json())
      .then(data => {
        setFollowedStores(data.success ? (data.stores || []) : [])
        setStoresLoaded(true)
        setStoresLoading(false)
      })
      .catch(() => {
        setFollowedStores([])
        setStoresLoaded(true)
        setStoresLoading(false)
      })
  }

  const loadBindersOnDemand = () => {
    if (bindersLoaded || bindersLoading || !user) return
  
    setBindersLoading(true)
  
    fetch('/api/binders?summary=true&limit=5&pinned=true')
      .then(res => res.json())
      .then(data => {
        setBinders(data.binders || [])
        setBindersHasPinned(Boolean(data.hasPinned))
        setBindersLoaded(true)
        setBindersLoading(false)
      })
      .catch(() => {
        setBinders([])
        setBindersHasPinned(false)
        setBindersLoaded(true)
        setBindersLoading(false)
      })
  }


  useEffect(() => {
    if (!user) return

    const handleBindersUpdate = () => {
      fetch('/api/binders?summary=true&limit=5&pinned=true')
        .then(res => res.json())
        .then(data => {
          setBinders(data.binders || [])
          setBindersHasPinned(Boolean(data.hasPinned))
        })
        .catch((error) => {
          console.error('[Navbar] Failed to refresh binders:', error)
        })
    }

    /* DECKS-FEATURE: Commented out deck update logic */
    const handleDecksUpdate = () => {
      fetch("/api/decks/user?limit=5&pinned=true")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setDecks(data.decks || [])
            setDecksHasPinned(Boolean(data.hasPinned))
          } else {
            console.error('[Navbar] Decks refresh failed:', data.error)
            setDecks([])
            setDecksHasPinned(false)
          }
        })
        .catch((error) => {
          console.error('[Navbar] Failed to refresh decks:', error)
          setDecks([])
          setDecksHasPinned(false)
        })
    }
    

    window.addEventListener('bindersUpdated', handleBindersUpdate)
    window.addEventListener('binderCreated', handleBindersUpdate)
    window.addEventListener('binderDeleted', handleBindersUpdate)
    
    /* DECKS-FEATURE: Commented out deck event listeners */
    window.addEventListener('decksUpdated', handleDecksUpdate)
    window.addEventListener('deckCreated', handleDecksUpdate)
    window.addEventListener('deckDeleted', handleDecksUpdate)

    return () => {
      window.removeEventListener('bindersUpdated', handleBindersUpdate)
      window.removeEventListener('binderCreated', handleBindersUpdate)
      window.removeEventListener('binderDeleted', handleBindersUpdate)
      /* DECKS-FEATURE: Commented out deck event listener cleanup */
      window.removeEventListener('decksUpdated', handleDecksUpdate)
      window.removeEventListener('deckCreated', handleDecksUpdate)
      window.removeEventListener('deckDeleted', handleDecksUpdate)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setBinders([])
      setDecks([]) // DECKS-FEATURE
      setDecksLoaded(false) // DECKS-FEATURE
      setBindersLoaded(false)
      setFollowedStores([])
      setStoresLoaded(false)
      return
    }

  }, [user])

  const handleMobileMenuToggle = () => {
    const newMenuState = !isMenuOpen;
    setIsMenuOpen(newMenuState);
    
    if (newMenuState && user) {
      loadBindersOnDemand();
      loadDecksOnDemand(); // DECKS-FEATURE
    }
  }

  const isActive = (path: string) => pathname === path

  const copySlugToClipboard = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(slug)
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = slug
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(null), 2000)
    }
  }

  const handleLogout = async () => {
    setIsMenuOpen(false)
    try {
      console.log("Starting logout process...")
      await handleSignOut()
      console.log("Auth.js v5 signOut completed successfully")
    } catch (error) {
      console.error("Auth.js logout failed:", error)
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
        window.location.reload()
      } catch (fallbackError) {
        console.error("Fallback logout also failed:", fallbackError)
        window.location.reload()
      }
    }
  }

  const handleCopyProfileLink = async () => {
    if (!user?.username) return;
    const profileUrl = `https://fabbazaar.app${profileHref(user.username)}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setIsProfileLinkCopied(true);
      setTimeout(() => setIsProfileLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy profile link:", err);
    }
  };

  const renderAuthButtons = () => {
    if (user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <User className="h-4 w-4 mr-2" />
              {user?.username || "User"}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
            <DropdownMenuItem asChild>
              <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  <User className="h-4 w-4 mr-2" />
                  View Profile
                </div>
              </Link>
            </DropdownMenuItem>
            {user?.username && (
              <DropdownMenuItem asChild>
                <Link
                  href={profileHref(user.username)}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Public Profile
                  </div>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/profile/connected-accounts" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  <Link2 className="h-4 w-4 mr-2" />
                  Connected Accounts
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/mcp-integration" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  <Bot className="h-4 w-4 mr-2" />
                  MCP Integration
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/metafy" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400">
                <div className="flex items-center text-sm font-medium text-violet-600 dark:text-violet-400">
                  <Trophy className="h-4 w-4 mr-2" />
                  Support FaB Bazaar
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/about" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  <Info className="h-4 w-4 mr-2" />
                  About
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/terms-of-service" onClick={() => setIsMenuOpen(false)} className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                  <FileText className="h-4 w-4 mr-2" />
                  Terms of Service
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
            <DropdownMenuItem className="cursor-pointer text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium">Theme</span>
                <DarkModeToggle />
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    } else {
      return (
        <Link href="/auth/login">
          <Button variant="outline" size="sm" className="flex items-center border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="discord" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
              <path fill="currentColor" d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6a447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83a1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"></path>
            </svg>
            Login with Discord
          </Button>
        </Link>
      )
    }
  }

  const renderCollectionDropdown = () => {
    if (!user) {
      return (
        <Link
          href="/collection"
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/collection") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
        >
          <BookOpen className="h-4 w-4 inline mr-1" />
          Your Collection
        </Link>
      )
    }

    return (
      <DropdownMenu onOpenChange={(open) => open && loadBindersOnDemand()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/collection") || pathname.startsWith("/binder/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
          >
            Your Collection
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          <DropdownMenuItem asChild>
            <Link href="/collection" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <BookOpen className="h-4 w-4 mr-2" />
              View All Binders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/playmats" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Layers className="h-4 w-4 mr-2" />
              Collectibles
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wants" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <FileText className="h-4 w-4 mr-2" />
              Wants List
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/daily" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <TrendingUp className="h-4 w-4 mr-2" />
              Daily Movers
            </Link>
          </DropdownMenuItem>

          {binders.length > 0 && <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />}

          {!bindersLoading && !bindersHasPinned && binders.length > 0 && (
            <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">
              Showing your most recent binders.{' '}
              <Link href="/collection" className="text-blue-600 dark:text-blue-400 hover:underline">
                Pin binders
              </Link>{' '}
              to choose what appears here.
            </div>
          )}

          {bindersLoading ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading binders...</span>
            </DropdownMenuItem>
          ) : binders.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">No binders yet</span>
            </DropdownMenuItem>
          ) : (
            binders.map((binder) => {
              const slug = binder.slug || binder.discordExternalId
              return (
                <div key={binder._id} className="relative">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/binder/${binder._id}`}
                      className="w-full pr-8 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {binder.name}
                        </span>
                        {slug && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {slug}
                          </span>
                        )}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  {slug && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-600 z-10"
                      onClick={(e) => copySlugToClipboard(slug, e)}
                      title={`Copy slug: ${slug}`}
                    >
                      {copiedSlug === slug ? (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  /* DECKS-FEATURE: Desktop dropdown for Your Decks */
  const renderDecksDropdown = () => {
    if (!user) {
      return (
        <Link
          href="/decks"
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/decks") || pathname.startsWith("/decks/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
        >
          <Layers className="h-4 w-4 inline mr-1" />
          Your Decks
        </Link>
      )
    }

    return (
      <DropdownMenu onOpenChange={(open) => open && loadDecksOnDemand()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/decks") || pathname.startsWith("/decks/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
          >
            Your Decks
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          <DropdownMenuItem asChild>
            <Link href="/decks" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Layers className="h-4 w-4 mr-2" />
              View Your Decks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/decks?create=true" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Plus className="h-4 w-4 mr-2" />
              New Deck
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/decks/community" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Users className="h-4 w-4 mr-2" />
              Community Decks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/decks/to-beat" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Trophy className="h-4 w-4 mr-2" />
              Decks to Beat
            </Link>
          </DropdownMenuItem>

          {decks.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
              {!decksHasPinned && (
                <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">
                  Showing your most recent decks.{' '}
                  <Link href="/decks" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Pin decks
                  </Link>{' '}
                  to choose what appears here.
                </div>
              )}
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{decksHasPinned ? 'Pinned decks' : 'Recent decks'}</span>
                <select
                  value={navDeckSort}
                  onChange={(e) => setNavDeckSort(e.target.value as typeof navDeckSort)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none cursor-pointer"
                >
                  <option value="updated">Last updated</option>
                  <option value="created">Date created</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </>
          )}

          {decksLoading ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading decks...</span>
            </DropdownMenuItem>
          ) : decks.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">No decks yet</span>
            </DropdownMenuItem>
          ) : (
            [...decks]
              .sort((a, b) => {
                if (navDeckSort === 'name') return a.name.localeCompare(b.name)
                if (navDeckSort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              })
              .map((deck) => {
                const heroName = deck.hero && Array.isArray(deck.hero) && deck.hero.length > 0
                  ? deck.hero[0]?.printingDetails?.display_name || deck.hero[0]?.printingId
                  : null

                return (
                  <DropdownMenuItem key={deck._id || deck.publicId} asChild>
                    <Link
                      href={`/decks/${deck.publicId}`}
                      className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {deck.name}
                        </span>
                        {heroName && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {heroName}
                          </span>
                        )}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )
              })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  /* Your Stores dropdown */
  const renderStoresDropdown = () => {
    if (!user) return null

    return (
      <DropdownMenu onOpenChange={(open) => open && loadStoresOnDemand()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/stores") || pathname.startsWith("/stores/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Your Stores
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          <DropdownMenuItem asChild>
            <Link href="/stores" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
              <MapPin className="h-4 w-4 mr-2" />
              Browse Stores
            </Link>
          </DropdownMenuItem>

          {followedStores.length > 0 && (
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
          )}

          {storesLoading ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading stores...</span>
            </DropdownMenuItem>
          ) : followedStores.length === 0 && storesLoaded ? (
            <DropdownMenuItem disabled>
              <span className="text-sm text-gray-500 dark:text-gray-400">No followed stores yet</span>
            </DropdownMenuItem>
          ) : (
            followedStores.map((store) => (
              <DropdownMenuItem key={store.id} asChild>
                <Link
                  href={`/stores/${store.id}`}
                  className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{store.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {[store.addressCity, store.addressState].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  /* Admin dropdown — desktop only, shown only to users with an admin role.
     Lists the admin pages the current user is allowed to open. */
  const adminIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    "/admin/articles": FileText,
    "/admin/card-facets": Tags,
    "/admin/curation": ListChecks,
    "/admin/banned-cards": Ban,
    "/admin/heroes": Swords,
    "/admin/sets": Layers,
    "/admin/locations": MapPin,
    "/admin/image-uploads": Upload,
    "/admin/user-access": UserCog,
  }

  const renderAdminDropdown = () => {
    const links = accessibleAdminLinks(user)
    if (links.length === 0) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${pathname.startsWith("/admin") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
          >
            <Shield className="h-4 w-4 mr-1" />
            Admin
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          {links.map((link) => {
            const Icon = adminIcons[link.href] ?? Shield
            return (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href} className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Icon className="h-4 w-4 mr-2" />
                  {link.label}
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <header className="bg-page dark:bg-gray-800 border-b dark:border-gray-600 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <div className="relative h-8 w-8 mr-2">
                  <Image src="/android-chrome-192x192.png" alt="FaB Bazaar Logo" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">FaB Bazaar</span>
              </Link>
            </div>

            {/* Desktop Navigation - Goodreads Style */}
            <nav className="hidden md:flex items-center flex-1 max-w-2xl mx-8">
              {/* Search removed - use user menu for Power Search */}
            </nav>

            {/* Desktop Menus */}
            <nav className="hidden md:flex items-center space-x-1">
              {/* Search Link */}
              <Link
                href="/opt"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/opt") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
              >
                <Search className="h-4 w-4 inline mr-1" />
                Search
              </Link>

              {/* Sets Link */}
              <Link
                href="/sets"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/sets") || pathname.startsWith("/sets/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
              >
                Sets
              </Link>

              {/* My Collection Dropdown */}
              {renderCollectionDropdown()}

              {/* Your Decks Dropdown */}
              {renderDecksDropdown()}

              {/* Your Stores Dropdown */}
              {renderStoresDropdown()}

              {/* Articles Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/guides") || isActive("/my-articles") || pathname.startsWith("/my-articles/") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Articles
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                  <DropdownMenuItem asChild>
                    <Link href="/guides" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <FileText className="h-4 w-4 mr-2" />
                      Browse Articles
                    </Link>
                  </DropdownMenuItem>
                  {user && (
                    <DropdownMenuItem asChild>
                      <Link href="/my-articles" className="w-full text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <FileText className="h-4 w-4 mr-2" />
                        My Articles
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tutorials - Standalone Link */}
              <Link
                href="/tutorials"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/tutorials") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
              >
                Tutorials
              </Link>

              {/* Tags - Standalone Link (public community card-facets browse) */}
              <Link
                href="/tags"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/tags") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
              >
                <Tags className="h-4 w-4 inline mr-1" />
                Tags
              </Link>

              {/* Admin Dropdown - desktop only, admins only */}
              {renderAdminDropdown()}

              {/* Discord - Standalone Link */}
              <Link
                href="/discord"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/discord") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
              >
                <svg className="h-4 w-4 inline mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord
              </Link>

              {/* About - Standalone Link (only for non-logged-in users) */}
              {!user && (
                <Link
                  href="/about"
                  className={`px-3 py-2 mr-4 text-sm font-medium rounded-md transition-colors duration-200 ${isActive("/about") ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"}`}
                >
                  <Info className="h-4 w-4 inline mr-1" />
                  About
                </Link>
              )}
            </nav>

            {/* Right side - Profile or Signup */}
            <div className="hidden md:flex items-center space-x-2 ml-4">
              {user ? (
                <DropdownMenu onOpenChange={(open) => { if (open) { loadBindersOnDemand(); loadDecksOnDemand(); } }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="!p-0 w-10 h-10 rounded-full hover:bg-transparent">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.username || 'User'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-semibold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
                          {user.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                    <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{displayUsername(user.username)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    {canUseVolzar(user) && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/volzar" className="text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400">
                            {/* Volzar, the Lightning Rod card art — same mark as the /volzar page header */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/volzar-icon.png"
                              alt=""
                              aria-hidden="true"
                              className="h-5 w-5 mr-2 rounded-full object-cover ring-1 ring-violet-400/50"
                            />
                            <span className="font-semibold text-violet-600 dark:text-violet-400">Volzar</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                        <User className="h-4 w-4 mr-2" />
                        View Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/connected-accounts" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                        <Link2 className="h-4 w-4 mr-2" />
                        Connected Accounts
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                    <DropdownMenuItem asChild>
                      <Link href="/browse" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                        <Plus className="h-4 w-4 mr-2" />
                        Bulk Imports
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/mcp-integration" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                        <Bot className="h-4 w-4 mr-2" />
                        MCP Integration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/metafy" className="text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400">
                        <Trophy className="h-4 w-4 mr-2 text-violet-500 dark:text-violet-400" />
                        Support FaB Bazaar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/about" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                        <Info className="h-4 w-4 mr-2" />
                        About
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                    <DropdownMenuItem className="cursor-pointer text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-medium">Theme</span>
                        <DarkModeToggle />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/signup">
                  <Button variant="ghost" size="sm" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <User className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile - Right Side */}
            <div className="md:hidden flex items-center gap-2">
              {user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMobileMenuToggle}
                  className="!p-0 w-10 h-10 rounded-full hover:bg-transparent"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.username || 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-semibold text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
                      {user.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </Button>
              ) : (
                <Link href="/signup">
                  <Button variant="ghost" size="sm" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <User className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation - Goodreads Style (not an overlay) */}
        {isMenuOpen && (
          <div className="md:hidden border-t dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="container mx-auto px-4 py-2">
              {/* Simplified Mobile Menu - Goodreads Style */}
              <div className="space-y-1 py-2">
                {/* Search */}
                <button
                  onClick={() => { setIsMobileSearchOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Search className="h-5 w-5 mr-3" />
                  Search
                </button>

                {/* Sets / Articles / Tutorials / Discord / Bulk Imports are
                    deliberately desktop-only (2026-07-12): the mobile menu
                    keeps just the high-frequency destinations. */}

                {/* My Collection - Expandable */}
                <div>
                  <button
                    onClick={() => { loadBindersOnDemand(); setMobileCollectionExpanded(!mobileCollectionExpanded); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 mr-3" />
                      My Collection
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileCollectionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileCollectionExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 py-1">
                      <Link href="/collection" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">View All Binders</div>
                      </Link>
                      <Link href="/playmats" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Collectibles</div>
                      </Link>
                      <Link href="/wants" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Wants List</div>
                      </Link>
                      <Link href="/daily" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Daily Movers</div>
                      </Link>
                      {bindersLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                      ) : binders.length > 0 ? (
                        binders.slice(0, 3).map((binder) => (
                          <Link key={binder._id} href={`/binder/${binder._id}`} onClick={() => setIsMenuOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 truncate">
                              {binder.name}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No binders yet</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Your Decks - Expandable */}
                <div>
                  <button
                    onClick={() => { loadDecksOnDemand(); setMobileDecksExpanded(!mobileDecksExpanded); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center">
                      <Layers className="h-5 w-5 mr-3" />
                      Your Decks
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileDecksExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileDecksExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 py-1">
                      <Link href="/decks" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">View Your Decks</div>
                      </Link>
                      <Link href="/decks/community" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Community Decks</div>
                      </Link>
                      <Link href="/decks/to-beat" onClick={() => setIsMenuOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Decks to Beat</div>
                      </Link>
                      {decksLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                      ) : decks.length > 0 ? (
                        decks.slice(0, 3).map((deck) => (
                          <Link key={deck._id || deck.publicId} href={`/decks/${deck.publicId}`} onClick={() => setIsMenuOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 truncate">
                              {deck.name}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No decks yet</div>
                      )}
                    </div>
                  )}
                </div>

                {/* About - Standalone Link (only for non-logged-in users) */}
                {!user && (
                  <Link href="/about" onClick={() => setIsMenuOpen(false)}>
                    <div className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Info className="h-5 w-5 mr-3" />
                      About
                    </div>
                  </Link>
                )}
              </div>

              {/* User Profile Section */}
              {user && (
                <div className="border-t dark:border-gray-700 py-2">
                  {canUseVolzar(user) && (
                    <Link href="/volzar" onClick={() => setIsMenuOpen(false)}>
                      <div className="flex items-center px-3 py-2.5 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                        {/* Volzar, the Lightning Rod card art — same mark as the /volzar page header */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/volzar-icon.png"
                          alt=""
                          aria-hidden="true"
                          className="h-6 w-6 mr-3 rounded-full object-cover ring-1 ring-violet-400/50"
                        />
                        Volzar
                      </div>
                    </Link>
                  )}
                  <Link href="/profile" onClick={() => setIsMenuOpen(false)}>
                    <div className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <User className="h-5 w-5 mr-3" />
                      Profile
                    </div>
                  </Link>
                  <div className="border-t dark:border-gray-700 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

     <MobileSearch
       isOpen={isMobileSearchOpen}
       onClose={() => {
         setIsMobileSearchOpen(false)
         setSearchQuery('')
       }}
       defaultQuery={searchQuery}
     />

     <MobileTabBar
       user={user}
       binders={binders}
       bindersLoading={bindersLoading}
       bindersHasPinned={bindersHasPinned}
       loadBindersOnDemand={loadBindersOnDemand}
       decks={decks}
       decksLoading={decksLoading}
       decksHasPinned={decksHasPinned}
       loadDecksOnDemand={loadDecksOnDemand}
       navDeckSort={navDeckSort}
       setNavDeckSort={setNavDeckSort}
     />
   </>
 )
}