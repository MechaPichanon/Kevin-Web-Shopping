// No courier API integration exists (or is planned) for this project — the
// customer just gets sent to the courier's own tracking page and pastes the
// number in themselves. Where a courier's URL is known to accept the tracking
// number as a query param, we prefill it; otherwise we just link the page.
export type Courier = {
  slug: string
  label: string
  trackingUrl: (trackingNumber: string) => string
}

export const COURIERS: Courier[] = [
  {
    slug: "thailand_post",
    label: "ไปรษณีย์ไทย",
    trackingUrl: (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}`,
  },
  {
    slug: "kerry",
    label: "Kerry Express",
    trackingUrl: (n) => `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(n)}`,
  },
  {
    slug: "flash",
    label: "Flash Express",
    trackingUrl: (n) => `https://www.flashexpress.co.th/tracking/?se=${encodeURIComponent(n)}`,
  },
  {
    slug: "jt",
    label: "J&T Express",
    trackingUrl: () => `https://www.jtexpress.co.th/index/query/gzquery.html`,
  },
  {
    slug: "ninja_van",
    label: "Ninja Van",
    trackingUrl: () => `https://www.ninjavan.co/th-th/tracking`,
  },
  {
    slug: "dhl",
    label: "DHL",
    trackingUrl: (n) => `https://www.dhl.com/th-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(n)}`,
  },
  {
    slug: "other",
    label: "อื่นๆ",
    trackingUrl: () => "",
  },
]

export function getCourier(slug?: string | null): Courier | undefined {
  return slug ? COURIERS.find((c) => c.slug === slug) : undefined
}
