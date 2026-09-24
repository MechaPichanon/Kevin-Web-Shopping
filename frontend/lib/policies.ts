// Client-safe: talks to the Express backend directly (not a Next.js API route).
import { API_BASE as BACKEND_URL } from "@/lib/api"
const API_BASE = `${BACKEND_URL}/policies`

export type Policy = {
  policy_type: string // "SHIPPING" | "RETURN" | "PAYMENT"
  content_en: string
  content_th: string
  updated_at: string
}

// ⚠️ Assumes the login page stores the JWT under localStorage key "token".
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchPolicies(): Promise<Policy[]> {
  // GET /policies is public — no auth header needed, matches storefront /policy page.
  const res = await fetch(API_BASE, { cache: "no-store" })
  if (!res.ok) throw new Error("โหลดข้อมูลนโยบายไม่สำเร็จ")
  return res.json()
}

export async function updatePolicyApi(
  policyType: string,
  data: { content_en: string; content_th: string }
): Promise<Policy> {
  const res = await fetch(`${API_BASE}/${policyType}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("บันทึกนโยบายไม่สำเร็จ")
  return res.json()
}
