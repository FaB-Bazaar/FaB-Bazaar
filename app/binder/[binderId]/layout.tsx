import type { Metadata } from "next"
import { binderService, userService } from "@/lib/services"

export async function generateMetadata({ params }: { params: Promise<{ binderId: string }> }): Promise<Metadata> {
  const { binderId } = await params;

  const fallback: Metadata = {
    title: "Trade Binder - FaB Card Collection Management",
    description: "Manage your Flesh and Blood trade binder. View cards, track values, set trade status, and organize your collection.",
  };

  try {
    const binderResult = await binderService.findBinderByIdOrSlug(binderId);
    if (!binderResult.success || !binderResult.data) return fallback;

    const binder = binderResult.data;

    if (binder.visibility?.level === 'private' && !binder.isPublic) return fallback;

    const userResult = await userService.findById(binder.userId);
    const ownerName = userResult.success && userResult.data?.username
      ? userResult.data.username
      : "User";

    const binderName = binder.name || "Trade Binder";
    const description = binder.description || `Browse ${ownerName}'s Flesh and Blood trade binder. View cards, values, and trade availability.`;
    const baseUrl = process.env.NEXTAUTH_URL || 'https://fabbazaar.app';
    const binderUrl = `${baseUrl}/binder/${binderId}`;
    const ogImage = binder.thumbnailPrintingId
      ? `https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/${binder.thumbnailPrintingId}/public`
      : `${baseUrl}/icon-512x512.png`;

    return {
      title: `${binderName} - ${ownerName}'s Trade Binder`,
      description,
      keywords: [
        "FaB trade binder",
        "card collection",
        "trading cards",
        "binder management",
        "Flesh and Blood",
        ownerName,
      ],
      openGraph: {
        title: `${binderName} - ${ownerName}'s Trade Binder | FaB Bazaar`,
        description,
        url: binderUrl,
        images: [{ url: ogImage, alt: `${binderName} thumbnail` }],
        type: "website",
      },
      twitter: {
        card: "summary",
        title: `${binderName} - ${ownerName}'s Trade Binder`,
        description,
        images: [ogImage],
      },
      alternates: {
        canonical: binderUrl,
      },
    };
  } catch (error) {
    console.error("[Binder Metadata] Error generating metadata:", error);
    return fallback;
  }
}

export default function BinderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
