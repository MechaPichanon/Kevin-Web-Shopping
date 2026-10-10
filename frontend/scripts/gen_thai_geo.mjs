// One-off generator for public/data/thai-geo.json — the province → district →
// sub-district (+ zip) lists behind the address form's cascading selects.
// Run by hand when the source data needs refreshing (not part of the build):
//   node frontend/scripts/gen_thai_geo.mjs
//
// Source: kongvut/thai-province-data (MIT License, © Kongvut Sangkla)
// https://github.com/kongvut/thai-province-data
//
// Output shape: { [province]: { [district]: [[subDistrict, zip], ...] } }
// Names are stored WITHOUT เขต/อำเภอ/แขวง/ตำบล prefixes — formatFullAddress()
// in lib/addresses.ts adds them for display.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SRC =
  "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/province_with_district_and_sub_district.json"

const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, "..", "public", "data", "thai-geo.json")

const clean = (s) => s.replace(/\s+/g, " ").trim()
const byThai = (a, b) => a.localeCompare(b, "th")

const res = await fetch(SRC)
if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
const provinces = await res.json()

const out = {}
for (const p of provinces) {
  if (p.deleted_at) continue
  const districts = {}
  for (const d of p.districts) {
    if (d.deleted_at) continue
    const name = clean(d.name_th).replace(/^เขต/, "")
    const subs = d.sub_districts
      .filter((s) => !s.deleted_at)
      .map((s) => [clean(s.name_th), String(s.zip_code)])
      .sort((a, b) => byThai(a[0], b[0]))
    districts[name] = subs
  }
  out[clean(p.name_th)] = Object.fromEntries(Object.entries(districts).sort((a, b) => byThai(a[0], b[0])))
}

// Province keys must match the form's <select> list exactly.
const listSrc = readFileSync(join(here, "..", "lib", "thaiProvinces.ts"), "utf8")
const expected = [...listSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1])
const got = Object.keys(out)
const missing = expected.filter((n) => !got.includes(n))
const extra = got.filter((n) => !expected.includes(n))
if (missing.length || extra.length) {
  throw new Error(`province mismatch — missing: ${missing.join(", ")} | extra: ${extra.join(", ")}`)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(out))

const nDist = got.reduce((n, p) => n + Object.keys(out[p]).length, 0)
const nSub = got.reduce((n, p) => n + Object.values(out[p]).reduce((m, s) => m + s.length, 0), 0)
console.log(`wrote ${outFile}: ${got.length} provinces, ${nDist} districts, ${nSub} sub-districts`)
