"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchQueue,
  claimChat,
  fetchAdminSession,
  sendAdminMessage,
  closeChat,
  type QueueResult,
  type QueueRow,
  type LiveChatMessage,
} from "@/lib/liveChat"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/chat", label: "แชทลูกค้า", icon: MessageSquare },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

function timeAgo(iso: string | null, nowMs: number): string {
  if (!iso || !nowMs) return "-"
  const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs} วิ`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} นาที`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชม.`
  return `${Math.floor(hrs / 24)} วัน`
}

const STALE_CUSTOMER_MS = 2 * 60 * 1000

export default function AdminChatPage() {
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [queue, setQueue] = useState<QueueResult | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [queueLoading, setQueueLoading] = useState(true)

  const [selected, setSelected] = useState<QueueRow | null>(null)
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [sessionStatus, setSessionStatus] = useState<string>("")
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [composer, setComposer] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const afterIdRef = useRef(0)
  const selectedCidRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // ── auth guard ──
  useEffect(() => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")
    if (!token || !user) {
      router.push("/login")
      return
    }
    let parsed: { role?: string } = {}
    try {
      parsed = JSON.parse(user)
    } catch {
      router.push("/login")
      return
    }
    if (parsed.role !== "admin" && parsed.role !== "staff") {
      router.push("/login")
      return
    }
    setIsAdmin(true)
    setIsStaff(parsed.role === "staff")
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const loadQueue = useCallback(async () => {
    try {
      const q = await fetchQueue()
      setQueue(q)
      setQueueError(null)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "โหลดคิวไม่สำเร็จ")
    } finally {
      setQueueLoading(false)
    }
  }, [])

  const loadSession = useCallback(async (cid: string, afterId: number) => {
    try {
      const res = await fetchAdminSession(cid, afterId)
      setSessionStatus(res.session.status)
      // Return the SAME reference when nothing relevant changed, so the
      // open-conversation effect (which keys on `selected`) doesn't churn.
      setSelected((prev) => {
        if (!prev || prev.conversation_id !== cid) return prev
        if (
          prev.status === res.session.status &&
          prev.assigned_admin_id === res.session.assigned_admin_id &&
          prev.assigned_admin_name === res.session.assigned_admin_name &&
          prev.last_customer_seen_at === res.session.last_customer_seen_at
        ) {
          return prev
        }
        return { ...prev, ...res.session }
      })
      if (res.messages.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.message_id))
          const merged = [...prev, ...res.messages.filter((m) => !seen.has(m.message_id))]
          const maxId = merged.reduce((mx, m) => Math.max(mx, m.message_id), afterIdRef.current)
          afterIdRef.current = maxId
          return merged
        })
      }
      setSessionError(null)
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : "โหลดบทสนทนาไม่สำเร็จ")
    }
  }, [])

  // ── queue polling (5s) ──
  useEffect(() => {
    if (!isAdmin) return
    void loadQueue()
    const iv = setInterval(() => void loadQueue(), 5000)
    return () => clearInterval(iv)
  }, [isAdmin, loadQueue])

  // ── open-conversation polling (3s) ──
  // Keyed on the conversation id (a primitive), NOT the `selected` object —
  // loadSession replaces `selected` on most polls and an object dep would loop.
  const selectedCid = selected?.conversation_id ?? null
  useEffect(() => {
    if (!isAdmin || !selectedCid) return
    const cid = selectedCid
    selectedCidRef.current = cid
    void loadSession(cid, afterIdRef.current)
    const iv = setInterval(() => {
      if (selectedCidRef.current === cid) void loadSession(cid, afterIdRef.current)
    }, 3000)
    return () => clearInterval(iv)
  }, [isAdmin, selectedCid, loadSession])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function openConversation(row: QueueRow) {
    afterIdRef.current = 0
    setMessages([])
    setSessionStatus(row.status)
    setSessionError(null)
    setActionError(null)
    setComposer("")
    setSelected(row)
  }

  async function handleClaimAndOpen(row: QueueRow) {
    setBusy(true)
    setActionError(null)
    try {
      await claimChat(row.conversation_id)
      openConversation({ ...row, status: "live", is_mine: true })
      void loadQueue()
    } catch (e) {
      const code = (e as { code?: string }).code
      setActionError(
        code === "already_claimed"
          ? "บทสนทนานี้ถูกแอดมินท่านอื่นรับไปแล้ว"
          : e instanceof Error
            ? e.message
            : "รับสายไม่สำเร็จ",
      )
      void loadQueue()
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    const text = composer.trim()
    if (!text || !selected || busy) return
    setBusy(true)
    setActionError(null)
    setComposer("")
    try {
      await sendAdminMessage(selected.conversation_id, text)
      await loadSession(selected.conversation_id, afterIdRef.current)
    } catch (e) {
      const code = (e as { code?: string }).code
      setActionError(
        code === "not_your_live_chat"
          ? "บทสนทนานี้ไม่ได้อยู่ในสถานะที่ตอบได้ (อาจถูกปิดหรือรับโดยคนอื่น)"
          : e instanceof Error
            ? e.message
            : "ส่งข้อความไม่สำเร็จ",
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleClose() {
    if (!selected || busy) return
    if (!window.confirm("ปิดการสนทนานี้? บอทจะกลับมาดูแลลูกค้าต่อ")) return
    setBusy(true)
    setActionError(null)
    try {
      await closeChat(selected.conversation_id)
      setSelected(null)
      selectedCidRef.current = null
      void loadQueue()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "ปิดการสนทนาไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  const visibleNav = isStaff
    ? navItems.filter((i) => i.href !== "/admin/users" && i.href !== "/admin/settings")
    : navItems

  const waiting = queue?.waiting ?? []
  const live = queue?.live ?? []
  const nowMs = queue?.now ? new Date(queue.now).getTime() : 0

  return (
    <div className="flex min-h-screen bg-muted/30">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
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
                <p className="text-xs text-white/60">{isStaff ? "Staff Panel" : "Admin Panel"}</p>
              </div>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  item.href === "/admin/chat"
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
                <span className="text-sm font-medium text-primary">{isStaff ? "S" : "A"}</span>
              </div>
              <div className="flex-1">
                <span className="font-semibold">BosButter</span>
                <p className="text-xs text-white/60">{isStaff ? "Staff Panel" : "Admin Panel"}</p>
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
            <h1 className="text-lg font-semibold text-foreground">แชทลูกค้า</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadQueue()}>
            <RefreshCw className="mr-1 h-4 w-4" /> รีเฟรช
          </Button>
        </header>

        <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[320px_1fr] lg:p-6">
          {/* ── queue pane ── */}
          <div className="flex flex-col gap-4">
            {queueError && (
              <Card>
                <CardContent className="p-4 text-sm text-destructive">{queueError}</CardContent>
              </Card>
            )}

            <QueueSection
              title={`รอดำเนินการ (${waiting.length})`}
              rows={waiting}
              emptyText={queueLoading ? "กำลังโหลด…" : "ไม่มีลูกค้ารอในคิว"}
              selectedCid={selected?.conversation_id ?? null}
              onPick={handleClaimAndOpen}
              busy={busy}
              nowMs={nowMs}
            />
            <QueueSection
              title={`กำลังสนทนา (${live.length})`}
              rows={live}
              emptyText="ยังไม่มีบทสนทนาที่รับอยู่"
              selectedCid={selected?.conversation_id ?? null}
              onPick={(row) => openConversation(row)}
              busy={busy}
              nowMs={nowMs}
            />
          </div>

          {/* ── conversation pane ── */}
          <Card className="flex min-h-[60vh] flex-col">
            {!selected ? (
              <CardContent className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                เลือกบทสนทนาจากคิวด้านซ้าย
              </CardContent>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div>
                    <div className="font-semibold text-foreground">
                      {selected.guest_label}{" "}
                      <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {selected.customer_lang}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sessionStatus === "live"
                        ? `กำลังสนทนา — รับโดย ${selected.assigned_admin_name ?? "คุณ"}`
                        : sessionStatus === "closed"
                          ? "ปิดแล้ว"
                          : "รอรับสาย"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={busy || sessionStatus === "closed"}
                  >
                    ปิดการสนทนา
                  </Button>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((m) => {
                    if (m.sender_type === "system") {
                      return (
                        <div key={m.message_id} className="text-center text-xs text-muted-foreground">
                          {m.body}
                        </div>
                      )
                    }
                    const mine = m.sender_type === "admin"
                    return (
                      <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "bg-[#3E6E8E] text-white"
                              : m.sender_type === "bot"
                                ? "bg-muted text-foreground"
                                : "bg-[#f4ece2] text-foreground"
                          }`}
                        >
                          {m.sender_type === "bot" && (
                            <div className="mb-0.5 text-[10px] font-semibold opacity-60">บอท</div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        </div>
                      </div>
                    )
                  })}
                  {sessionError && <div className="text-center text-xs text-destructive">{sessionError}</div>}
                </div>

                <div className="border-t border-border p-3">
                  {actionError && <div className="mb-2 text-xs text-destructive">{actionError}</div>}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                      placeholder={
                        sessionStatus === "live" && selected.is_mine
                          ? "พิมพ์ข้อความ… (Enter เพื่อส่ง)"
                          : "รับสายก่อนจึงจะตอบได้"
                      }
                      disabled={busy || sessionStatus !== "live" || !selected.is_mine}
                      className="min-h-[44px] flex-1 resize-none"
                    />
                    <Button
                      onClick={() => void handleSend()}
                      disabled={busy || !composer.trim() || sessionStatus !== "live" || !selected.is_mine}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </main>
      </div>
    </div>
  )
}

function QueueSection({
  title,
  rows,
  emptyText,
  selectedCid,
  onPick,
  busy,
  nowMs,
}: {
  title: string
  rows: QueueRow[]
  emptyText: string
  selectedCid: string | null
  onPick: (row: QueueRow) => void
  busy: boolean
  nowMs: number
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {rows.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => {
              const stale =
                !!row.last_customer_seen_at &&
                nowMs > 0 &&
                nowMs - new Date(row.last_customer_seen_at).getTime() > STALE_CUSTOMER_MS
              const active = row.conversation_id === selectedCid
              return (
                <li key={row.session_id}>
                  <button
                    disabled={busy}
                    onClick={() => onPick(row)}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${
                      active
                        ? "border-[#8b5e3c] bg-[#8b5e3c]/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{row.guest_label}</span>
                      <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                        {row.customer_lang}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {row.last_message ?? "—"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>รอมา {timeAgo(row.escalated_at, nowMs)}</span>
                      {row.assigned_admin_name && <span>· {row.assigned_admin_name}</span>}
                      {stale && <span className="text-amber-600">· ลูกค้าอาจออกไปแล้ว</span>}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
