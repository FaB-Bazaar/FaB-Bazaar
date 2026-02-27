// Update the helper functions to use the database metadata instead of hardcoded values
// We'll keep this file for backward compatibility, but make it use the metadata-service.ts

import { fetchMetadata } from "./metadata-service"

// Helper function to get set name
export const getSetName = async (code?: string): Promise<string> => {
  if (!code) return "Unknown Set"
  // Normalize to lowercase for lookup
  const lookupCode = code.toLowerCase();
  try {
    const metadata = await fetchMetadata()
    const set = metadata.sets.find((s) => s.code.toLowerCase() === lookupCode)
    // Display as uppercase code if not found
    return set ? set.name : code.toUpperCase()
  } catch (error) {
    console.error("Error getting set name:", error)
    // Fallback to hardcoded values if database fetch fails (keys are lowercase)
    const setNames: Record<string, string> = {
      wtr: "Welcome to Rathe",
      arc: "Arcane Rising",
      cru: "Crucible of War",
      mon: "Monarch",
      ele: "Tales of Aria",
      evr: "Everfest",
      upr: "Uprising",
      dyn: "Dynasty",
      dtd: "Dusk till Dawn",
      out: "Outsiders",
    }
    return setNames[lookupCode] || code.toUpperCase()
  }
}

// Helper function to get edition name and style
export const getEditionInfo = async (code?: string) => {
  if (!code) return { name: "", className: "" }
  const lookupCode = code.toLowerCase();
  try {
    const metadata = await fetchMetadata()
    const edition = metadata.editions.find((e) => e.code.toLowerCase() === lookupCode)
    return edition ? { name: edition.name, className: edition.displayClass } : { name: code.toUpperCase(), className: "" }
  } catch (error) {
    console.error("Error getting edition info:", error)
    const editions: Record<string, { name: string; className: string }> = {
      a: { name: "Alpha", className: "bg-red-50 text-red-700 border-red-200" },
      f: { name: "First Edition", className: "bg-blue-50 text-blue-700 border-blue-200" },
      u: { name: "Unlimited Edition", className: "bg-green-50 text-green-700 border-green-200" },
      n: { name: "No Edition", className: "bg-gray-50 text-gray-700 border-gray-200" },
    }
    return editions[lookupCode] || { name: code.toUpperCase(), className: "" }
  }
}

// Update the hardcoded fallback values in getFoilingInfo
// This is already correct with "Non Foil (NF)" but let's ensure consistency
export const getFoilingInfo = async (code?: string) => {
  if (!code) return { name: "", className: "" }
  const lookupCode = code.toLowerCase();
  try {
    const metadata = await fetchMetadata()
    const foiling = metadata.foilings.find((f) => f.code.toLowerCase() === lookupCode)
    return foiling ? { name: foiling.name, className: foiling.displayClass } : { name: code.toUpperCase(), className: "" }
  } catch (error) {
    console.error("Error getting foiling info:", error)
    const foilings: Record<string, { name: string; className: string }> = {
      s: { name: "Non-Foil (NF)", className: "bg-gray-100 text-gray-700 border-gray-300" },
      r: {
        name: "Rainbow Foil (RF)",
        className: "bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700 border-purple-300",
      },
      c: {
        name: "Cold Foil (CF)",
        className: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border-blue-300",
      },
      g: {
        name: "Gold Cold Foil (GF)",
        className: "bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-700 border-amber-300 font-semibold",
      },
      n: { name: "Non-Foil (NF)", className: "bg-gray-100 text-gray-700 border-gray-300" },
    }
    return foilings[lookupCode] || { name: code.toUpperCase(), className: "" }
  }
}

// Helper function to get rarity name and style
export const getRarityInfo = async (code?: string) => {
  if (!code) return { name: "", className: "" }
  const lookupCode = code.toLowerCase();
  try {
    const metadata = await fetchMetadata()
    const rarity = metadata.rarities.find((r) => r.code.toLowerCase() === lookupCode)
    return rarity ? { name: rarity.name, className: rarity.displayClass } : { name: code.toUpperCase(), className: "" }
  } catch (error) {
    console.error("Error getting rarity info:", error)
    const rarities: Record<string, { name: string; className: string }> = {
      c: { name: "Common", className: "bg-gray-100 text-gray-700 border-gray-300" },
      r: { name: "Rare", className: "bg-blue-100 text-blue-700 border-blue-300" },
      s: { name: "Super Rare", className: "bg-purple-100 text-purple-700 border-purple-300" },
      m: { name: "Majestic", className: "bg-pink-100 text-pink-700 border-pink-300" },
      l: { name: "Legendary", className: "bg-amber-100 text-amber-700 border-amber-300" },
      f: { name: "Fabled", className: "bg-red-100 text-red-700 border-red-300 font-semibold" },
      t: { name: "Token", className: "bg-gray-100 text-gray-700 border-gray-300" },
      v: { name: "Marvel", className: "bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold" },
      p: { name: "Promo", className: "bg-green-100 text-green-700 border-green-300" },
    }
    return rarities[lookupCode] || { name: code.toUpperCase(), className: "" }
  }
}

