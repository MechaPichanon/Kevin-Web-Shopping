// Shared color-name -> hex lookup for rendering swatches. Keyed by color name
// (Thai or English, matches variants.color / variants.color_th), not per-product,
// so it works across the whole catalog. Unlisted names fall back to neutral gray.
const COLOR_HEX: Record<string, string> = {
  "ขาว": "#f5f5f0",
  White: "#f5f5f0",
  "ดำ": "#1a1a1a",
  Black: "#1a1a1a",
  "กรมท่า": "#1f3a5f",
  Navy: "#1f3a5f",
  "เขียวมะกอก": "#6b7250",
  Olive: "#6b7250",
  "เทา": "#9a9a95",
  Gray: "#9a9a95",
  Grey: "#9a9a95",
  "แดง": "#b23b3b",
  Red: "#b23b3b",
  "น้ำเงิน": "#2b4a8f",
  Blue: "#2b4a8f",
  "เบจ": "#d8c9ab",
  Beige: "#d8c9ab",
  "น้ำตาล": "#6b4a2f",
  Brown: "#6b4a2f",
  "ครีม": "#f0e6d2",
  Cream: "#f0e6d2",
  "ชมพู": "#e3a9b8",
  Pink: "#e3a9b8",
  "เหลือง": "#e8c94a",
  Yellow: "#e8c94a",
  "เขียว": "#4f7d5c",
  Green: "#4f7d5c",
}

const FALLBACK_HEX = "#d9d9d9"

export function colorToHex(color: string | null | undefined): string {
  if (!color) return FALLBACK_HEX
  return COLOR_HEX[color] ?? FALLBACK_HEX
}
