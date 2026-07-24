// lib/kits/facet-defs.ts
//
// Shapes the curated facet vocabulary for the kit pages' tag chips.
// Pure — callers fetch definitions via facetService.listTagDefinitions().

import type { FacetTagDefinitionDTO } from '@/lib/services/contracts/IFacetService';
import type { FacetTagDisplay } from '@/components/kits/KitPoolCard';

export function buildFacetDisplayMap(
  defs: FacetTagDefinitionDTO[]
): Record<string, FacetTagDisplay> {
  return Object.fromEntries(defs.map(d => [d.id, { label: d.label, def: d.def, dim: d.dim }]));
}
