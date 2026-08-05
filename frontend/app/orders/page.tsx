"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Package, Clock, CheckCircle2, Truck, AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getToken } from "@/lib/auth"
import { useRouter } from "next/navigation"

// ─────────────────────────────────────────────
// Types (same struct as the admin orders view — backend/controllers/orderControllers.js)
// ─────────────────────────────────────────────
type OrderItem = {
  name: string
  variant?: string
  qty: number
  price: number
}

type Order = {
  id: number
  customer: string
  phone: string
  address: string
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  total: number
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded"
  paymentStatus: "unpaid" | "pending_verification" | "paid" | "rejected" | "refunded"
  paymentSlipUrl?: string
  paymentMethod?: string
  trackingNumber?: string
  notes?: string
  date: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────


const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":    return <Clock className="h-5 w-5" />
    case "shipped":   return <Truck className="h-5 w-5" />
    case "confirmed": return <CheckCircle2 className="h-5 w-5" />
    case "delivered": return <CheckCircle2 className="h-5 w-5" />
    case "cancelled":  return <AlertCircle className="h-5 w-5" />
    default:           return <Package className="h-5 w-5" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":   return "bg-yellow-100 text-yellow-800"
    case "shipped":  return "bg-blue-100 text-blue-800"
    case "confirmed": return "bg-green-100 text-green-800"
    case "delivered": return "bg-green-100 text-green-800"
    case "cancelled": return "bg-red-100 text-red-800"
    default:          return "bg-gray-100 text-gray-800"
  }
}

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "paid":                 return "bg-green-100 text-green-800"
    case "pending_verification": return "bg-yellow-100 text-yellow-800"
    case "unpaid":               return "bg-red-100 text-red-800"
    case "rejected":             return "bg-red-100 text-red-800"
    default:                     return "bg-gray-100 text-gray-800"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":   return "กำลังดำเนินการ"
    case "shipped":  return "กำลังจัดส่ง"
    case "confirmed": return "ยืนยันแล้ว"
    case "delivered": return "สำเร็จ"
    case "cancelled": return "ยกเลิก"
    default:          return status
  }
}

