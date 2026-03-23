import Image from 'next/image'
import { ExternalLink, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Support FaB Bazaar',
  description: 'Help keep FaB Bazaar free and running. Support the site on Metafy.',
}

const METAFY_URL = 'https://metafy.gg/@fabbazaar'
const HERO_IMAGE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/RJQHgR66BPnpbtrjQdDCh/public'

export default function MetafyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">

        {/* Card art */}
        <div className="flex-shrink-0 w-64 md:w-72 relative">
          <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full -z-10" />
          <Image
            src={HERO_IMAGE}
            alt="FaB Bazaar hero"
            width={380}
            height={532}
            className="rounded-2xl shadow-2xl w-full h-auto"
            priority
          />
        </div>

        {/* Text */}
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center justify-center md:justify-start gap-2 mb-6">
            <Heart className="w-5 h-5 text-violet-500 dark:text-violet-400" />
            <span className="text-sm font-medium text-violet-500 dark:text-violet-400 uppercase tracking-wide">Support the site</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Support FaB Bazaar
          </h1>

          <p className="text-xl text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
            If you get value out of FaB Bazaar — the collection tools, deck builder, articles,
            or anything else — consider showing your support on Metafy. It goes a long way
            toward keeping the site running and improving.
          </p>

          <p className="text-gray-500 dark:text-gray-400 mb-10">
            No paywalls, no premium tiers. Just a way to say thanks.
          </p>

          <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-700 text-white">
            <a href={METAFY_URL} target="_blank" rel="noopener noreferrer">
              Support on Metafy
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>

      </div>
    </div>
  )
}
