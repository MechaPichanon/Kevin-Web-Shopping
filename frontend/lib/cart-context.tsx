"use client"

import { createContext, useContext, useState, useEffect } from "react"

export interface CartItem {
  id: string | number
  name: string
  price: number
  quantity: number
  size: string
  image?: string
}

interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: CartItem) => void
  removeItem: (id: string | number, size: string) => void
  updateQuantity: (id: string | number, size: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const fetchRemoteCart = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/cart/${userId}`)
      if (!res.ok) return
      const rows = await res.json()
      const mapped: CartItem[] = rows.map((r: any) => ({
        id: r.cart_item_id || r.variant_id,
        name: r.product_name,
        price: Number(r.price || 0),
        quantity: Number(r.quantity || 0),
        size: r.size || "",
        image: r.image_url || undefined,
      }))
      setItems(mapped)
    } catch (err) {
      console.error("Failed to fetch remote cart:", err)
    }
  }

  // Initialize cart: if logged in, load from backend; otherwise load from localStorage
  useEffect(() => {
    const init = async () => {
      try {
        const userStr = localStorage.getItem("user")
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user?.id) {
            await fetchRemoteCart(user.id)
            return
          }
        }

        const saved = localStorage.getItem("cart")
        if (saved) {
          try {
            setItems(JSON.parse(saved))
          } catch (err) {
            console.error("Failed to load cart:", err)
          }
        }
      } catch (err) {
        console.error("Cart init error:", err)
      }
    }

    init()

    const onCartUpdated = async () => {
      try {
        const userStr = localStorage.getItem("user")
        if (!userStr) return
        const user = JSON.parse(userStr)
        if (user?.id) await fetchRemoteCart(user.id)
      } catch (err) {
        console.error("onCartUpdated error:", err)
      }
    }

    window.addEventListener("cartUpdated", onCartUpdated)
    return () => window.removeEventListener("cartUpdated", onCartUpdated)
  }, [])

  // Save cart to localStorage whenever it changes (for guest carts)
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(items))
    } catch (err) {
      console.error("Failed to save cart:", err)
    }
  }, [items])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const addItem = (newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === newItem.id && item.size === newItem.size)
      if (existing) {
        return prev.map((item) =>
          item.id === newItem.id && item.size === newItem.size
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        )
      }
      return [...prev, newItem]
    })
  }

  const removeItem = (id: string | number, size: string) => {
    setItems((prev) => prev.filter((item) => !(item.id === id && item.size === size)))
  }

  const updateQuantity = (id: string | number, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id, size)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.size === size ? { ...item, quantity } : item
      )
    )
  }

  const clearCart = () => {
    setItems([])
  }

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }
  return context
}
