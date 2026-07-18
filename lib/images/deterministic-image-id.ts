/**
 * LSS-style deterministic Cloudflare image id for a printing, derived purely
 * from the printing's own attributes so every environment computes the same
 * id for the same physical printing and shares one uploaded image.
 *
 * Shape: [LANG_]COLLECTOR[-RF|-CF|-GF][-EA][-1E|-UL|-AL][-ARTVARS...][_BACK]
 * mirroring LSS's own face ids (ROS076-RF, JA_ROS076, FR_IAR106-CF_BACK).
 *
 * Returns null when no safe id can be derived — the caller keeps the
 * printing_id-keyed image instead. This function does NOT guarantee global
 * uniqueness: some alt-art printings differ by nothing but the image itself
 * (see the dual-source ID gotcha); the migration script audits collisions
 * across all rows and falls back to printing_id for colliding groups.
 */

export interface PrintingKeyAttrs {
  language: string;
  collector_number: string;
  foiling: string;
  edition: string;
  is_extended_art: boolean;
  is_front_face: boolean;
  art_variations: string[] | null;
}

const SAFE = /^[A-Za-z0-9_-]+$/;

const FOILING_SUFFIX: Record<string, string> = { s: "", r: "-RF", c: "-CF", g: "-GF" };
const EDITION_SUFFIX: Record<string, string> = { n: "", f: "-1E", u: "-UL", a: "-AL" };

export function deterministicImageId(p: PrintingKeyAttrs): string | null {
  if (!p.collector_number || !SAFE.test(p.collector_number)) return null;

  const arts = (p.art_variations ?? []).filter((a) => a.length > 0);
  if (arts.some((a) => !SAFE.test(a))) return null;

  const lang = p.language.toLowerCase() === "en" ? "" : `${p.language.toUpperCase()}_`;
  const foil = FOILING_SUFFIX[p.foiling] ?? `-${p.foiling.toUpperCase()}F`;
  const edition = EDITION_SUFFIX[p.edition] ?? `-${p.edition.toUpperCase()}E`;

  const id =
    lang +
    p.collector_number +
    foil +
    (p.is_extended_art ? "-EA" : "") +
    edition +
    (arts.length > 0 ? `-${arts.join("-")}` : "") +
    (p.is_front_face ? "" : "_BACK");

  return SAFE.test(id) ? id : null;
}
