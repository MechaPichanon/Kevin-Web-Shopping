"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BarChart3, Check, Copy, Gift, LogOut, Menu, Package, Plus, Settings, MessageSquare, ShoppingCart, Trash2, Users, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getToken } from "@/lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

const navItems = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
    { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
    { href: "/admin/chat", label: "แชทลูกค้า", icon: MessageSquare },
    { href: "/admin/discounts", label: "โค้ดส่วนลด", icon: Gift },
    { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
    { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

type Discount = {
    code_id: number
    code: string
    discount_type: "percent" | "fixed"
    discount_value: number
    min_order: number
    max_uses: number | null
    used_count: number
    starts_at: string | null
    expires_at: string | null
    is_active: boolean
}

const emptyForm = {
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    min_order: "",
    max_uses: "",
    expires_at: "",
}

export default function AdminDiscountsPage() {
    const router = useRouter()
    const [discounts, setDiscounts] = useState<Discount[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [copied, setCopied] = useState("")
    const [form, setForm] = useState(emptyForm)
    const [formError, setFormError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [adminUser, setAdminUser] = useState<{ username: string; email: string } | null>(null)

    // ── โหลด discounts ──
    const fetchDiscounts = async () => {
        const token = getToken()
        if (!token) { router.push("/login"); return }
        try {
            const res = await fetch(`${API}/admin/discounts`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.status === 401 || res.status === 403) { router.push("/login"); return }
            const data = await res.json()
            setDiscounts(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error("fetch discounts error:", err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        const stored = localStorage.getItem("user")
        if (!stored) { router.push("/login"); return }
        try {
            const user = JSON.parse(stored)
            if (user.role !== "admin" && user.role !== "staff") { router.push("/login"); return }
            setAdminUser(user)
        } catch { router.push("/login"); return }
        fetchDiscounts()
    }, [router])

    // ── เพิ่มโค้ดใหม่ ──
    const handleSubmit = async () => {
        setFormError("")
        const code = form.code.trim().toUpperCase()
        const value = Number(form.discount_value)

        if (!code) { setFormError("กรุณากรอกชื่อโค้ด"); return }
        if (!value || value <= 0) { setFormError("กรุณากรอกมูลค่าส่วนลด"); return }
        if (form.discount_type === "percent" && value > 100) { setFormError("เปอร์เซ็นต์ต้องไม่เกิน 100"); return }

        setIsSubmitting(true)
        try {
            const token = getToken()
            const res = await fetch(`${API}/admin/discounts`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    code,
                    discount_type: form.discount_type,
                    discount_value: value,
                    min_order: Number(form.min_order) || 0,
                    max_uses: form.max_uses ? Number(form.max_uses) : null,
                    expires_at: form.expires_at
                        ? `${form.expires_at}:00+07:00`
                        : null,
                }),
            })
            const data = await res.json()
            if (!res.ok) { setFormError(data.error || "เกิดข้อผิดพลาด"); return }
            setForm(emptyForm)
            setShowForm(false)
            fetchDiscounts()
        } catch {
            setFormError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── toggle active ──
    const handleToggle = async (discount: Discount) => {
        const token = getToken()
        try {
            await fetch(`${API}/admin/discounts/${discount.code_id}/toggle`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            })
            fetchDiscounts()
        } catch (err) {
            console.error("toggle error:", err)
        }
    }

    // ── ลบโค้ด ──
    const handleDelete = async (code_id: number) => {
        if (!confirm("ต้องการลบโค้ดนี้?")) return
        const token = getToken()
        try {
            await fetch(`${API}/admin/discounts/${code_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            fetchDiscounts()
        } catch (err) {
            console.error("delete error:", err)
        }
    }

    const copyCode = async (code: string) => {
        await navigator.clipboard.writeText(code)
        setCopied(code)
        setTimeout(() => setCopied(""), 1600)
    }

    const handleLogout = () => {
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        router.push("/login")
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <p className="text-muted-foreground">กำลังโหลด...</p>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-muted/30">
            {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed top-20 bottom-0 left-0 z-40 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex h-full flex-col">
                    <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
                        <Link href="/admin" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <span className="text-sm font-bold text-primary-foreground">L</span>
                            </div>
                            <div>
                                <span className="font-semibold">{adminUser?.username || "Admin"}</span>
                                <p className="text-xs text-white/60">Admin Panel</p>
                            </div>
                        </Link>
                        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X className="h-5 w-5" /></Button>
                    </div>
                    <nav className="flex-1 space-y-1 p-4">
                        {navItems.map((item) => (
                            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${item.href === "/admin/discounts" ? "bg-[#8b5e3c] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                                <item.icon className="h-5 w-5" />{item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="border-t border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="border-t border-white/10 p-4">
                                <Button
                                    variant="ghost"
                                    className="w-full gap-2 text-white hover:bg-white/10"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4" />
                                    ออกจากระบบ
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}><Menu /></Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold">โค้ดส่วนลด</h1>
                        <p className="text-xs text-muted-foreground">สร้างและจัดการโปรโมชั่นสำหรับหน้าร้าน</p>
                    </div>
                    <Button onClick={() => { setShowForm(true); setFormError("") }} className="gap-2">
                        <Plus className="h-4 w-4" />เพิ่มโค้ด
                    </Button>
                </header>

                <main className="flex-1 space-y-6 p-4 lg:p-6">
                    {/* Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card><CardContent className="p-5">
                            <p className="text-sm text-muted-foreground">โค้ดทั้งหมด</p>
                            <p className="mt-1 text-2xl font-semibold">{discounts.length}</p>
                        </CardContent></Card>
                        <Card><CardContent className="p-5">
                            <p className="text-sm text-muted-foreground">กำลังใช้งาน</p>
                            <p className="mt-1 text-2xl font-semibold text-green-600">{discounts.filter((d) => d.is_active).length}</p>
                        </CardContent></Card>
                        <Card><CardContent className="p-5">
                            <p className="text-sm text-muted-foreground">ยอดการใช้โค้ด</p>
                            <p className="mt-1 text-2xl font-semibold">{discounts.reduce((sum, d) => sum + d.used_count, 0)}</p>
                        </CardContent></Card>
                    </div>

                    {/* Add form */}
                    {showForm && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>เพิ่มโค้ดส่วนลดใหม่</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setFormError("") }}><X /></Button>
                            </CardHeader>
                            <CardContent className="grid gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium">ชื่อโค้ด *</label>
                                    <Input
                                        placeholder="เช่น SUMMER20"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">ประเภทส่วนลด *</label>
                                    <select
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                        value={form.discount_type}
                                        onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })}
                                    >
                                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                                        <option value="fixed">จำนวนเงิน (฿)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        มูลค่าส่วนลด * {form.discount_type === "percent" ? "(%)" : "(฿)"}
                                    </label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={form.discount_type === "percent" ? "100" : undefined}
                                        placeholder={form.discount_type === "percent" ? "10" : "150"}
                                        value={form.discount_value}
                                        onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">ยอดสั่งซื้อขั้นต่ำ (฿)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0 = ไม่มีขั้นต่ำ"
                                        value={form.min_order}
                                        onChange={(e) => setForm({ ...form, min_order: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">จำกัดจำนวนการใช้</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="ว่าง = ไม่จำกัด"
                                        value={form.max_uses}
                                        onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium">วันหมดอายุ</label>
                                    <Input
                                        type="datetime-local"
                                        value={form.expires_at}
                                        onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                                    />
                                </div>
                                {formError && (
                                    <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 text-sm text-destructive">
                                        <AlertCircle className="h-4 w-4" />{formError}
                                    </div>
                                )}
                                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting ? "กำลังบันทึก..." : "บันทึกโค้ด"}
                                    </Button>
                                    <Button variant="outline" onClick={() => { setShowForm(false); setFormError(""); setForm(emptyForm) }}>ยกเลิก</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Discount list */}
                    <Card>
                        <CardHeader><CardTitle>รายการโค้ดส่วนลด</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {discounts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Gift className="h-10 w-10 text-muted-foreground" />
                                    <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีโค้ดส่วนลด</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {discounts.map((discount) => (
                                        <div key={discount.code_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <Gift className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-semibold tracking-wide">{discount.code}</span>
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${discount.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                                                            {discount.is_active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        ลด {discount.discount_type === "percent" ? `${discount.discount_value}%` : `฿${Number(discount.discount_value).toLocaleString()}`}
                                                        {" · "}ขั้นต่ำ ฿{Number(discount.min_order).toLocaleString()}
                                                        {" · "}ใช้แล้ว {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ""}
                                                        {discount.expires_at &&
                                                            ` · หมดอายุ ${new Date(discount.expires_at).toLocaleString("th-TH", {
                                                                timeZone: "Asia/Bangkok",
                                                                dateStyle: "short",
                                                                timeStyle: "short",
                                                            })}`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => copyCode(discount.code)}>
                                                    {copied === discount.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                    {copied === discount.code ? "คัดลอกแล้ว" : "คัดลอก"}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleToggle(discount)}>
                                                    {discount.is_active ? "ปิดใช้" : "เปิดใช้"}
                                                </Button>
                                                {discount.used_count === 0 && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(discount.code_id)} aria-label={`ลบ ${discount.code}`}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    )
}