const getPaymentStatusLabel = (status: string) => {
  switch (status) {
    case "paid":                 return "ชำระแล้ว"
    case "pending_verification": return "รอการยืนยัน"
    case "unpaid":               return "ยังไม่ชำระ"
    case "rejected":             return "ปฏิเสธ"
    default:                     return status
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function OrdersPage() {
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<"all" | "pending" | "shipped" | "confirmed" | "delivered" | "cancelled">("all")
  const [pageError, setPageError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // ── โหลด order list (มาพร้อม items/ที่อยู่/การชำระเงินครบในคำขอเดียว) ──
  useEffect(() => {
    const token = getToken()
    if (!token) { router.push("/login"); return }

    fetch("http://localhost:5000/orders/my", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setPageError(data.error)
        } else {
          setOrders(data)
        }
      })
      .catch(() => setPageError("ไม่สามารถโหลดคำสั่งซื้อได้"))
      .finally(() => setIsLoading(false))
  }, [router])

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      next.has(orderId) ? next.delete(orderId) : next.add(orderId)
      return next
    })
  }

  // ── download ใบเสร็จ ──
  const handleDownloadReceipt = (order: Order) => {
    const lines = [
      "KEVIN SHOP - ใบเสร็จรับเงิน",
      "================================",
      `หมายเลขคำสั่ง: ${order.id}`,
      `วันที่: ${new Date(order.date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}`,
      "",
      "ข้อมูลลูกค้า:",
      order.customer,
      order.phone,
      order.address,
      "",
      "สินค้า:",
      ...order.items.map(
        (i) => `- ${i.name} x${i.qty} @ ฿${Number(i.price).toFixed(2)} = ฿${(i.qty * Number(i.price)).toFixed(2)}`
      ),
      "",
      `ค่าสินค้า: ฿${order.subtotal.toFixed(2)}`,
      `ค่าจัดส่ง: ฿${order.shippingFee.toFixed(2)}`,
      `รวมทั้งสิ้น: ฿${order.total.toFixed(2)}`,
      `สถานะคำสั่ง: ${getStatusLabel(order.status)}`,
      `สถานะการชำระเงิน: ${getPaymentStatusLabel(order.paymentStatus)}`,
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `receipt-${order.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── filter ──
  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter)

  const countOf = (s: string) => orders.filter((o) => o.status === s).length

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">คำสั่งซื้อของฉัน</h1>
            <p className="mt-2 text-muted-foreground">ติดตามและจัดการคำสั่งซื้อของคุณ</p>
          </div>

          {pageError && (
            <p className="mb-4 text-sm text-destructive">{pageError}</p>
          )}

          {/* Filter Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {(["all", "pending", "shipped", "confirmed", "delivered", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all"       && `ทั้งหมด (${orders.length})`}
                {f === "pending"   && `กำลังดำเนินการ (${countOf("pending")})`}
                {f === "shipped"  && `กำลังจัดส่ง (${countOf("shipped")})`}
                {f === "confirmed" && `ยืนยันแล้ว (${countOf("confirmed")})`}
                {f === "delivered" && `สำเร็จ (${countOf("delivered")})`}
                {f === "cancelled" && `ยกเลิก (${countOf("cancelled")})`}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">ไม่มีคำสั่งซื้อ</h2>
              <p className="mt-2 text-muted-foreground">คุณยังไม่มีคำสั่งซื้อในหมวดหมู่นี้</p>
              <Button className="mt-6" asChild>
                <a href="/products">ไปซื้อสินค้า</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.id)

                return (
                  <div key={order.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Order Header — กด toggle */}
                    <button
                      onClick={() => toggleOrderExpanded(order.id)}
                      className="w-full p-6 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-foreground">#{order.id}</span>
                            <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                              {getStatusIcon(order.status)}
                              {getStatusLabel(order.status)}
                            </Badge>
                            <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                              {getPaymentStatusLabel(order.paymentStatus)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground mt-3">
                            <div>
                              <span className="text-xs uppercase tracking-wide">วันที่สั่ง</span>
                              <p className="text-foreground font-medium">
                                {new Date(order.date).toLocaleDateString("th-TH", {
                                  year: "numeric", month: "short", day: "numeric",
                                })}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-wide">จำนวนสินค้า</span>
                              <p className="text-foreground font-medium">{order.items.length} รายการ</p>
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-wide">ยอดรวม</span>
                              <p className="text-foreground font-medium">฿{Number(order.total).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {/* Order Detail */}
                    {isExpanded && (
                      <>
                        <div className="border-t border-border" />

                        <div className="p-6 space-y-6">
                          {/* Items */}
                          <div>
                            <h3 className="font-semibold text-foreground mb-3">สินค้าในคำสั่ง</h3>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between py-2 border-b border-border last:border-0">
                                  <div>
                                    <p className="text-foreground">{item.name}</p>
                                    {item.variant && item.variant !== "-" && (
                                      <p className="text-xs text-muted-foreground">{item.variant}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground">จำนวน: {item.qty}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-foreground font-medium">
                                      ฿{(item.qty * Number(item.price)).toFixed(2)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">฿{Number(item.price).toFixed(2)}/ชิ้น</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-border space-y-1">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>ค่าสินค้า</span>
                                <span>฿{order.subtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>ค่าจัดส่ง</span>
                                <span>{order.shippingFee === 0 ? "ฟรี" : `฿${order.shippingFee.toFixed(2)}`}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border mt-1">
                                <span>ยอดรวม</span>
                                <span className="text-lg">฿{order.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Delivery Info */}
                          <div>
                            <h3 className="font-semibold text-foreground mb-3">ข้อมูลจัดส่ง</h3>
                            <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                              <p className="text-foreground">{order.customer}</p>
                              <p className="text-muted-foreground">{order.phone}</p>
                              <p className="text-muted-foreground">{order.address}</p>
                            </div>
                          </div>

                          {/* Payment Info */}
                          <div>
                            <h3 className="font-semibold text-foreground mb-3">ข้อมูลการชำระเงิน</h3>
                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">สถานะชำระเงิน</span>
                                <span className={`font-medium ${getPaymentStatusColor(order.paymentStatus)} px-3 py-1 rounded-lg`}>
                                  {getPaymentStatusLabel(order.paymentStatus)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
                            <Button
                              variant="outline"
                              onClick={() => handleDownloadReceipt(order)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              ดาวน์โหลดใบเสร็จ
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

    </div>
  )
}
