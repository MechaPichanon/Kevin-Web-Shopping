// Client-safe: talks to the Express backend directly (not a Next.js API route).
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export type DashboardStats = {
  sales: number
  sales_yesterday: number
  sales_month: number
  sales_prev_month: number
  orders: number
  orders_yesterday: number
  products: number
  products_new_today: number
  users: number
  users_new_today: number
  profit: number
  profit_yesterday: number
}

export type RevenueDay = { date: string; revenue: number }
export type RevenueDaily = { current: RevenueDay[]; previous: RevenueDay[] }

export type RecentOrder = {
  id: number | string
  customer: string
  total: number
  status: string
  date: string
}

export type BestSeller = {
  product_id: string
  product_name: string
  product_name_th?: string
  category?: string
  category_th?: string
  total_sold: string | number
}

export type LowStockItem = {
  variant_id: string
  product_id: string
  product_name: string
  product_name_th?: string
  size: string
  color: string
  color_th?: string
  stock: number
}

// ⚠️ Assumes the login page stores the JWT under localStorage key "token".
function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BACKEND_URL}/admin/stats`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("โหลดข้อมูลสรุปไม่สำเร็จ")
  return res.json()
}

export async function fetchRevenueDaily(): Promise<RevenueDaily> {
  const res = await fetch(`${BACKEND_URL}/admin/revenue-daily`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("โหลดกราฟยอดขายไม่สำเร็จ")
  return res.json()
}

export async function fetchRecentOrders(): Promise<RecentOrder[]> {
  const res = await fetch(`${BACKEND_URL}/admin/orders/recent`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("โหลดคำสั่งซื้อล่าสุดไม่สำเร็จ")
  return res.json()
}

export async function fetchBestSellers(limit = 5): Promise<BestSeller[]> {
  const res = await fetch(`${BACKEND_URL}/products/best-sellers?limit=${limit}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("โหลดสินค้าขายดีไม่สำเร็จ")
  return res.json()
}

export async function fetchLowStock(): Promise<LowStockItem[]> {
  const res = await fetch(`${BACKEND_URL}/admin/low-stock`, {
    cache: "no-store",
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("โหลดสินค้าใกล้หมดสต็อกไม่สำเร็จ")
  return res.json()
}
