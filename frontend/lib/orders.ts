// Client-safe: talks to the Express backend directly (not a Next.js API route).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const API_BASE = `${BACKEND_URL}/orders`

export type OrderItem = {
  name: string
  variant?: string
  qty: number
  price: number
}

export type Order = {
  id: number
  customer: string
  phone: string
  address: string
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  total: number
  status: string // pending | shipping | completed | cancelled
  paymentStatus: string // unpaid | pending_verification | paid | rejected
  paymentMethod?: string
  trackingNumber?: string
  notes?: string
  date: string
}

// ⚠️ Assumes the login page stores the JWT under localStorage key "token".
// If your login flow stores it elsewhere (e.g. inside the "user" object,
// or a different key), change this one function.
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${API_BASE}/admin`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("โหลดคำสั่งซื้อไม่สำเร็จ")
  return res.json()
}

export async function updateOrderStatusApi(id: number, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error("อัปเดตสถานะไม่สำเร็จ")
}

export async function updatePaymentStatusApi(id: number, paymentStatus: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/${id}/payment-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ payment_status: paymentStatus }),
  })
  if (!res.ok) throw new Error("อัปเดตสถานะการชำระเงินไม่สำเร็จ")
}