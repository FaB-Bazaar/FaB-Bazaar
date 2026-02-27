/**
 * Metadata API Route - Returns static card metadata
 *
 * MIGRATED: Now uses @/lib/fab-constants instead of MongoDB
 * No database connection required - all data is TypeScript constants
 */

import { NextResponse } from "next/server";
import {
  SET_METADATA,
  EDITION_MAP,
  FOILING_MAP,
  RARITY_MAP,
  ART_VARIATIONS_MAP,
  getSetsInDisplayOrder,
} from "@/lib/fab-constants";
import type {
  MetadataCollectionDTO,
  SetDTO,
  EditionDTO,
  FoilingDTO,
  RarityDTO,
  ArtVariationDTO,
} from "@/lib/services/contracts/IMetadataService";

export async function GET() {
  try {
    // Convert sets to DTO format
    const orderedSets = getSetsInDisplayOrder();
    const sets: SetDTO[] = orderedSets.map((setMeta) => ({
      _id: setMeta.code,
      code: setMeta.code,
      name: setMeta.name,
      releaseDate: setMeta.releaseDate ? new Date(setMeta.releaseDate) : undefined,
      isPromo: setMeta.category === 'promo',
      category: setMeta.category,
      logoUrl: setMeta.logoUrl,
      outOfPrint: setMeta.outOfPrint || false,
    }));

    // Convert editions to DTO format
    const editions: EditionDTO[] = Object.entries(EDITION_MAP).map(([code, name]) => ({
      _id: code,
      code,
      name,
      displayClass: `edition-${code.toLowerCase()}`,
    }));

    // Convert foilings to DTO format
    const foilings: FoilingDTO[] = Object.entries(FOILING_MAP).map(([code, name]) => ({
      _id: code,
      code,
      name,
      abbreviation: code.toUpperCase(),
      displayClass: `foiling-${code.toLowerCase()}`,
    }));

    // Convert rarities to DTO format
    const rarities: RarityDTO[] = Object.entries(RARITY_MAP).map(([code, name]) => ({
      _id: code,
      code,
      name,
      abbreviation: code.toUpperCase(),
      displayClass: `rarity-${code.toLowerCase()}`,
    }));

    // Convert art variations to DTO format
    const artVariations: ArtVariationDTO[] = Object.entries(ART_VARIATIONS_MAP).map(([code, name]) => ({
      _id: code,
      code,
      name,
      displayClass: `art-${code.toLowerCase()}`,
    }));

    const metadata: MetadataCollectionDTO = {
      sets,
      editions,
      foilings,
      rarities,
      artVariations,
    };

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error("Error building metadata from constants:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to build metadata",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
