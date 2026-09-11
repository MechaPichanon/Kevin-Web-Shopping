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
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { fetchPolicies, updatePolicyApi, type Policy } from "@/lib/policies"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/chat", label: "แชทลูกค้า", icon: MessageSquare },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const POLICY_TYPES = ["SHIPPING", "RETURN", "PAYMENT"]

const POLICY_LABELS: Record<string, { th: string; en: string }> = {
  SHIPPING: { th: "การจัดส่ง", en: "Shipping" },
  RETURN: { th: "การคืนสินค้า", en: "Returns & Exchanges" },
  PAYMENT: { th: "การชำระเงิน", en: "Payment" },
}

type Draft = { content_en: string; content_th: string }

export default function AdminSettingsPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [accountName, setAccountName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingType, setSavingType] = useState<string | null>(null)
  const [savedType, setSavedType] = useState<string | null>(null)
  const [saveErrorByType, setSaveErrorByType] = useState<Record<string, string>>({})

  const loadPolicies = () => {
    setIsLoading(true)
    setLoadError(null)
    fetchPolicies()
      .then((data: Policy[]) => {
        setDrafts(
          Object.fromEntries(
            data.map((p) => [p.policy_type, { content_en: p.content_en, content_th: p.content_th }])
          )
        )
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false))
  }

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
    setAccountName(parsed.username || parsed.email || "")
    loadPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const handleDraftChange = (type: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }))
  }

  const handleSave = async (type: string) => {
    setSavingType(type)
    setSavedType(null)
    setSaveErrorByType((prev) => ({ ...prev, [type]: "" }))
    try {
      await updatePolicyApi(type, drafts[type])
      setSavedType(type)
      setTimeout(() => setSavedType((current) => (current === type ? null : current)), 2000)
    } catch (err) {
      setSaveErrorByType((prev) => ({ ...prev, [type]: (err as Error).message }))
    } finally {
      setSavingType(null)
    }
  }

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
        className={`fixed top-20 bottom-0 left-0 z-40 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">L</span>
              </div>
              <div>
                <span className="font-semibold">{accountName || "Admin"}</span>
                <p className="text-xs text-white/60">{"Admin Panel"}</p>
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
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${item.href === "/admin/settings"
                  ? "bg-[#8b5e3c] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">ตั้งค่า</h1>
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
                <Button size="sm" variant="outline" onClick={loadPolicies}>
                  ลองใหม่
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">นโยบายร้าน</h2>
                <p className="mt-1 text-sm text-muted-foreground">Store Policies</p>
              </div>

              {POLICY_TYPES.map((type) => {
                const label = POLICY_LABELS[type]
                const draft = drafts[type] ?? { content_en: "", content_th: "" }
                return (
                  <Card key={type}>
                    <CardHeader>
                      <CardTitle className="font-serif text-lg">{label.th}</CardTitle>
                      <p className="text-sm text-muted-foreground">{label.en}</p>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-6">
                      <div className="space-y-1.5">
                        <Label htmlFor={`${type}-th`}>ภาษาไทย</Label>
                        <Textarea
                          id={`${type}-th`}
                          rows={6}
                          value={draft.content_th}
                          onChange={(e) => handleDraftChange(type, "content_th", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${type}-en`}>English</Label>
                        <Textarea
                          id={`${type}-en`}
                          rows={6}
                          value={draft.content_en}
                          onChange={(e) => handleDraftChange(type, "content_en", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={savingType === type}
                          onClick={() => handleSave(type)}
                        >
                          {savingType === type ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          บันทึก
                        </Button>
                        {savedType === type && (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> บันทึกแล้ว
                          </span>
                        )}
                        {saveErrorByType[type] && (
                          <span className="flex items-center gap-1 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" /> {saveErrorByType[type]}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
