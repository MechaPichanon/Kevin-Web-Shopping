"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  Phone,
  CreditCard,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  fetchOrders,
  updateOrderStatusApi,
  updatePaymentStatusApi,
  type Order,
} from "@/lib/orders"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รอดำเนินการ" },
  { value: "shipped", label: "กำลังจัดส่ง" },
  { value: "confirmed", label: "สำเร็จ" },
  { value: "cancelled", label: "ยกเลิก" },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "confirmed":
      return "bg-green-100 text-green-800"
    case "shipped":
      return "bg-blue-100 text-blue-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case "pending":
      return "รอดำเนินการ"
    case "confirmed":
      return "สำเร็จ"
    case "shipped":
      return "กำลังจัดส่ง"
    case "cancelled":
      return "ยกเลิก"
    default:
      return status
  }
}

const getPaymentColor = (status?: string) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800"
    case "pending_verification":
      return "bg-yellow-100 text-yellow-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getPaymentText = (status?: string) => {
  switch (status) {
    case "paid":
      return "ชำระแล้ว"
    case "pending_verification":
      return "รอตรวจสอบสลิป"
    case "rejected":
      return "สลิปไม่ถูกต้อง"
    case "unpaid":
      return "ยังไม่ชำระ"
    default:
      return "ไม่ระบุ"
  }
}

const customerInitial = (name: string) => (name || "?").trim().charAt(0).toUpperCase()

const avatarPalette = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-green-100 text-green-600",
  "bg-orange-100 text-orange-600",
  "bg-red-100 text-red-600",
  "bg-sky-100 text-sky-600",
]

const avatarColor = (seed: string) => {
  let hash = 0
  for (const char of seed || "") hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return avatarPalette[hash % avatarPalette.length]
}

const statusUpdateOptions = [
  { value: "pending", label: "รอดำเนินการ", icon: Clock },
  { value: "shipped", label: "กำลังจัดส่ง", icon: Truck },
  { value: "confirmed", label: "สำเร็จ", icon: CheckCircle },
  { value: "cancelled", label: "ยกเลิก", icon: XCircle },
]

