"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Package, Clock, CheckCircle2, Truck, AlertCircle, Download, Star, Upload, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getToken } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useLang } from "@/lib/language-context"
import { th as thDict, type TranslationKey } from "@/lib/i18n/dictionaries"

const API = "http://localhost:5000"

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string

// ─────────────────────────────────────────────
// Types (same struct as the admin orders view — backend/controllers/orderControllers.js)
// ─────────────────────────────────────────────
type OrderItem = {
  productId?: string
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
  slips?: { url: string; status: string; rejectReason: string | null; uploadedAt: string }[]
  paymentRejectReason?: string | null
  date: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending": return <Clock className="h-5 w-5" />
    case "shipped": return <Truck className="h-5 w-5" />
    case "confirmed": return <CheckCircle2 className="h-5 w-5" />
    case "delivered": return <CheckCircle2 className="h-5 w-5" />
    case "cancelled": return <AlertCircle className="h-5 w-5" />
    default: return <Package className="h-5 w-5" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800"
    case "shipped": return "bg-blue-100 text-blue-800"
    case "confirmed": return "bg-green-100 text-green-800"
    case "delivered": return "bg-green-100 text-green-800"
    case "cancelled": return "bg-red-100 text-red-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800"
    case "pending_verification": return "bg-yellow-100 text-yellow-800"
    case "unpaid": return "bg-red-100 text-red-800"
    case "rejected": return "bg-red-100 text-red-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

const ORDER_STATUS_KEYS: Record<string, TranslationKey> = {
  pending: "orders.os.pending",
  confirmed: "orders.os.confirmed",
  shipped: "orders.os.shipped",
  delivered: "orders.os.delivered",
  cancelled: "orders.os.cancelled",
  refunded: "orders.os.refunded",
}

const PAYMENT_STATUS_KEYS: Record<string, TranslationKey> = {
  paid: "orders.ps.paid",
  pending_verification: "orders.ps.pending_verification",
  unpaid: "orders.ps.unpaid",
  rejected: "orders.ps.rejected",
  refunded: "orders.ps.refunded",
}

const getStatusLabel = (status: string, t: TFn) =>
  ORDER_STATUS_KEYS[status] ? t(ORDER_STATUS_KEYS[status]) : status

const getPaymentStatusLabel = (status: string, t: TFn) =>
  PAYMENT_STATUS_KEYS[status] ? t(PAYMENT_STATUS_KEYS[status]) : status

const getSlipBadge = (status: string, t: TFn) => {
  switch (status) {
    case "approved": return { label: t("orders.slip.approved"), cls: "bg-green-100 text-green-800" }
    case "rejected": return { label: t("orders.slip.rejected"), cls: "bg-red-100 text-red-800" }
    default: return { label: t("orders.slip.pending"), cls: "bg-yellow-100 text-yellow-800" }
  }
}

// key used to track which (order, product) pairs are already reviewed —
// matches the real unique constraint on reviews(product_id, user_id, order_id)
const reviewKey = (orderId: number, productId: string) => `${orderId}:${productId}`

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function OrdersPage() {
  const router = useRouter()
  const { t, locale } = useLang()

  const [orders, setOrders] = useState<Order[]>([])
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<"all" | "pending" | "shipped" | "confirmed" | "delivered" | "cancelled">("all")
  const [pageError, setPageError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // ── slip preview dialog (any slip, current or historical) ──
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null)

  // ── re-upload after a rejected slip (one order at a time) ──
  const [reupload, setReupload] = useState<{
    orderId: number; file: File | null; preview: string; error: string; busy: boolean
  }>({ orderId: 0, file: null, preview: "", error: "", busy: false })

  // ── cancel-order confirm ──
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)
  const [cancelState, setCancelState] = useState<{ error: string; busy: boolean }>({ error: "", busy: false })

  // ── review dialog ──
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set())
  const [reviewItem, setReviewItem] = useState<{ orderId: number; productId: string; name: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState("")
  const [reviewError, setReviewError] = useState("")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // Re-fetch just the orders list (used after re-upload / cancel).
  const loadOrders = async () => {
    const token = getToken()
    if (!token) { router.push("/login"); return }
    try {
      const res = await fetch(`${API}/orders/my`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.error) setPageError(data.error)
      else setOrders(data)
    } catch {
      setPageError(t("orders.loadError"))
    }
  }

  // ── โหลด order list + สถานะที่รีวิวไปแล้ว ──
  useEffect(() => {
    const token = getToken()
    if (!token) { router.push("/login"); return }

    Promise.all([
      fetch(`${API}/orders/my`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json()),
      fetch(`${API}/reviews/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json()),
    ])
      .then(([ordersData, reviewsData]) => {
        if (ordersData.error) {
          setPageError(ordersData.error)
        } else {
          setOrders(ordersData)
        }
        if (Array.isArray(reviewsData)) {
          setReviewedKeys(
            new Set(reviewsData.map((r: { order_id: number; product_id: string }) => reviewKey(r.order_id, r.product_id)))
          )
        }
      })
      .catch(() => setPageError(t("orders.loadError")))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      next.has(orderId) ? next.delete(orderId) : next.add(orderId)
      return next
    })
  }

  const handleViewSlip = (url: string) => setSlipPreviewUrl(url)

  const handleReuploadFile = (e: React.ChangeEvent<HTMLInputElement>, orderId: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setReupload({ orderId, file: null, preview: "", error: t("orders.slipImageOnly"), busy: false })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setReupload({ orderId, file: null, preview: "", error: t("orders.slipTooLarge"), busy: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      setReupload({ orderId, file, preview: reader.result as string, error: "", busy: false })
    reader.readAsDataURL(file)
  }

  const submitReupload = async (orderId: number) => {
    if (reupload.orderId !== orderId || !reupload.file) return
    const token = getToken()
    if (!token) { router.push("/login"); return }
    setReupload((p) => ({ ...p, busy: true, error: "" }))
    try {
      const fd = new FormData()
      fd.append("slip", reupload.file)
      const res = await fetch(`${API}/orders/my/${orderId}/payment-slip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setReupload((p) => ({ ...p, busy: false, error: data.error || t("orders.slipUploadFailed") }))
        return
      }
      setReupload({ orderId: 0, file: null, preview: "", error: "", busy: false })
      await loadOrders()
    } catch {
      setReupload((p) => ({ ...p, busy: false, error: t("orders.connectionError") }))
    }
  }

  const confirmCancel = async () => {
    if (cancelTarget == null) return
    const token = getToken()
    if (!token) { router.push("/login"); return }
    setCancelState({ error: "", busy: true })
    try {
      const res = await fetch(`${API}/orders/my/${cancelTarget}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setCancelState({ error: data.error || t("orders.cancelFailed"), busy: false })
        return
      }
      setCancelTarget(null)
      setCancelState({ error: "", busy: false })
      await loadOrders()
    } catch {
      setCancelState({ error: t("orders.connectionError"), busy: false })
    }
  }

  const openReview = (orderId: number, item: OrderItem) => {
    if (!item.productId || reviewedKeys.has(reviewKey(orderId, item.productId))) return
    setReviewItem({ orderId, productId: item.productId, name: item.name })
    setReviewRating(0)
    setReviewComment("")
    setReviewError("")
  }

  const submitReview = async () => {
    if (!reviewItem || reviewRating === 0) return
    const token = getToken()
    if (!token) { router.push("/login"); return }

    setIsSubmittingReview(true)
    setReviewError("")
    try {
      const res = await fetch(`${API}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: reviewItem.productId,
          order_id: reviewItem.orderId,
          rating: reviewRating,
          body: reviewComment.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReviewError(data.error || t("orders.reviewFailed"))
        return
      }
      setReviewedKeys((prev) => new Set(prev).add(reviewKey(reviewItem.orderId, reviewItem.productId)))
      setReviewItem(null)
    } catch {
      setReviewError(t("orders.connectionError"))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // ── download ใบเสร็จ ──
  const handleDownloadReceipt = async (order: Order) => {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ unit: "mm", format: "a4" })

    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/Sarabun-Regular.ttf"),
      fetch("/fonts/Sarabun-Bold.ttf"),
    ])
    const regularBuf = await regularRes.arrayBuffer()
    const boldBuf = await boldRes.arrayBuffer()
    const toBase64 = (buf: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))

    doc.addFileToVFS("Sarabun-Regular.ttf", toBase64(regularBuf))
    doc.addFileToVFS("Sarabun-Bold.ttf", toBase64(boldBuf))
    doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal")
    doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold")

    const W = 210
    const margin = 20
    let y = 0

    doc.setFillColor(101, 67, 33)
    doc.rect(0, 0, W, 38, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont("Sarabun", "bold")
    doc.text("KEVIN SHOP", margin, 17)
    doc.setFontSize(9)
    doc.setFont("Sarabun", "normal")
    doc.text("ใบเสร็จรับเงิน / Receipt", margin, 25)
    doc.text(`#${order.id}`, W - margin, 17, { align: "right" })
    doc.text(
      new Date(order.date).toLocaleDateString("th-TH", {
        year: "numeric", month: "long", day: "numeric",
      }),
      W - margin, 25, { align: "right" }
    )

    y = 50

    doc.setFillColor(248, 245, 242)
    doc.roundedRect(margin, y, 80, 42, 3, 3, "F")
    doc.setTextColor(120, 80, 50)
    doc.setFontSize(8)
    doc.setFont("Sarabun", "bold")
    doc.text("ข้อมูลจัดส่ง", margin + 5, y + 8)
    doc.setTextColor(60, 60, 60)
    doc.setFont("Sarabun", "normal")
    doc.setFontSize(8.5)
    const recipientLines = doc.splitTextToSize(order.customer, 68)
    const addressLines = doc.splitTextToSize(order.address, 68)
    doc.text(recipientLines, margin + 5, y + 16)
    doc.text(order.phone, margin + 5, y + 16 + recipientLines.length * 5)
    doc.text(addressLines, margin + 5, y + 22 + recipientLines.length * 5)

    doc.setFillColor(248, 245, 242)
    doc.roundedRect(W - margin - 80, y, 80, 42, 3, 3, "F")
    doc.setTextColor(120, 80, 50)
    doc.setFontSize(8)
    doc.setFont("Sarabun", "bold")
    doc.text("การชำระเงิน", W - margin - 75, y + 8)
    doc.setFont("Sarabun", "normal")
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(8.5)
    // Receipt is always rendered in Thai (formal document, bundled Sarabun font).
    const thPaymentLabel = PAYMENT_STATUS_KEYS[order.paymentStatus]
      ? thDict[PAYMENT_STATUS_KEYS[order.paymentStatus]]
      : order.paymentStatus
    doc.text("สถานะ:", W - margin - 75, y + 18)
    doc.text(thPaymentLabel, W - margin - 5, y + 18, { align: "right" })
    doc.text("วิธีชำระเงิน:", W - margin - 75, y + 26)
    doc.text(order.paymentMethod || "-", W - margin - 5, y + 26, { align: "right" })

    y += 52

    doc.setFillColor(101, 67, 33)
    doc.rect(margin, y, W - margin * 2, 9, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8.5)
    doc.setFont("Sarabun", "bold")
    doc.text("สินค้า", margin + 4, y + 6)
    doc.text("จำนวน", 130, y + 6, { align: "center" })
    doc.text("ราคา/ชิ้น", 155, y + 6, { align: "center" })
    doc.text("รวม", W - margin - 4, y + 6, { align: "right" })

    y += 9

    order.items.forEach((item, i) => {
      const rowH = 10
      doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 245)
      doc.rect(margin, y, W - margin * 2, rowH, "F")
      doc.setTextColor(40, 40, 40)
      doc.setFont("Sarabun", "normal")
      doc.setFontSize(8.5)
      const nameLine = doc.splitTextToSize(
        item.name + (item.variant && item.variant !== "-" ? ` (${item.variant})` : ""), 80
      )
      doc.text(nameLine[0], margin + 4, y + 6.5)
      doc.text(`${item.qty}`, 130, y + 6.5, { align: "center" })
      doc.text(`฿${Number(item.price).toFixed(2)}`, 155, y + 6.5, { align: "center" })
      doc.text(`฿${(item.qty * Number(item.price)).toFixed(2)}`, W - margin - 4, y + 6.5, { align: "right" })
      y += rowH
    })

    doc.setDrawColor(220, 210, 200)
    doc.line(margin, y + 4, W - margin, y + 4)
    y += 10

    const summaryX = W - margin - 70
    doc.setFontSize(9)
    doc.setFont("Sarabun", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text("ค่าสินค้า", summaryX, y)
    doc.text(`฿${order.subtotal.toFixed(2)}`, W - margin, y, { align: "right" })
    y += 7
    doc.text("ค่าจัดส่ง", summaryX, y)
    doc.text(order.shippingFee === 0 ? "ฟรี" : `฿${order.shippingFee.toFixed(2)}`, W - margin, y, { align: "right" })
    y += 7

    doc.setFillColor(101, 67, 33)
    doc.roundedRect(summaryX - 5, y - 4, W - margin - summaryX + 9, 12, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("Sarabun", "bold")
    doc.setFontSize(10)
    doc.text("ยอดรวม", summaryX, y + 4.5)
    doc.text(`฿${order.total.toFixed(2)}`, W - margin - 2, y + 4.5, { align: "right" })
    y += 20

    doc.setTextColor(160, 140, 120)
    doc.setFontSize(8)
    doc.setFont("Sarabun", "normal")
    doc.text("ขอบคุณที่ใช้บริการ KEVIN SHOP", W / 2, y, { align: "center" })

    doc.save(`receipt-${order.id}.pdf`)
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
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">{t("orders.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("orders.subtitle")}</p>
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
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
              >
                {f === "all" && `${t("orders.filterAll")} (${orders.length})`}
                {f === "pending" && `${t("orders.os.pending")} (${countOf("pending")})`}
                {f === "shipped" && `${t("orders.os.shipped")} (${countOf("shipped")})`}
                {f === "confirmed" && `${t("orders.os.confirmed")} (${countOf("confirmed")})`}
                {f === "delivered" && `${t("orders.os.delivered")} (${countOf("delivered")})`}
                {f === "cancelled" && `${t("orders.os.cancelled")} (${countOf("cancelled")})`}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">{t("orders.emptyTitle")}</h2>
              <p className="mt-2 text-muted-foreground">{t("orders.emptyHint")}</p>
              <Button className="mt-6" asChild>
                <a href="/products">{t("orders.goShopping")}</a>
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
                              {getStatusLabel(order.status, t)}
                            </Badge>
                            <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                              {getPaymentStatusLabel(order.paymentStatus, t)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground mt-3">
                            <div>
                              <span className="text-xs uppercase tracking-wide">{t("orders.orderedAt")}</span>
                              <p className="text-foreground font-medium">
                                {new Date(order.date).toLocaleDateString(locale, {
                                  year: "numeric", month: "short", day: "numeric",
                                })}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-wide">{t("orders.itemCount")}</span>
                              <p className="text-foreground font-medium">{t("orders.itemsUnit", { n: order.items.length })}</p>
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-wide">{t("orders.total")}</span>
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
                            <h3 className="font-semibold text-foreground mb-3">{t("orders.itemsInOrder")}</h3>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                <div
                                  key={item.productId ? `${item.productId}-${idx}` : idx}
                                  className="flex flex-col gap-3 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex-1">
                                    <p className="text-foreground">{item.name}</p>
                                    {item.variant && item.variant !== "-" && (
                                      <p className="text-xs text-muted-foreground">{item.variant}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground">{t("orders.qtyLabel", { n: item.qty })}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-foreground font-medium">
                                        ฿{(item.qty * Number(item.price)).toFixed(2)}
                                      </p>
                                      <p className="text-sm text-muted-foreground">฿{Number(item.price).toFixed(2)}{t("orders.perPiece")}</p>
                                    </div>
                                    {order.status === "confirmed" && item.productId && (
                                      reviewedKeys.has(reviewKey(order.id, item.productId)) ? (
                                        <span className="text-sm font-medium text-muted-foreground">{t("orders.reviewed")}</span>
                                      ) : (
                                        <Button size="sm" variant="outline" onClick={() => openReview(order.id, item)} className="gap-2">
                                          <Star className="h-4 w-4" /> {t("orders.writeReview")}
                                        </Button>
                                      )
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-border space-y-1">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{t("orders.itemsCost")}</span>
                                <span>฿{order.subtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{t("orders.shippingCost")}</span>
                                <span>{order.shippingFee === 0 ? t("orders.free") : `฿${order.shippingFee.toFixed(2)}`}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border mt-1">
                                <span>{t("orders.grandTotal")}</span>
                                <span className="text-lg">฿{order.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Delivery Info */}
                          <div>
                            <h3 className="font-semibold text-foreground mb-3">{t("orders.deliveryInfo")}</h3>
                            <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                              <p className="text-foreground">{order.customer}</p>
                              <p className="text-muted-foreground">{order.phone}</p>
                              <p className="text-muted-foreground">{order.address}</p>
                            </div>
                          </div>

                          {/* Payment Info */}
                          <div>
                            <h3 className="font-semibold text-foreground mb-3">{t("orders.paymentInfo")}</h3>
                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("orders.paymentMethod")}</span>
                                <span className="text-foreground font-medium">{order.paymentMethod || "-"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("orders.paymentStatus")}</span>
                                <span className={`font-medium ${getPaymentStatusColor(order.paymentStatus)} px-3 py-1 rounded-lg`}>
                                  {getPaymentStatusLabel(order.paymentStatus, t)}
                                </span>
                              </div>
                              {order.paymentSlipUrl && (
                                <div className="pt-3 border-t border-border">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewSlip(order.paymentSlipUrl!)}
                                    className="gap-2 w-full"
                                  >
                                    {t("orders.viewSlip")}
                                  </Button>
                                </div>
                              )}

                              {order.paymentStatus === "rejected" && (
                                <div className="pt-3 border-t border-border space-y-3">
                                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                                    <p className="text-sm font-medium text-destructive">{t("orders.slipRejectedTitle")}</p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {order.paymentRejectReason || t("orders.slipRejectedDefault")}
                                    </p>
                                  </div>

                                  <div>
                                    <input
                                      id={`reupload-${order.id}`}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleReuploadFile(e, order.id)}
                                    />
                                    <label
                                      htmlFor={`reupload-${order.id}`}
                                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                                    >
                                      <Upload className="h-4 w-4" />
                                      {t("orders.chooseNewSlip")}
                                    </label>

                                    {reupload.orderId === order.id && reupload.preview && (
                                      <img
                                        src={reupload.preview}
                                        alt={t("orders.newSlipPreview")}
                                        className="mt-3 max-h-48 w-full rounded-lg border border-border object-contain"
                                      />
                                    )}
                                    {reupload.orderId === order.id && reupload.error && (
                                      <p className="mt-2 text-sm text-destructive">{reupload.error}</p>
                                    )}

                                    <Button
                                      className="mt-3 w-full gap-2"
                                      disabled={
                                        reupload.orderId !== order.id || !reupload.file || reupload.busy
                                      }
                                      onClick={() => submitReupload(order.id)}
                                    >
                                      {reupload.busy ? t("orders.uploading") : t("orders.reuploadSlip")}
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {order.slips && order.slips.length > 1 && (
                                <div className="pt-3 border-t border-border">
                                  <p className="mb-2 text-sm font-medium text-foreground">{t("orders.slipHistory")}</p>
                                  <div className="space-y-2">
                                    {order.slips.map((slip, i) => {
                                      const badge = getSlipBadge(slip.status, t)
                                      return (
                                        <div
                                          key={i}
                                          className="flex items-center gap-3 rounded-lg border border-border p-2"
                                        >
                                          <img
                                            src={slip.url}
                                            alt={t("orders.slipN", { n: i + 1 })}
                                            className="h-14 w-14 flex-none cursor-pointer rounded object-cover"
                                            onClick={() => handleViewSlip(slip.url)}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                                              >
                                                {badge.label}
                                              </span>
                                              {slip.uploadedAt && (
                                                <span className="text-xs text-muted-foreground">
                                                  {new Date(slip.uploadedAt).toLocaleDateString(locale)}
                                                </span>
                                              )}
                                            </div>
                                            {slip.rejectReason && (
                                              <p className="mt-1 text-xs text-destructive">
                                                {slip.rejectReason}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
                            {order.paymentStatus === "paid" && (
                              <Button
                                variant="outline"
                                onClick={() => handleDownloadReceipt(order)}
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                {t("orders.downloadReceipt")}
                              </Button>
                            )}
                            {order.status === "pending" &&
                              ["unpaid", "pending_verification", "rejected"].includes(order.paymentStatus) && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setCancelTarget(order.id)
                                    setCancelState({ error: "", busy: false })
                                  }}
                                  className="gap-2 border-red-200 text-destructive hover:text-destructive"
                                >
                                  <Ban className="h-4 w-4" />
                                  {t("orders.cancelOrder")}
                                </Button>
                              )}
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

      {/* Product Review Dialog */}
      <Dialog open={Boolean(reviewItem)} onOpenChange={(open) => !open && setReviewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("orders.reviewTitle", { name: reviewItem?.name ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">{t("orders.rateProduct")}</p>
              <div className="flex gap-2" role="radiogroup" aria-label={t("orders.ratingAria")}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button key={rating} type="button" onClick={() => setReviewRating(rating)} aria-label={t("orders.starN", { n: rating })} aria-pressed={reviewRating === rating}>
                    <Star className={`h-8 w-8 transition-colors ${rating <= reviewRating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-foreground">{t("orders.comment")}</label>
              <textarea
                id="review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={t("orders.commentPlaceholder")}
                className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {reviewError && <p className="text-sm text-destructive">{reviewError}</p>}
            <Button className="w-full" disabled={reviewRating === 0 || isSubmittingReview} onClick={submitReview}>
              {isSubmittingReview ? t("orders.submittingReview") : t("orders.submitReview")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slip Dialog */}
      <Dialog open={Boolean(slipPreviewUrl)} onOpenChange={(open) => !open && setSlipPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("orders.slipDialogTitle")}</DialogTitle>
          </DialogHeader>
          {slipPreviewUrl && (
            <img
              src={slipPreviewUrl}
              alt="Payment slip"
              className="w-full rounded-lg border border-border"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <Dialog open={cancelTarget != null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("orders.cancelConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("orders.cancelConfirmBody")}
            </p>
            {cancelState.error && <p className="text-sm text-destructive">{cancelState.error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCancelTarget(null)}
                disabled={cancelState.busy}
              >
                {t("orders.keepOrder")}
              </Button>
              <Button
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                onClick={confirmCancel}
                disabled={cancelState.busy}
              >
                {cancelState.busy ? t("orders.cancelling") : t("orders.confirmCancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}