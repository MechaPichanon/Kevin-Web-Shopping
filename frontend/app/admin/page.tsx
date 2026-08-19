"use client"

import { useState, useEffect, useMemo } from "react"
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
  TrendingDown,
  DollarSign,
  Eye,
  AlertCircle,
} from "lucide-react"
import {
  fetchDashboardStats,
  fetchRevenueDaily,
  fetchRecentOrders,
  fetchBestSellers,
  fetchLowStock,
  type DashboardStats,
  type RevenueDaily,
  type RecentOrder,
  type BestSeller,
  type LowStockItem,
} from "@/lib/admin"

// "New"/no-change wording for a comparison whose baseline was zero (e.g. no
// orders yesterday), otherwise a plain day-over-day / period-over-period %.
const formatDelta = (current: number, previous: number) => {
  const c = Number(current)
  const p = Number(previous)

  if (p === 0) {
    return { text: c > 0 ? "ใหม่" : "0%", isUp: c >= 0 }
  }

  const pct = ((c - p) / p) * 100
  return { text: `${Math.abs(pct).toFixed(1)}%`, isUp: pct >= 0 }
}

function TrendLabel({ delta }: { delta: { text: string; isUp: boolean } }) {
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${delta.isUp ? "text-green-700" : "text-red-700"}`}>
      {delta.isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {delta.text}
    </span>
  )
}

const fmtBaht = (v: number) => (v >= 1000 ? `฿${(v / 1000).toFixed(1)}k` : `฿${Math.round(v)}`)

// IBM Plex Mono has no glyph for ฿, so browsers fall back to a different font
// just for that character — its advance width collides with the digit that
// follows. Keep ฿ in the default UI font and put only the digits in mono.
function Money({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={className}>
      ฿<span className="font-mono">{Math.round(value).toLocaleString()}</span>
    </span>
  )
}

const THAI_MONTHS_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const formatThaiDate = (isoDate: string) => {
  const [, m, d] = isoDate.split("-").map(Number)
  return `${d} ${THAI_MONTHS_ABBR[m - 1]}`
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const quickActions = [
  { href: "/admin/products?action=add", icon: Plus, title: "เพิ่มสินค้าใหม่", subtitle: "เพิ่มสินค้าลงในระบบ", iconBg: "bg-primary/10", iconColor: "text-primary" },
  { href: "/admin/orders", icon: ShoppingCart, title: "ดูคำสั่งซื้อ", subtitle: "จัดการคำสั่งซื้อทั้งหมด", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  { href: "/admin/users", icon: Users, title: "จัดการผู้ใช้", subtitle: "ดูและแก้ไขข้อมูลผู้ใช้", iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  { href: "/admin/products", icon: Package, title: "จัดการสินค้า", subtitle: "แก้ไขและลบสินค้า", iconBg: "bg-purple-100", iconColor: "text-purple-600" },
]

// Covers all 6 orders.status DB values (pending/confirmed/shipped/delivered/
// cancelled/refunded) — the previous version only handled 4 and silently
// fell through to raw English for delivered/refunded orders.
const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "confirmed":
      return "bg-green-100 text-green-800"
    case "shipped":
      return "bg-blue-100 text-blue-800"
    case "delivered":
      return "bg-green-100 text-green-800"
    case "cancelled":
      return "bg-red-100 text-red-800"
    case "refunded":
      return "bg-orange-100 text-orange-800"
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
    case "delivered":
      return "จัดส่งสำเร็จ"
    case "cancelled":
      return "ยกเลิก"
    case "refunded":
      return "คืนเงินแล้ว"
    default:
      return status
  }
}

export default function AdminDashboard() {
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [revenueDaily, setRevenueDaily] = useState<RevenueDaily | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [revenueError, setRevenueError] = useState<string | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [bestSellers, setBestSellers] = useState<BestSeller[]>([])
  const [bestSellersLoading, setBestSellersLoading] = useState(true)
  const [bestSellersError, setBestSellersError] = useState<string | null>(null)

  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [lowStockLoading, setLowStockLoading] = useState(true)
  const [lowStockError, setLowStockError] = useState<string | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("user")
    const token = localStorage.getItem("token")

    if (!user || !token) {
      router.push("/login")
      return
    }

    const parsed = JSON.parse(user)

    if (parsed.role !== "admin" && parsed.role !== "staff") {
      router.push("/")
      return
    }

    setIsAdmin(true)

    fetchDashboardStats()
      .then(setStats)
      .catch((e: Error) => setStatsError(e.message))
      .finally(() => setStatsLoading(false))

    fetchRevenueDaily()
      .then(setRevenueDaily)
      .catch((e: Error) => setRevenueError(e.message))
      .finally(() => setRevenueLoading(false))

    fetchRecentOrders()
      .then(setRecentOrders)
      .catch((e: Error) => setOrdersError(e.message))
      .finally(() => setOrdersLoading(false))

    fetchBestSellers(5)
      .then(setBestSellers)
      .catch((e: Error) => setBestSellersError(e.message))
      .finally(() => setBestSellersLoading(false))

    fetchLowStock()
      .then(setLowStock)
      .catch((e: Error) => setLowStockError(e.message))
      .finally(() => setLowStockLoading(false))
  }, [router])

  const chartData = useMemo(() => {
    if (!revenueDaily || revenueDaily.current.length === 0) return null

    const currentVals = revenueDaily.current.map((d) => d.revenue)
    const previousVals = revenueDaily.previous.map((d) => d.revenue)
    const hasData = [...currentVals, ...previousVals].some((v) => v > 0)
    if (!hasData) return { hasData: false as const }

    const w = 720
    const h = 180
    const pad = 10
    const min = Math.min(...currentVals, ...previousVals)
    const max = Math.max(...currentVals, ...previousVals)
    const range = max - min || 1 // guard div-by-zero when every value is equal
    const n = currentVals.length

    const scaleY = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2)
    const scaleX = (i: number) => (i / (n - 1)) * w
    const toPath = (vals: number[]) =>
      vals.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ")

    const linePath = toPath(currentVals)
    const steps = 4

    return {
      hasData: true as const,
      w,
      h,
      n,
      scaleX,
      scaleY,
      current: revenueDaily.current,
      currentVals,
      previousVals,
      linePath,
      prevLinePath: toPath(previousVals),
      areaPath: `${linePath} L${w},${h} L0,${h} Z`,
      yLabels: Array.from({ length: steps + 1 }, (_, i) => fmtBaht(max - (i / steps) * range)),
      gridY: Array.from({ length: steps + 1 }, (_, i) => (pad + (i / steps) * (h - pad * 2)).toFixed(1)),
    }
  }, [revenueDaily])

  const hoverPoint = useMemo(() => {
    if (!chartData || !chartData.hasData || hoverIndex === null) return null
    const { current, currentVals, previousVals, scaleX, scaleY, w } = chartData
    const idx = hoverIndex
    const xPct = (scaleX(idx) / w) * 100

    return {
      x: scaleX(idx).toFixed(1),
      curY: scaleY(currentVals[idx]).toFixed(1),
      prevY: scaleY(previousVals[idx]).toFixed(1),
      date: formatThaiDate(current[idx].date),
      curVal: fmtBaht(currentVals[idx]),
      prevVal: fmtBaht(previousVals[idx]),
      leftPct: xPct,
      transform: xPct > 70 ? "translateX(-100%)" : xPct < 8 ? "translateX(0%)" : "translateX(-50%)",
    }
  }, [chartData, hoverIndex])

  const handleChartMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartData || !chartData.hasData) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHoverIndex(Math.round(ratio * (chartData.n - 1)))
  }
  const handleChartLeave = () => setHoverIndex(null)

  const chartDots = chartData?.hasData
    ? chartData.currentVals
        .map((v, i) => ({ x: chartData.scaleX(i).toFixed(1), y: chartData.scaleY(v).toFixed(1), i }))
        .filter((d) => d.i % 6 === 0 || d.i === chartData.n - 1)
    : []

  const xAxisLabels = chartData?.hasData
    ? [0, 0.25, 0.5, 0.75, 1].map((f) => formatThaiDate(chartData.current[Math.round(f * (chartData.n - 1))].date))
    : []

  const periodChange = chartData?.hasData
    ? formatDelta(chartData.currentVals.reduce((a, b) => a + b, 0), chartData.previousVals.reduce((a, b) => a + b, 0))
    : null

  const maxBestSellerSold = bestSellers.length > 0 ? Math.max(...bestSellers.map((p) => Number(p.total_sold))) : 0

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed top-20 bottom-0 left-0 z-40 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8b5e3c]">
                <span className="font-bold text-white">L</span>
              </div>
              <div>
                <p className="text-lg font-semibold">BosButter</p>
                <p className="text-xs text-white/60">Admin Panel</p>
              </div>
            </Link>
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  item.href === "/admin" ? "bg-[#8b5e3c] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b5e3c]">
                <span className="font-semibold">A</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-white/60">ผู้ดูแลระบบ</p>
              </div>
              <button onClick={handleLogout} className="rounded-lg p-2 transition hover:bg-white/10">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-20 z-30 flex h-16 items-center border-b border-border bg-card px-4 lg:px-6">
          <button className="mr-4 lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          </div>

          <Link href="/">
            <button className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/40">
              <Eye className="h-4 w-4" />
              ดูหน้าเว็บ
            </button>
          </Link>
        </header>

        <main className="flex-1 space-y-6 p-4 lg:p-6">
          {/* KPI CARDS */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_repeat(3,minmax(200px,1fr))]">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-muted" />
              ))
            ) : statsError || !stats ? (
              <div className="col-span-full flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-red-700 shadow-sm">
                <AlertCircle className="h-4 w-4 flex-none" />
                {statsError || "โหลดข้อมูลสรุปไม่สำเร็จ"}
              </div>
            ) : (
              <>
                <div className="flex min-w-[280px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">ยอดขาย</span>
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <DollarSign className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">วันนี้</span>
                      <Money value={stats.sales} className="whitespace-nowrap text-[22px] font-semibold text-foreground" />
                      <TrendLabel delta={formatDelta(stats.sales, stats.sales_yesterday)} />
                    </div>
                    <div className="w-px flex-none bg-border" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">เดือนนี้</span>
                      <Money value={stats.sales_month} className="whitespace-nowrap text-[22px] font-semibold text-foreground" />
                      <TrendLabel delta={formatDelta(stats.sales_month, stats.sales_prev_month)} />
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[220px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">กำไร (วันนี้)</span>
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <DollarSign className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <Money value={stats.profit} className="text-[28px] font-semibold text-foreground" />
                  <TrendLabel delta={formatDelta(stats.profit, stats.profit_yesterday)} />
                </div>

                <div className="flex min-w-[220px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">คำสั่งซื้อใหม่</span>
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShoppingCart className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <div className="font-mono text-[28px] font-semibold text-foreground">{stats.orders}</div>
                  <TrendLabel delta={formatDelta(stats.orders, stats.orders_yesterday)} />
                </div>

                <div className="flex min-w-[220px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">ผู้ใช้ทั้งหมด</span>
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <div className="font-mono text-[28px] font-semibold text-foreground">{stats.users}</div>
                  <span className="text-xs font-medium text-muted-foreground">+{stats.users_new_today} วันนี้</span>
                </div>
              </>
            )}
          </section>

          {/* REVENUE CHART */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">ยอดขายรายวัน</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  30 วันที่ผ่านมา เทียบกับช่วงก่อนหน้า · ไม่รวมคำสั่งซื้อที่ยกเลิก/คืนเงิน
                </p>
              </div>
              {periodChange && (
                <span
                  className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    periodChange.isUp ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {periodChange.isUp ? "▲" : "▼"} {periodChange.text}
                </span>
              )}
            </div>

            {revenueLoading ? (
              <div className="h-[220px] animate-pulse rounded-xl bg-muted" />
            ) : revenueError ? (
              <p className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {revenueError}
              </p>
            ) : !chartData?.hasData ? (
              <div className="flex h-[180px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
                ยังไม่มีข้อมูลยอดขายในช่วง 60 วันที่ผ่านมา
              </div>
            ) : (
              <>
                <div className="flex gap-2.5">
                  <div
                    className="flex flex-none flex-col justify-between text-[11px] text-muted-foreground"
                    style={{ height: 180 }}
                  >
                    {chartData.yLabels.map((y, i) => (
                      <span key={i}>{y}</span>
                    ))}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <svg
                      viewBox="0 0 720 180"
                      preserveAspectRatio="none"
                      className="block h-[180px] w-full cursor-crosshair"
                      onMouseMove={handleChartMove}
                      onMouseLeave={handleChartLeave}
                    >
                      {chartData.gridY.map((g, i) => (
                        <line key={i} x1={0} y1={g} x2={720} y2={g} stroke="#e0d5c8" strokeWidth={1} />
                      ))}
                      <path d={chartData.areaPath} fill="rgba(139,94,60,.1)" stroke="none" />
                      <path d={chartData.prevLinePath} fill="none" stroke="#d8c9b8" strokeWidth={2} strokeDasharray="4 4" />
                      <path d={chartData.linePath} fill="none" stroke="#8b5e3c" strokeWidth={2.5} />
                      {chartDots.map((d) => (
                        <circle key={d.i} cx={d.x} cy={d.y} r={3} fill="#8b5e3c" />
                      ))}
                      {hoverPoint && (
                        <>
                          <line x1={hoverPoint.x} y1={0} x2={hoverPoint.x} y2={180} stroke="#8b5e3c" strokeWidth={1} strokeDasharray="3 3" />
                          <circle cx={hoverPoint.x} cy={hoverPoint.curY} r={4} fill="#8b5e3c" stroke="#fff" strokeWidth={1.5} />
                          <circle cx={hoverPoint.x} cy={hoverPoint.prevY} r={4} fill="#b89f8d" stroke="#fff" strokeWidth={1.5} />
                        </>
                      )}
                    </svg>
                    {hoverPoint && (
                      <div
                        className="pointer-events-none absolute top-2 min-w-[130px] rounded-lg bg-[#3d3025] p-2.5 text-[11.5px] text-white"
                        style={{ left: `${hoverPoint.leftPct}%`, transform: hoverPoint.transform }}
                      >
                        <div className="mb-1.5 text-white/60">{hoverPoint.date}</div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#c8a688]" />
                            ช่วงนี้
                          </span>
                          <span>{hoverPoint.curVal}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-[#8a7a68]" />
                            ช่วงก่อนหน้า
                          </span>
                          <span>{hoverPoint.prevVal}</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                      {xAxisLabels.map((label, i) => (
                        <span key={i}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2.5px] w-4 rounded-full bg-[#8b5e3c]" />
                    ช่วงนี้
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[2px] w-4 rounded-full bg-[#d8c9b8]" />
                    ช่วงก่อนหน้า
                  </span>
                </div>
              </>
            )}
          </section>

          {/* QUICK ACTIONS */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">การดำเนินการด่วน</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${action.iconBg}`}>
                      <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{action.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* RECENT ORDERS */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">คำสั่งซื้อล่าสุด</h2>
              <Link href="/admin/orders">
                <button className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition hover:bg-muted/40">
                  ดูทั้งหมด
                </button>
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                {ordersLoading ? (
                  <div className="space-y-2 p-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : ordersError ? (
                  <p className="flex items-center gap-2 p-5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {ordersError}
                  </p>
                ) : recentOrders.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">ยังไม่มีคำสั่งซื้อ</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-5 py-4 text-left text-sm font-medium text-muted-foreground">รหัสคำสั่งซื้อ</th>
                        <th className="px-5 py-4 text-left text-sm font-medium text-muted-foreground">ลูกค้า</th>
                        <th className="px-5 py-4 text-left text-sm font-medium text-muted-foreground">ยอดรวม</th>
                        <th className="px-5 py-4 text-left text-sm font-medium text-muted-foreground">สถานะ</th>
                        <th className="px-5 py-4 text-left text-sm font-medium text-muted-foreground">วันที่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-5 py-4 font-mono font-medium text-foreground">#{order.id}</td>
                          <td className="px-5 py-4 text-foreground">{order.customer}</td>
                          <td className="px-5 py-4 text-foreground">
                            <Money value={Number(order.total)} />
                          </td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{order.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* BEST SELLERS + LOW STOCK */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">สินค้าขายดี</h2>
              {bestSellersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : bestSellersError ? (
                <p className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {bestSellersError}
                </p>
              ) : bestSellers.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการขาย</p>
              ) : (
                <ul className="space-y-4">
                  {bestSellers.map((p, i) => {
                    const sold = Number(p.total_sold)
                    const pct = maxBestSellerSold > 0 ? Math.round((sold / maxBestSellerSold) * 100) : 0
                    return (
                      <li key={p.product_id} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[11px] font-bold ${
                                i === 0 ? "bg-primary text-white" : "bg-primary/10 text-primary"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className={`text-sm text-foreground ${i === 0 ? "font-semibold" : "font-normal"}`}>
                              {p.product_name_th || p.product_name}
                            </span>
                          </div>
                          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{sold} ชิ้น</span>
                        </div>
                        <div className="h-[7px] overflow-hidden rounded-full bg-primary/10">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-secondary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">สินค้าใกล้หมดสต็อก</h2>
              {lowStockLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : lowStockError ? (
                <p className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {lowStockError}
                </p>
              ) : lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">สต็อกเพียงพอทุกรายการ</p>
              ) : (
                <ul className="space-y-3">
                  {lowStock.map((v) => (
                    <li
                      key={v.variant_id}
                      className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{v.product_name_th || v.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.size} · {v.color_th || v.color}
                        </p>
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        เหลือ {v.stock} ชิ้น
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
