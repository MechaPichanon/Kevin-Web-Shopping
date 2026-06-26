"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Plus,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  DollarSign,
  Eye,
} from "lucide-react"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"

    case "completed":
      return "bg-green-100 text-green-800"

    case "shipping":
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

    case "completed":
      return "สำเร็จ"

    case "shipping":
      return "กำลังจัดส่ง"

    case "cancelled":
      return "ยกเลิก"

    default:
      return status
  }
}

export default function AdminDashboard() {
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [stats, setStats] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])

  useEffect(() => {
    const user = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (!user || !token) {
      router.push("/login")
      return
    }

    const parsed = JSON.parse(user)

    // ✅ check role
    if (parsed.role !== "admin" && parsed.role !== "staff") {
      router.push("/")
      return
    }

    setIsAdmin(true)

    // ✅ fetch dashboard stats
    fetch("http://localhost:5000/admin/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
      })

    // ✅ fetch recent orders
    fetch("http://localhost:5000/admin/orders/recent", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setRecentOrders(data)
      })
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")

    router.push("/login")
  }

  if (!isAdmin || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1ed]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#8b5e3c] border-t-transparent"></div>

          <p className="mt-4 text-[#5b3a29]">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    )
  }

  const dashboardStats = [
    {
      title: "ยอดขายวันนี้",
      value: `฿${stats.sales?.toLocaleString() || 0}`,
      change: "+12.5%",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "คำสั่งซื้อใหม่",
      value: stats.orders || 0,
      change: "+8.2%",
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      title: "สินค้าทั้งหมด",
      value: stats.products || 0,
      change: "+3",
      icon: Package,
      color: "text-purple-600",
    },
    {
      title: "ผู้ใช้ทั้งหมด",
      value: stats.users || 0,
      change: "+18",
      icon: Users,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#f5f1ed]">
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* LOGO */}
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8b5e3c]">
                <span className="font-bold text-white">
                  L
                </span>
              </div>

              <div>
                <p className="text-lg font-semibold">
                  BosButter
                </p>

                <p className="text-xs text-white/60">
                  Admin Panel
                </p>
              </div>
            </Link>

            <button
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  item.href === "/admin"
                    ? "bg-[#8b5e3c] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />

                {item.label}
              </Link>
            ))}
          </nav>

          {/* USER */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b5e3c]">
                <span className="font-semibold">
                  A
                </span>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium">
                  Admin
                </p>

                <p className="text-xs text-white/60">
                  ผู้ดูแลระบบ
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-lg p-2 transition hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-1 flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#e6ddd4] bg-white px-4 lg:px-6">
          <button
            className="mr-4 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6 text-[#5b3a29]" />
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#5b3a29]">
              Dashboard
            </h1>
          </div>

          <Link href="/">
            <button className="flex items-center gap-2 rounded-xl border border-[#d6c4b8] px-4 py-2 text-sm text-[#5b3a29] transition hover:bg-[#f5f1ed]">
              <Eye className="h-4 w-4" />
              ดูหน้าเว็บ
            </button>
          </Link>
        </header>

        {/* CONTENT */}
        <main className="flex-1 p-4 lg:p-6">
          {/* STATS */}
          <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((stat) => (
              <div
                key={stat.title}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {stat.title}
                  </p>

                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>

                <h2 className="text-3xl font-bold text-[#5b3a29]">
                  {stat.value}
                </h2>

                <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  {stat.change}
                </div>
              </div>
            ))}
          </div>

          {/* QUICK ACTION */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-[#5b3a29]">
              การดำเนินการด่วน
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link href="/admin/products?action=add">
                <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8b5e3c]/10">
                    <Plus className="h-6 w-6 text-[#8b5e3c]" />
                  </div>

                  <h3 className="font-semibold text-[#5b3a29]">
                    เพิ่มสินค้าใหม่
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    เพิ่มสินค้าลงในระบบ
                  </p>
                </div>
              </Link>

              <Link href="/admin">
                <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>

                  <h3 className="font-semibold text-[#5b3a29]">
                    ดูคำสั่งซื้อ
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    จัดการคำสั่งซื้อทั้งหมด
                  </p>
                </div>
              </Link>

              <Link href="/admin/users">
                <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>

                  <h3 className="font-semibold text-[#5b3a29]">
                    จัดการผู้ใช้
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    ดูและแก้ไขข้อมูลผู้ใช้
                  </p>
                </div>
              </Link>

              <Link href="/admin/products">
                <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>

                  <h3 className="font-semibold text-[#5b3a29]">
                    จัดการสินค้า
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    แก้ไขและลบสินค้า
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* RECENT ORDERS */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#5b3a29]">
                คำสั่งซื้อล่าสุด
              </h2>

              <Link href="/admin/orders">
                <button className="rounded-xl border border-[#d6c4b8] px-4 py-2 text-sm text-[#5b3a29] transition hover:bg-white">
                  ดูทั้งหมด
                </button>
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f5f1ed]">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-medium text-gray-500">
                        รหัสคำสั่งซื้อ
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-medium text-gray-500">
                        ลูกค้า
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-medium text-gray-500">
                        ยอดรวม
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-medium text-gray-500">
                        สถานะ
                      </th>

                      <th className="px-5 py-4 text-left text-sm font-medium text-gray-500">
                        วันที่
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-t border-gray-100 hover:bg-[#faf8f6]"
                      >
                        <td className="px-5 py-4 font-medium text-[#5b3a29]">
                          {order.id}
                        </td>

                        <td className="px-5 py-4">
                          {order.customer}
                        </td>

                        <td className="px-5 py-4">
                          ฿{order.total?.toLocaleString()}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-500">
                          {order.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}