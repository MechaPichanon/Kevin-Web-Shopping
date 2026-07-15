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

  const updatePaymentStatus = async (orderId: string, newPaymentStatus: string) => {
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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
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
              <span className="font-serif text-lg font-semibold text-foreground">Admin</span>
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
                <div>
                  {selectedOrder ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{selectedOrder.id}</span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                              selectedOrder.status
                            )}`}
                          >
                            {getStatusText(selectedOrder.status)}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">ข้อมูลลูกค้า</h4>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>{selectedOrder.customer}</p>
                            <p>{selectedOrder.phone}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">ที่อยู่จัดส่ง</h4>
                          <p className="text-sm text-muted-foreground">{selectedOrder.address}</p>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">สินค้า</h4>
                          <div className="space-y-2">
                            {selectedOrder.items.map((item, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {item.name}
                                  {item.variant && item.variant !== "-" ? ` (${item.variant})` : ""} x{item.qty}
                                </span>
                                <span className="text-foreground">
                                  ฿{(item.price * item.qty).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-border pt-2">
                              <div className="flex items-center justify-between font-medium">
                                <span>ยอดรวม</span>
                                <span>฿{selectedOrder.total.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">การชำระเงิน</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">วิธีชำระเงิน</span>
                              <span className="text-foreground">{selectedOrder.paymentMethod ?? "ไม่ระบุ"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">สถานะ</span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentColor(
                                  selectedOrder.paymentStatus
                                )}`}
                              >
                                {getPaymentText(selectedOrder.paymentStatus)}
                              </span>
                            </div>
                          </div>

                          {selectedOrder.paymentStatus === "pending_verification" && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => updatePaymentStatus(selectedOrder.id, "paid")}
                              >
                                <CheckCircle className="h-4 w-4" />
                                ยืนยันการชำระ
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                                onClick={() => updatePaymentStatus(selectedOrder.id, "rejected")}
                              >
                                <XCircle className="h-4 w-4" />
                                สลิปไม่ถูกต้อง
                              </Button>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">อัปเดตสถานะ</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => updateOrderStatus(selectedOrder.id, "pending")}
                            >
                              <Clock className="h-4 w-4" />
                              รอดำเนินการ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => updateOrderStatus(selectedOrder.id, "shipped")}
                            >
                              <Truck className="h-4 w-4" />
                              กำลังจัดส่ง
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-green-600 hover:text-green-600"
                              onClick={() => updateOrderStatus(selectedOrder.id, "confirmed")}
                            >
                              <CheckCircle className="h-4 w-4" />
                              สำเร็จ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive"
                              onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                            >
                              <XCircle className="h-4 w-4" />
                              ยกเลิก
                            </Button>
                          </div>
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