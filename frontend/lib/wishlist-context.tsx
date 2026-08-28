"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getToken } from "@/lib/auth"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface WishlistItem {
  id: string          // product_id (string เพื่อ backward compat กับโค้ดเดิม)
  name: string
  price: number
  originalPrice?: number
  image: string
  category: string
  isNew?: boolean
  isSale?: boolean
}

interface WishlistContextType {
  items: WishlistItem[]
  addItem: (item: WishlistItem) => void
  removeItem: (id: string) => void
  toggleItem: (item: WishlistItem) => void
  isInWishlist: (id: string) => boolean
  totalItems: number
  isLoading: boolean
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

const authHeaders = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
})

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // ── โหลด wishlist จาก backend เมื่อ login ──
  useEffect(() => {
    const token = getToken()
    if (!token) return  // ยังไม่ login → ไม่โหลด

    setIsLoading(true)
    fetch(`${API}/wishlist/my`, { headers: authHeaders(token) })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(
            data.map((row: any) => ({
              id: String(row.product_id),
              name: row.product_name,
              price: Number(row.price) || 0,
              image: row.image_url || "",
              category: row.category || "",
            }))
          )
        }
      })
      .catch((err) => console.error("[wishlist] fetch error:", err))
      .finally(() => setIsLoading(false))
  }, [])

  // ── เพิ่มสินค้า ──
  const addItem = async (item: WishlistItem) => {
    if (items.some((i) => i.id === item.id)) return

    // Optimistic update
    setItems((prev) => [...prev, item])

    const token = getToken()
    if (!token) return

    try {
      await fetch(`${API}/wishlist`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ product_id: item.id }),
      })
    } catch (err) {
      console.error("[wishlist] add error:", err)
      // rollback
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    }
  }

  // ── ลบสินค้า ──
  const removeItem = async (id: string) => {
    const backup = items
    // Optimistic update
    setItems((prev) => prev.filter((i) => i.id !== id))

    const token = getToken()
    if (!token) return

    try {
      await fetch(`${API}/wishlist/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      })
    } catch (err) {
      console.error("[wishlist] remove error:", err)
      // rollback
      setItems(backup)
    }
  }

  // ── toggle ──
  const toggleItem = (item: WishlistItem) => {
    items.some((i) => i.id === item.id) ? removeItem(item.id) : addItem(item)
  }

  return (
    <WishlistContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        toggleItem,
        isInWishlist: (id) => items.some((i) => i.id === id),
        totalItems: items.length,
        isLoading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) throw new Error("useWishlist must be used within a WishlistProvider")
  return context
}