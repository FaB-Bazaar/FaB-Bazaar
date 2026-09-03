// One printing's human identity for trade surfaces: "<FOIL> <name> (<collector>)".
// Used by the store Trade Opportunities tile caption AND the Discord ping
// payload, so what the trader is told matches exactly the printing that
// matched (store trade matches are keyed on printing_id, not card name).

export interface PrintingLabelInput {
  displayName: string;
  /** Short foil label as emitted by the inventory service: RF / CF / GF / NF. */
  foiling?: string | null;
  collectorNumber?: string | null;
}

export function printingLabel(card: PrintingLabelInput): string {
  const foil = card.foiling && card.foiling !== 'NF' ? `${card.foiling} ` : '';
  const num = card.collectorNumber ? ` (${card.collectorNumber})` : '';
  return `${foil}${card.displayName}${num}`;
}