export default function AdminOrdersPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [adminEmail, setAdminEmail] = useState("")

  useEffect(() => {
    // ⚠️ Assumes login stores the JWT under "token" and the user object
    // (with a "role" field) under "user" — matches server.js's /auth/login
    // response shape { token, user: { id, username, email, role } }.
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")
    if (!token || !user) {
      router.push("/login")
      return
    }
    const parsed = JSON.parse(user)
    if (parsed.role !== "admin") {
      router.push("/login")
      return
    }
    setIsAdmin(true)
    setAdminEmail(parsed.email ?? "")

    fetchOrders()
      .then(setOrders)
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const updatePaymentStatus = async (orderId: number, newPaymentStatus: string) => {
    // optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o))
    )
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, paymentStatus: newPaymentStatus })
    }
    try {
      await updatePaymentStatusApi(orderId, newPaymentStatus)
    } catch (err) {
      console.error(err)
      // rollback by re-fetching if the update failed server-side
      fetchOrders().then(setOrders).catch(() => {})
    }
  }

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus })
    }
    try {
      await updateOrderStatusApi(orderId, newStatus)
    } catch (err) {
      console.error(err)
      fetchOrders().then(setOrders).catch(() => {})
    }
  }

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      String(o.id).includes(searchTerm) ||
      o.customer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-20 bottom-0 left-0 z-40 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">L</span>
              </div>
              <div>
                <span className="font-semibold">BosButter</span>
                <p className="text-xs text-white/60">Admin Panel</p>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  item.href === "/admin/orders"
                    ? "bg-[#8b5e3c] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-medium text-primary">A</span>
              </div>
              <div className="flex-1">
                <span className="font-semibold">BosButter</span>
                <p className="text-xs text-white/60">Admin Panel</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">คำสั่งซื้อ</h1>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : loadError ? (
            <Card>
              <CardContent className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                <p className="text-destructive">{loadError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsLoading(true)
                    setLoadError(null)
                    fetchOrders()
                      .then(setOrders)
                      .catch((err) => setLoadError(err.message))
                      .finally(() => setIsLoading(false))
                  }}
                >
                  ลองใหม่
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {orders.filter((o) => o.status === "pending").length}
                      </p>
                      <p className="text-sm text-muted-foreground">รอดำเนินการ</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Truck className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {orders.filter((o) => o.status === "shipped").length}
                      </p>
                      <p className="text-sm text-muted-foreground">กำลังจัดส่ง</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {orders.filter((o) => o.status === "confirmed").length}
                      </p>
                      <p className="text-sm text-muted-foreground">สำเร็จ</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {orders.filter((o) => o.status === "cancelled").length}
                      </p>
                      <p className="text-sm text-muted-foreground">ยกเลิก</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาคำสั่งซื้อ..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button
                      key={status.value}
                      variant={statusFilter === status.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(status.value)}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Orders List */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">รหัส</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ลูกค้า</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ยอดรวม</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">สถานะ</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">วันที่</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                  ไม่พบคำสั่งซื้อ
                                </td>
                              </tr>
                            ) : (
                              filteredOrders.map((order) => (
                                <tr
                                  key={order.id}
                                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                                    selectedOrder?.id === order.id ? "bg-primary/5" : "hover:bg-muted/30"
                                  }`}
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-foreground">{order.id}</td>
                                  <td className="px-4 py-3 text-sm text-foreground">{order.customer}</td>
                                  <td className="px-4 py-3 text-sm text-foreground">
                                    ฿{order.total.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <span
                                        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                                          order.status
                                        )}`}
                                      >
                                        {getStatusText(order.status)}
                                      </span>
                                      {order.paymentStatus === "pending_verification" && (
                                        <span
                                          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentColor(
                                            order.paymentStatus
                                          )}`}
                                        >
                                          {getPaymentText(order.paymentStatus)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.date}</td>
                                  <td className="px-4 py-3">
                                    <Button variant="ghost" size="icon">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Order Details */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                  {selectedOrder ? (
                    <Card>
                      <CardHeader className="border-b">
                        <CardTitle className="flex items-start justify-between">
                          <div>
                            <span className="block">{selectedOrder.id}</span>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {selectedOrder.date}
                            </span>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                              selectedOrder.status
                            )}`}
                          >
                            {getStatusText(selectedOrder.status)}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="divide-y divide-border px-5">
                        {/* customer */}
                        <div className="py-5 first:pt-3 last:pb-5">
                          <div className="mb-3 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-100">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">ข้อมูลลูกค้า</h4>
                          </div>
                          <div className="flex items-center gap-3 pl-1">
                            <div
                              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold ${avatarColor(
                                selectedOrder.customer
                              )}`}
                            >
                              {customerInitial(selectedOrder.customer)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{selectedOrder.customer}</p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{selectedOrder.phone}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* address */}
                        <div className="py-5 first:pt-3 last:pb-5">
                          <div className="mb-2.5 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-purple-100">
                              <MapPin className="h-4 w-4 text-purple-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">ที่อยู่จัดส่ง</h4>
                          </div>
                          <p className="pl-1 text-sm leading-relaxed text-muted-foreground">
                            {selectedOrder.address}
                          </p>
                        </div>

                        {/* items */}
                        <div className="py-5 first:pt-3 last:pb-5">
                          <div className="mb-3 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-orange-100">
                              <Package className="h-4 w-4 text-orange-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">สินค้า</h4>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/50 px-3">
                            {selectedOrder.items.map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.variant && item.variant !== "-" ? `${item.variant} · ` : ""}x{item.qty}
                                  </p>
                                </div>
                                <span className="whitespace-nowrap text-sm text-foreground">
                                  ฿{(item.price * item.qty).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
                              <span>ยอดสินค้า</span>
                              <span>฿{selectedOrder.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between pb-2.5 text-xs text-muted-foreground">
                              <span>ค่าจัดส่ง</span>
                              <span>
                                {selectedOrder.shippingFee ? `฿${selectedOrder.shippingFee.toLocaleString()}` : "ฟรี"}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                            <span className="text-sm font-semibold text-muted-foreground">ยอดรวมทั้งสิ้น</span>
                            <span className="text-xl font-bold text-primary">
                              ฿{selectedOrder.total.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* payment */}
                        <div className="py-5 first:pt-3 last:pb-5">
                          <div className="mb-3 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-green-100">
                              <CreditCard className="h-4 w-4 text-green-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">การชำระเงิน</h4>
                          </div>
                          <div className="flex items-center justify-between pl-1">
                            <span className="text-sm text-muted-foreground">
                              {selectedOrder.paymentMethod ?? "ไม่ระบุ"}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentColor(
                                selectedOrder.paymentStatus
                              )}`}
                            >
                              {getPaymentText(selectedOrder.paymentStatus)}
                            </span>
                          </div>

                          {selectedOrder.paymentSlipUrl && (
                            <a
                              href={selectedOrder.paymentSlipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 block"
                            >
                              <img
                                src={selectedOrder.paymentSlipUrl}
                                alt="สลิปการโอนเงิน"
                                className="max-h-64 w-full rounded-lg border border-border object-contain"
                              />
                            </a>
                          )}

                          {selectedOrder.paymentStatus === "pending_verification" && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                className="gap-2 bg-green-600 text-white hover:bg-green-700"
                                onClick={() => updatePaymentStatus(selectedOrder.id, "paid")}
                              >
                                <CheckCircle className="h-4 w-4" />
                                ยืนยันการชำระ
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-red-200 text-destructive hover:text-destructive"
                                onClick={() => updatePaymentStatus(selectedOrder.id, "rejected")}
                              >
                                <XCircle className="h-4 w-4" />
                                สลิปไม่ถูกต้อง
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* status */}
                        <div className="py-5 first:pt-3 last:pb-5">
                          <div className="mb-3 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-100">
                              <RefreshCw className="h-4 w-4 text-slate-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground">อัปเดตสถานะ</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {statusUpdateOptions.map((opt) => {
                              const isActive = selectedOrder.status === opt.value
                              return (
                                <Button
                                  key={opt.value}
                                  variant={isActive ? "default" : "outline"}
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => updateOrderStatus(selectedOrder.id, opt.value)}
                                >
                                  <opt.icon className="h-4 w-4" />
                                  {opt.label}
                                </Button>
                              )
                            })}
                          </div>

                          {selectedOrder.trackingNumber && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                              <Truck className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">เลขพัสดุ</span>
                              <span className="ml-auto text-xs font-semibold text-foreground">
                                {selectedOrder.trackingNumber}
                              </span>
                            </div>
                          )}

                          {selectedOrder.notes && (
                            <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-600" />
                              <p className="text-xs leading-relaxed text-amber-800">{selectedOrder.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex h-64 flex-col items-center justify-center text-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-4 text-muted-foreground">เลือกคำสั่งซื้อเพื่อดูรายละเอียด</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}