// Helper function to get art variation name and style
export const getArtVariationInfo = async (code?: string) => {
  if (!code) return { name: "", className: "" }
  const lookupCode = code.toLowerCase();
  try {
    const metadata = await fetchMetadata()
    const artVariation = metadata.artVariations.find((a) => a.code.toLowerCase() === lookupCode)
    return artVariation
      ? { name: artVariation.name, className: artVariation.displayClass }
      : { name: code.toUpperCase(), className: "" }
  } catch (error) {
    console.error("Error getting art variation info:", error)
    const variations: Record<string, { name: string; className: string }> = {
      ab: { name: "Alternate Border", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      aa: { name: "Alternate Art", className: "bg-violet-50 text-violet-700 border-violet-200" },
      at: { name: "Alternate Text", className: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
      ea: { name: "Extended Art", className: "bg-purple-50 text-purple-700 border-purple-200" },
      fa: { name: "Full Art", className: "bg-pink-50 text-pink-700 border-pink-200" },
      hs: { name: "Half Size", className: "bg-rose-50 text-rose-700 border-rose-200" },
    }
    return variations[lookupCode] || { name: code.toUpperCase(), className: "" }
  }
}

// Keep the synchronous helper functions as-is for components that can't use async functions
// These will use hardcoded values as fallbacks

// Helper function to get card color based on pitch value
export const getCardColor = (pitch?: string) => {
  switch (pitch) {
    case "1":
      return "bg-red-50 border-red-200"
    case "2":
      return "bg-yellow-50 border-yellow-200"
    case "3":
      return "bg-blue-50 border-blue-200"
    default:
      return "bg-gray-50 border-gray-200"
  }
}

// Helper function to check if a card is special (Gold Cold Foil, Marvel, Fabled)
export const isSpecialCard = (foiling?: string, rarity?: string) => {
  return foiling === "G" || rarity === "F" || rarity === "V"
}

// Helper function to get abbreviated printing info for listings
export const getPrintingAbbreviation = (card: { foiling?: string; rarity?: string; set?: string }) => {
  let result = ""

  if (card.foiling) {
    // Common abbreviations
    if (card.foiling === "C") result += "CF "
    else if (card.foiling === "R") result += "RF "
    else if (card.foiling === "S" || card.foiling === "N") result += "NF "
    else if (card.foiling === "G") result += "GF "
  }

  if (card.rarity === "EA" || card.rarity === "FA" || card.rarity === "AA") {
    result += card.rarity + " "
  }

  if (card.set) {
    result += card.set + " "
  }

  return result.trim()
}

// Helper function to get abbreviated foiling name for display in badges
export const getFoilingAbbreviation = (code?: string): string => {
  if (!code) return ""
  const lookupCode = code.toLowerCase();
  const foilingAbbreviations: Record<string, string> = {
    s: "NF",
    r: "RF",
    c: "CF",
    g: "GF",
    n: "NF",
  }
  return foilingAbbreviations[lookupCode] || code.toUpperCase()
}

// Helper function to get abbreviated rarity name for display in badges
export const getRarityAbbreviation = (code?: string): string => {
  if (!code) return ""
  const lookupCode = code.toLowerCase();
  const rarityAbbreviations: Record<string, string> = {
    c: "C",
    r: "R",
    s: "S",
    m: "M",
    l: "L",
    f: "F",
    t: "T",
    v: "Marvel",
    p: "Promo",
  }
  return rarityAbbreviations[lookupCode] || code.toUpperCase()
}

export const getFoilingDisplayName = (code?: string): string => {
  if (!code) return ""
  const lookupCode = code.toLowerCase();
  const foilingDisplayNames: Record<string, string> = {
    s: "Non-Foil",
    r: "Rainbow Foil",
    c: "Cold Foil",
    g: "Gold Cold Foil",
    n: "Non-Foil",
  }
  return foilingDisplayNames[lookupCode] || code.toUpperCase()
}
