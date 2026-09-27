// Address book — shared by the profile "สมุดที่อยู่" tab and the checkout
// address chips. Backend: backend/routes/addressRoutes.js (mounted at /addresses).
import { API_BASE } from "@/lib/api"
import { getToken } from "@/lib/auth"
import type { TranslationKey } from "@/lib/i18n/dictionaries"

export interface Address {
  id: number
  recipientName: string
  /** digits only — use formatPhone() for display */
  phone: string
  addressLine1: string
  addressLine2: string
  subDistrict: string
  district: string
  province: string
  postalCode: string
  isDefault: boolean
}

export type AddressInput = Omit<Address, "id">

export const emptyAddressInput: AddressInput = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  subDistrict: "",
  district: "",
  province: "",
  postalCode: "",
  isDefault: false,
}

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// ── API ──────────────────────────────────────────────────────

async function request<R>(path: string, init: RequestInit = {}): Promise<R> {
  const token = getToken()
  const res = await fetch(`${API_BASE}/addresses${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as R
}

export const listAddresses = () => request<Address[]>("")

export const createAddress = (input: AddressInput) =>
  request<Address>("", { method: "POST", body: JSON.stringify(input) })

export const updateAddress = (id: number, input: AddressInput) =>
  request<Address>(`/${id}`, { method: "PUT", body: JSON.stringify(input) })

export const setDefaultAddress = (id: number) =>
  request<{ message: string }>(`/${id}/default`, { method: "PATCH" })

export const deleteAddress = (id: number) =>
  request<{ message: string }>(`/${id}`, { method: "DELETE" })

// ── Formatting ───────────────────────────────────────────────

/** "0812345678" → "081-234-5678" (display only; stored as digits). */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length > 6) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`
  return d
}

/**
 * One-line address. Bangkok uses แขวง/เขต, every other province ตำบล/อำเภอ
 * (prefix strings come from t(), so the EN view has no Thai prefixes).
 */
export function formatFullAddress(a: Pick<Address, "addressLine1" | "addressLine2" | "subDistrict" | "district" | "province" | "postalCode">, t: T): string {
  const bkk = a.province === "กรุงเทพมหานคร"
  const sub = a.subDistrict && `${t(bkk ? "address.prefixSubBkk" : "address.prefixSub")}${a.subDistrict}`
  const dist = a.district && `${t(bkk ? "address.prefixDistrictBkk" : "address.prefixDistrict")}${a.district}`
  return [a.addressLine1, a.addressLine2, sub, dist, a.province, a.postalCode]
    .filter(Boolean)
    .join(" ")
}

// ── Validation (mirrors addressControllers.js validateAddress) ──

export type AddressErrors = Partial<Record<keyof AddressInput, string>>

export function validateAddress(a: AddressInput, t: T): AddressErrors {
  const e: AddressErrors = {}
  const phoneDigits = a.phone.replace(/\D/g, "")
  if (!a.recipientName.trim()) e.recipientName = t("address.errName")
  if (phoneDigits.length < 9 || phoneDigits.length > 10) e.phone = t("address.errPhone")
  if (!a.addressLine1.trim()) e.addressLine1 = t("address.errLine")
  if (!a.province) e.province = t("address.errProvince")
  if (!a.district.trim()) e.district = t("address.errDistrict")
  if (!a.subDistrict.trim()) e.subDistrict = t("address.errSubDistrict")
  if (!/^\d{5}$/.test(a.postalCode)) e.postalCode = t("address.errZip")
  return e
}
