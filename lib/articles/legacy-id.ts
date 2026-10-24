/** Articles created in the Mongo era kept their 24-hex ObjectId as the internal id. */
export function isLegacyHexId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id);
}
