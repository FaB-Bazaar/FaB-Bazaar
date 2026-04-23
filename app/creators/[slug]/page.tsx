"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  UserCircle,
  CheckCircle2,
  Globe,
  ShoppingBag,
  Instagram,
  Facebook,
  ExternalLink,
  Package,
} from "lucide-react";
import { customTokenCardsClient } from "@/lib/client";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import type {
  CustomTokenCardCreatorDTO,
  CustomTokenCardDTO,
} from "@/lib/services/contracts/ICustomTokenCardService";

function SocialLink({
  href,
  Icon,
  label,
}: {
  href: string | null;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

export default function CreatorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [creator, setCreator] = useState<CustomTokenCardCreatorDTO | null>(null);
  const [tokenCards, setTokenCards] = useState<CustomTokenCardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomTokenCardDTO | null>(null);

  useEffect(() => {
    (async () => {
      const result = await customTokenCardsClient.getCreatorBySlug(slug);
      if (result.success) {
        setCreator(result.data.creator);
        setTokenCards(result.data.tokenCards);
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();
  }, [slug]);

  const buyUrl = selected?.purchaseUrl || creator?.shopUrl || null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/creators"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 transition-all shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Creators</span>
          </Link>
          <DarkModeToggle />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading creator…</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !creator ? (
          <Alert>
            <AlertTitle>Creator not found</AlertTitle>
          </Alert>
        ) : (
          <>
            {/* Profile header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {creator.avatarUrl ? (
                  <Image
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    width={96}
                    height={96}
                    className="rounded-full shrink-0"
                  />
                ) : (
                  <UserCircle className="h-24 w-24 text-gray-400 dark:text-gray-500 shrink-0" />
                )}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {creator.displayName}
                    </h1>
                    {creator.isVerified && (
                      <CheckCircle2 className="h-5 w-5 text-blue-500" aria-label="Verified" />
                    )}
                  </div>
                  {creator.bio && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {creator.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <SocialLink href={creator.websiteUrl} Icon={Globe} label="Website" />
                    <SocialLink href={creator.shopUrl} Icon={ShoppingBag} label="Shop" />
                    <SocialLink href={creator.instagramUrl} Icon={Instagram} label="Instagram" />
                    <SocialLink href={creator.facebookUrl} Icon={Facebook} label="Facebook" />
                    <SocialLink href={creator.xUrl} Icon={ExternalLink} label="X / Twitter" />
                    <SocialLink href={creator.blueskyUrl} Icon={ExternalLink} label="Bluesky" />
                    <SocialLink href={creator.discordInviteUrl} Icon={ExternalLink} label="Discord" />
                  </div>
                </div>
              </div>
            </div>

            {/* Token cards grid */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Showing {tokenCards.length} published token card{tokenCards.length === 1 ? "" : "s"}
            </p>

            {tokenCards.length === 0 ? (
              <div className="text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
                <Package className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">This creator hasn't published any token cards yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tokenCards.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setSelected(tc)}
                    className="text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-[7/10] bg-gray-100 dark:bg-gray-700 relative">
                      {tc.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tc.imageUrl} alt={tc.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Package className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {tc.name}
                      </p>
                      {tc.linkedCard?.displayName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {tc.linkedCard.displayName}
                        </p>
                      )}
                      {tc.inStock !== null && (
                        <Badge
                          variant="secondary"
                          className={`mt-1 text-xs ${
                            tc.inStock
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {tc.inStock ? "In stock" : "Out of stock"}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                {selected.linkedCard?.displayName && (
                  <DialogDescription>Represents: {selected.linkedCard.displayName}</DialogDescription>
                )}
              </DialogHeader>

              {selected.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.imageUrl} alt={selected.name} className="w-full rounded-md" />
              )}

              {selected.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selected.description}
                </p>
              )}

              {selected.inStock !== null && (
                <Badge
                  variant="secondary"
                  className={`w-fit ${
                    selected.inStock
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {selected.inStock ? "In stock" : "Out of stock"}
                </Badge>
              )}

              <DialogFooter>
                {buyUrl ? (
                  <Button asChild className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
                    <a href={buyUrl} target="_blank" rel="noopener noreferrer">
                      {selected.purchaseUrl ? "Buy this token" : "Visit creator shop"}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button disabled variant="outline">
                    No shop link provided
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
