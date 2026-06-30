"use client"

import { useEffect, useRef, useState } from "react"
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
  Plus,
  Search,
  Edit,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// ─── constants ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const CATEGORIES = [
  { value: "shirt", label: "Shirt" },
  { value: "polo", label: "Polo" },
  { value: "pant", label: "Pant" },
]

const SUBCATS: Record<string, { value: string; label: string }[]> = {
  shirt: [
    { value: "cotton-shirt", label: "Cotton Shirt" },
    { value: "oxford", label: "Oxford" },
    { value: "casual-shirt", label: "Casual Shirt" },
    { value: "linen-shirt", label: "Linen Shirt" },
  ],
  polo: [
    { value: "classic-polo", label: "Classic Polo" },
    { value: "pique-polo", label: "Piqué Polo" },
    { value: "zip-polo", label: "Zip Polo" },
  ],
  pant: [
    { value: "slim-pant", label: "Slim Pant" },
    { value: "straight-pant", label: "Straight Pant" },
    { value: "chino", label: "Chino" },
    { value: "shorts", label: "Shorts" },
  ],
}

const PATTERNS = [
  { value: "solid", label: "Solid" },
  { value: "striped", label: "Striped" },
  { value: "checked", label: "Checked" },
  { value: "printed", label: "Printed" },
  { value: "herringbone", label: "Herringbone" },
]

const UPPER_SIZES = ["M", "L", "XL", "XXL"]
const PANT_SIZES = ["30", "32", "34", "36", "38"]

const PRESET_COLORS = [
  { hex: "#ffffff", name: "White", nameTh: "ขาว" },
  { hex: "#15171c", name: "Black", nameTh: "ดำ" },
  { hex: "#1f2a44", name: "Navy", nameTh: "กรมท่า" },
  { hex: "#8a909c", name: "Grey", nameTh: "เทา" },
  { hex: "#d9c7a3", name: "Beige", nameTh: "เบจ" },
  { hex: "#5a6b3b", name: "Olive", nameTh: "เขียวมะกอก" },
  { hex: "#6e2733", name: "Maroon", nameTh: "แดงเลือดหมู" },
  { hex: "#7fb3d5", name: "Sky Blue", nameTh: "ฟ้า" },
]

// ─── types ───────────────────────────────────────────────────────────────────

type ProductRow = {
  product_id: string
  product_name: string
  category: string
  sub_category?: string
  description?: string
  variant_id: string
  size: string
  color: string
  pattern?: string
  price: string | number
  stock: string | number
  image_url?: string
}

type ViewMode = "list" | "form"

type FormState = {
  name: string
  nameTh: string
  desc: string
  descTh: string
  category: string
  subcategory: string
  pattern: string
  size: string
  colorHex: string
  colorName: string
  colorNameTh: string
  chestMin: string
  chestMax: string
  sleeve: string
  collar: string
  waistMin: string
  waistMax: string
  price: string
  costPrice: string
  stock: string
  status: "active" | "draft"
  imageFile: File | null
  imagePreview: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isUpperCat(cat: string) {
  return cat === "shirt" || cat === "polo"
}

function normCategory(raw: string): string {
  const l = (raw || "").toLowerCase()
  if (l.startsWith("shirt")) return "shirt"
  if (l.startsWith("polo")) return "polo"
  if (l.startsWith("pant") || l.startsWith("trouser") || l.startsWith("short")) return "pant"
  return "shirt"
}

function makeSku(category: string, size: string, colorName: string) {
  return `TS-${category.slice(0, 2)}-${size}-${colorName.slice(0, 3)}`
    .toUpperCase()
    .replace(/\s/g, "")
}

function luminance(hex: string): number {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const BLANK_FORM: FormState = {
  name: "",
  nameTh: "",
  desc: "",
  descTh: "",
  category: "shirt",
  subcategory: "oxford",
  pattern: "solid",
  size: "M",
  colorHex: "#1f2a44",
  colorName: "Navy",
  colorNameTh: "กรมท่า",
  chestMin: "",
  chestMax: "",
  sleeve: "",
  collar: "",
  waistMin: "",
  waistMax: "",
  price: "",
  costPrice: "",
  stock: "",
  status: "active",
  imageFile: null,
  imagePreview: "",
}

// ─── component ───────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") return false
    const user = localStorage.getItem("user")
    if (!user) return false
    try {
      const r = JSON.parse(user).role
      return r === "admin" || r === "staff"
    } catch {
      return false
    }
  })

  const [products, setProducts] = useState<ProductRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [view, setView] = useState<ViewMode>("list")
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)

  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!isAdmin) router.push("/login")
  }, [isAdmin, router])

  useEffect(() => {
    let ignore = false
    fetch("http://localhost:5000/products")
      .then((r) => r.json())
      .then((data: ProductRow[]) => { if (!ignore) setProducts(data) })
      .catch(console.error)
    return () => { ignore = true }
  }, [])

  const fetchProducts = () => {
    fetch("http://localhost:5000/products")
      .then((r) => r.json())
      .then((data: ProductRow[]) => setProducts(data))
      .catch(console.error)
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/login")
  }

  // ── view transitions ──────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(BLANK_FORM)
    setEditingProduct(null)
    setDeleteTarget(null)
    setView("form")
  }

  const openEdit = (p: ProductRow) => {
    const cat = normCategory(p.category)
    const isUpper = isUpperCat(cat)
    const sizes = isUpper ? UPPER_SIZES : PANT_SIZES
    const matched = PRESET_COLORS.find(
      (c) => c.name.toLowerCase() === (p.color || "").toLowerCase()
    )
    setForm({
      name: p.product_name || "",
      nameTh: "",
      desc: p.description || "",
      descTh: "",
      category: cat,
      subcategory: p.sub_category || (SUBCATS[cat]?.[0]?.value ?? ""),
      pattern: p.pattern || "solid",
      size: sizes.includes(p.size) ? p.size : sizes[0],
      colorHex: matched?.hex ?? "#1f2a44",
      colorName: matched?.name ?? p.color ?? "",
      colorNameTh: matched?.nameTh ?? "",
      chestMin: "",
      chestMax: "",
      sleeve: "",
      collar: "",
      waistMin: "",
      waistMax: "",
      price: String(p.price ?? ""),
      costPrice: "",
      stock: String(p.stock ?? ""),
      status: "active",
      imageFile: null,
      imagePreview: p.image_url ?? "",
    })
    setEditingProduct(p)
    setDeleteTarget(null)
    setView("form")
  }

  const cancelForm = () => {
    setView("list")
    setEditingProduct(null)
    setDeleteTarget(null)
  }

  // ── form helpers ──────────────────────────────────────────────────────────

  const upd =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
    }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value
    const isUpper = isUpperCat(cat)
    setForm((f) => ({
      ...f,
      category: cat,
      subcategory: SUBCATS[cat]?.[0]?.value ?? "",
      size: (isUpper ? UPPER_SIZES : PANT_SIZES)[0],
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) =>
      setForm((f) => ({
        ...f,
        imageFile: file,
        imagePreview: (ev.target?.result as string) ?? "",
      }))
    reader.readAsDataURL(file)
  }

  const selectColor = (c: { hex: string; name: string; nameTh: string }) => {
    setForm((f) => ({ ...f, colorHex: c.hex, colorName: c.name, colorNameTh: c.nameTh }))
  }

  // ── save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (isSubmitting) return
    const fd = new FormData()
    fd.append("product_name", form.name)
    fd.append("category", form.category)
    fd.append("sub_category", form.subcategory)
    fd.append("description", form.desc)
    fd.append("size", form.size)
    fd.append("color", form.colorName)
    fd.append("pattern", form.pattern)
    fd.append("price", form.price)
    fd.append("stock", form.stock)
    if (form.imageFile) fd.append("image", form.imageFile)

    try {
      setIsSubmitting(true)
      let res: Response
      if (editingProduct) {
        res = await fetch(
          `http://localhost:5000/products/${encodeURIComponent(editingProduct.product_id)}/${encodeURIComponent(editingProduct.variant_id)}`,
          { method: "PUT", body: fd }
        )
      } else {
        res = await fetch("http://localhost:5000/products", {
          method: "POST",
          body: fd,
        })
      }
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Error saving product")
        return
      }
      setToast(true)
      setTimeout(() => {
        setToast(false)
        cancelForm()
        fetchProducts()
      }, 1500)
    } catch {
      alert("Unable to save product")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    try {
      setIsDeleting(true)
      const res = await fetch(
        `http://localhost:5000/products/${encodeURIComponent(deleteTarget.product_id)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Unable to delete product")
        return
      }
      setProducts((ps) =>
        ps.filter((p) => p.product_id !== deleteTarget.product_id)
      )
      setDeleteTarget(null)
      cancelForm()
    } catch {
      alert("Unable to delete product")
    } finally {
      setIsDeleting(false)
    }
  }

  // ── computed ──────────────────────────────────────────────────────────────

  const filteredProducts = products.filter((p) =>
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const isUpper = isUpperCat(form.category)
  const sku = makeSku(form.category, form.size, form.colorName)
  const priceN = parseFloat(form.price) || 0
  const costN = parseFloat(form.costPrice) || 0
  const margin = priceN - costN
  const marginPct = priceN > 0 ? `${Math.round((margin / priceN) * 100)}%` : "—"
  const stockN = parseInt(form.stock) || 0
  const stockLabel =
    stockN === 0 ? "Out of stock" : stockN <= 10 ? "Low stock" : "In stock"
  const stockColor =
    stockN === 0 ? "#dc2626" : stockN <= 10 ? "#d97706" : "#16a34a"

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 13px",
    border: "1px solid #dfe3ea",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a1d23",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
  }
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238a909c' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 13px center",
    appearance: "none",
  }
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#525a68",
    marginBottom: 7,
  }
  const sectionStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #eceef2",
    borderRadius: 16,
    padding: 26,
    boxShadow: "0 1px 2px rgba(16,24,40,.04)",
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "#f5f1ed" }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
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
                <span className="font-semibold">BosButter</span>
                <p className="text-xs text-white/60">Admin Panel</p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  item.href === "/admin/products"
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
              className="w-full gap-2 text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Top bar — only shown in list view */}
        {view === "list" && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">
                จัดการสินค้า
              </h1>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มสินค้า
            </Button>
          </header>
        )}

        {/* Mobile menu trigger for form view */}
        {view === "form" && (
          <div className="flex h-12 items-center border-b border-[#eceef2] bg-white px-4 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* ── LIST VIEW ─────────────────────────────────────────────────── */}
        {view === "list" && (
          <main className="flex-1 p-4 lg:p-6">
            {/* Delete confirmation banner */}
            {deleteTarget && (
              <div
                style={{
                  background: "#fff5f5",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#991b1b", fontSize: 14 }}>
                    ลบสินค้า &ldquo;{deleteTarget.product_name}&rdquo;?
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#b91c1c" }}>
                    การลบจะลบทุก variant ของสินค้านี้และไม่สามารถกู้คืนได้
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setDeleteTarget(null)}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 8,
                      border: "1px solid #fca5a5",
                      background: "#fff",
                      color: "#374151",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isDeleting ? "default" : "pointer",
                      opacity: isDeleting ? 0.7 : 1,
                    }}
                  >
                    {isDeleting ? "กำลังลบ…" : "ยืนยันลบ"}
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาสินค้า..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Product table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-semibold">รูป</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">ชื่อสินค้า</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">หมวดหมู่</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">ไซส์</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">สี</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">ราคา</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Stock</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.variant_id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.product_name}
                                className="h-16 w-16 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                                ไม่มีรูป
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {product.product_name}
                          </td>
                          <td className="px-4 py-3 text-sm capitalize">
                            {product.category}
                          </td>
                          <td className="px-4 py-3 text-sm">{product.size}</td>
                          <td className="px-4 py-3 text-sm">{product.color}</td>
                          <td className="px-4 py-3 text-sm">
                            ฿{Number(product.price).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              style={{
                                fontWeight: 600,
                                color:
                                  Number(product.stock) === 0
                                    ? "#dc2626"
                                    : Number(product.stock) <= 10
                                    ? "#d97706"
                                    : "#16a34a",
                              }}
                            >
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(product)}
                                title="แก้ไข"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(product)}
                                title="ลบ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-12 text-center text-sm text-muted-foreground"
                          >
                            ไม่พบสินค้า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </main>
        )}

        {/* ── FORM VIEW ─────────────────────────────────────────────────── */}
        {view === "form" && (
          <main
            style={{
              flex: 1,
              padding: "28px 24px 80px",
              color: "#1a1d23",
              fontFamily:
                '"Plus Jakarta Sans", "Noto Sans Thai", system-ui, sans-serif',
            }}
          >
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>

              {/* Breadcrumb */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "#9aa0ac",
                  marginBottom: 14,
                }}
              >
                <button
                  onClick={cancelForm}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#9aa0ac",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                >
                  Products
                </button>
                <span style={{ color: "#c8cdd6" }}>/</span>
                <span>{form.name || "สินค้าใหม่"}</span>
                <span style={{ color: "#c8cdd6" }}>/</span>
                <span style={{ color: "#525a68", fontWeight: 500 }}>
                  {editingProduct ? "Edit variant" : "Add product"}
                </span>
              </div>

              {/* Page header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 24,
                  marginBottom: 24,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: 24,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {form.name || "สินค้าใหม่"}
                    </h1>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "#f5ece3",
                        color: "#8b5e3c",
                      }}
                    >
                      {sku}
                    </span>
                  </div>
                  {(form.nameTh || form.category || form.size || form.colorName) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 8,
                        fontSize: 13,
                        color: "#707683",
                        flexWrap: "wrap",
                      }}
                    >
                      {form.nameTh && (
                        <>
                          <span style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                            {form.nameTh}
                          </span>
                          <span
                            style={{
                              width: 3,
                              height: 3,
                              borderRadius: "50%",
                              background: "#c8cdd6",
                              display: "inline-block",
                            }}
                          />
                        </>
                      )}
                      <span style={{ textTransform: "capitalize" }}>
                        {CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category}
                      </span>
                      <span
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          background: "#c8cdd6",
                          display: "inline-block",
                        }}
                      />
                      <span>Size {form.size}</span>
                      <span
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          background: "#c8cdd6",
                          display: "inline-block",
                        }}
                      />
                      <span>{form.colorName}</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(editingProduct)}
                      style={{
                        height: 40,
                        padding: "0 16px",
                        borderRadius: 10,
                        border: "1px solid #f1d0d0",
                        background: "#fff",
                        color: "#c0392b",
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelForm}
                    style={{
                      height: 40,
                      padding: "0 16px",
                      borderRadius: 10,
                      border: "1px solid #dfe3ea",
                      background: "#fff",
                      color: "#374151",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitting}
                    style={{
                      height: 40,
                      padding: "0 20px",
                      borderRadius: 10,
                      border: "none",
                      background: isSubmitting ? "#a07050" : "#8b5e3c",
                      color: "#fff",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: isSubmitting ? "default" : "pointer",
                      boxShadow: "0 1px 2px rgba(139,94,60,.25)",
                    }}
                  >
                    {isSubmitting ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>

              {/* Delete confirmation banner (inside form view) */}
              {deleteTarget && (
                <div
                  style={{
                    background: "#fff5f5",
                    border: "1px solid #fecaca",
                    borderRadius: 12,
                    padding: "16px 20px",
                    marginBottom: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: "#991b1b", fontSize: 14 }}>
                      ลบสินค้า &ldquo;{deleteTarget.product_name}&rdquo;?
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#b91c1c" }}>
                      การลบจะลบทุก variant และไม่สามารถกู้คืนได้
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setDeleteTarget(null)}
                      style={{
                        height: 36,
                        padding: "0 14px",
                        borderRadius: 8,
                        border: "1px solid #fca5a5",
                        background: "#fff",
                        color: "#374151",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={isDeleting}
                      style={{
                        height: 36,
                        padding: "0 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#dc2626",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isDeleting ? "default" : "pointer",
                        opacity: isDeleting ? 0.7 : 1,
                      }}
                    >
                      {isDeleting ? "กำลังลบ…" : "ยืนยันลบ"}
                    </button>
                  </div>
                </div>
              )}

              {/* Two-column layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 322px",
                  gap: 22,
                  alignItems: "start",
                }}
                className="form-grid"
              >
                {/* ── LEFT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                  {/* Product details */}
                  <section style={sectionStyle}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>
                        Product details
                      </h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9aa0ac" }}>
                        Shared across every size and color of this product.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                        marginBottom: 18,
                      }}
                    >
                      <div>
                        <label style={labelStyle}>
                          Product name{" "}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#6b7280",
                              background: "#f0f1f4",
                              padding: "1px 6px",
                              borderRadius: 5,
                            }}
                          >
                            EN
                          </span>
                        </label>
                        <input
                          value={form.name}
                          onChange={upd("name")}
                          placeholder="Oxford Button-Down Shirt"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            ...labelStyle,
                            fontFamily: "'Noto Sans Thai', sans-serif",
                          }}
                        >
                          ชื่อสินค้า{" "}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#6b7280",
                              background: "#f0f1f4",
                              padding: "1px 6px",
                              borderRadius: 5,
                              fontFamily: "inherit",
                            }}
                          >
                            TH
                          </span>
                        </label>
                        <input
                          value={form.nameTh}
                          onChange={upd("nameTh")}
                          placeholder="เสื้อเชิ้ต"
                          style={{
                            ...inputStyle,
                            fontFamily: "'Noto Sans Thai', sans-serif",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 16,
                        marginBottom: 18,
                      }}
                    >
                      <div>
                        <label style={labelStyle}>Category</label>
                        <select
                          value={form.category}
                          onChange={handleCategoryChange}
                          style={selectStyle}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Sub-category</label>
                        <select
                          value={form.subcategory}
                          onChange={upd("subcategory")}
                          style={selectStyle}
                        >
                          {(SUBCATS[form.category] ?? []).map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Pattern</label>
                        <select
                          value={form.pattern}
                          onChange={upd("pattern")}
                          style={selectStyle}
                        >
                          {PATTERNS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div
                      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
                    >
                      <div>
                        <label style={labelStyle}>
                          Description{" "}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#6b7280",
                              background: "#f0f1f4",
                              padding: "1px 6px",
                              borderRadius: 5,
                            }}
                          >
                            EN
                          </span>
                        </label>
                        <textarea
                          value={form.desc}
                          onChange={upd("desc")}
                          rows={4}
                          placeholder="Describe the product…"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            border: "1px solid #dfe3ea",
                            borderRadius: 10,
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#1a1d23",
                            background: "#fff",
                            outline: "none",
                            fontFamily: "inherit",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            ...labelStyle,
                            fontFamily: "'Noto Sans Thai', sans-serif",
                          }}
                        >
                          รายละเอียด{" "}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#6b7280",
                              background: "#f0f1f4",
                              padding: "1px 6px",
                              borderRadius: 5,
                              fontFamily: "inherit",
                            }}
                          >
                            TH
                          </span>
                        </label>
                        <textarea
                          value={form.descTh}
                          onChange={upd("descTh")}
                          rows={4}
                          placeholder="อธิบายสินค้า…"
                          style={{
                            width: "100%",
                            padding: "11px 13px",
                            border: "1px solid #dfe3ea",
                            borderRadius: 10,
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#1a1d23",
                            background: "#fff",
                            outline: "none",
                            fontFamily: "'Noto Sans Thai', sans-serif",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Variant attributes */}
                  <section style={sectionStyle}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>
                        This variant
                      </h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9aa0ac" }}>
                        Size and color define this individual row. Each variant has its own stock.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "200px 1fr",
                        gap: 22,
                        alignItems: "start",
                      }}
                    >
                      {/* Size */}
                      <div>
                        <label style={labelStyle}>Size</label>
                        <select
                          value={form.size}
                          onChange={upd("size")}
                          style={selectStyle}
                        >
                          {(isUpper ? UPPER_SIZES : PANT_SIZES).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#9aa0ac" }}>
                          {isUpper ? "Letter sizing (XS–XXL)." : "Waist sizing in inches."}
                        </p>
                      </div>

                      {/* Color */}
                      <div>
                        <label style={labelStyle}>Color</label>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            flexWrap: "wrap",
                            marginBottom: 14,
                          }}
                        >
                          {PRESET_COLORS.map((c) => {
                            const isSel =
                              c.hex.toLowerCase() === form.colorHex.toLowerCase()
                            const light = luminance(c.hex) > 0.6
                            return (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => selectColor(c)}
                                title={c.name}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 9,
                                  border: "none",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: c.hex,
                                  boxShadow: isSel
                                    ? "0 0 0 2px #fff, 0 0 0 4px #8b5e3c"
                                    : light
                                    ? "inset 0 0 0 1px #e2e5ea"
                                    : "inset 0 0 0 1px rgba(0,0,0,.06)",
                                }}
                              >
                                {isSel && (
                                  <span
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      color: light ? "#16181d" : "#ffffff",
                                    }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                fontSize: 11.5,
                                color: "#8a909c",
                                marginBottom: 6,
                              }}
                            >
                              Color name{" "}
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  color: "#6b7280",
                                  background: "#f0f1f4",
                                  padding: "1px 5px",
                                  borderRadius: 5,
                                }}
                              >
                                EN
                              </span>
                            </label>
                            <input
                              value={form.colorName}
                              onChange={upd("colorName")}
                              placeholder="Navy"
                              style={{ ...inputStyle, height: 40, padding: "0 12px" }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                fontSize: 11.5,
                                color: "#8a909c",
                                marginBottom: 6,
                                fontFamily: "'Noto Sans Thai', sans-serif",
                              }}
                            >
                              สีสินค้า{" "}
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  color: "#6b7280",
                                  background: "#f0f1f4",
                                  padding: "1px 5px",
                                  borderRadius: 5,
                                  fontFamily: "inherit",
                                }}
                              >
                                TH
                              </span>
                            </label>
                            <input
                              value={form.colorNameTh}
                              onChange={upd("colorNameTh")}
                              placeholder="กรมท่า"
                              style={{
                                ...inputStyle,
                                height: 40,
                                padding: "0 12px",
                                fontFamily: "'Noto Sans Thai', sans-serif",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Measurements */}
                  <section style={sectionStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 20,
                      }}
                    >
                      <div>
                        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>
                          Measurements
                        </h2>
                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9aa0ac" }}>
                          {isUpper
                            ? "Upper-body garment — chest, sleeve and collar."
                            : "Lower-body garment — waist range."}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 11px",
                          borderRadius: 999,
                          background: "#f4f5f7",
                          color: "#707683",
                        }}
                      >
                        {isUpper ? "Upper body" : "Lower body"}
                      </span>
                    </div>

                    {isUpper ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.4fr 1fr 1fr",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label style={labelStyle}>
                            Chest{" "}
                            <span style={{ color: "#9aa0ac", fontWeight: 500 }}>
                              (inch)
                            </span>
                          </label>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 9 }}
                          >
                            <input
                              type="number"
                              value={form.chestMin}
                              onChange={upd("chestMin")}
                              placeholder="Min"
                              style={inputStyle}
                            />
                            <span style={{ color: "#c8cdd6", fontWeight: 600 }}>–</span>
                            <input
                              type="number"
                              value={form.chestMax}
                              onChange={upd("chestMax")}
                              placeholder="Max"
                              style={inputStyle}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>
                            Sleeve{" "}
                            <span style={{ color: "#9aa0ac", fontWeight: 500 }}>
                              (inch)
                            </span>
                          </label>
                          <input
                            type="number"
                            value={form.sleeve}
                            onChange={upd("sleeve")}
                            placeholder="24"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>
                            Collar{" "}
                            <span style={{ color: "#9aa0ac", fontWeight: 500 }}>
                              (inch)
                            </span>
                          </label>
                          <input
                            type="number"
                            value={form.collar}
                            onChange={upd("collar")}
                            placeholder="15.5"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label style={labelStyle}>
                            Waist{" "}
                            <span style={{ color: "#9aa0ac", fontWeight: 500 }}>
                              (inch)
                            </span>
                          </label>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 9 }}
                          >
                            <input
                              type="number"
                              value={form.waistMin}
                              onChange={upd("waistMin")}
                              placeholder="Min"
                              style={inputStyle}
                            />
                            <span style={{ color: "#c8cdd6", fontWeight: 600 }}>–</span>
                            <input
                              type="number"
                              value={form.waistMax}
                              onChange={upd("waistMax")}
                              placeholder="Max"
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Pricing & inventory */}
                  <section style={sectionStyle}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>
                        Pricing &amp; inventory
                      </h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9aa0ac" }}>
                        Tracked per variant. Prices in Thai Baht.
                      </p>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <label style={labelStyle}>Selling price</label>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "#9aa0ac",
                              fontSize: 14,
                            }}
                          >
                            ฿
                          </span>
                          <input
                            type="number"
                            value={form.price}
                            onChange={upd("price")}
                            placeholder="1290"
                            style={{ ...inputStyle, paddingLeft: 26 }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Cost price</label>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "#9aa0ac",
                              fontSize: 14,
                            }}
                          >
                            ฿
                          </span>
                          <input
                            type="number"
                            value={form.costPrice}
                            onChange={upd("costPrice")}
                            placeholder="540"
                            style={{ ...inputStyle, paddingLeft: 26 }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Stock on hand</label>
                        <input
                          type="number"
                          value={form.stock}
                          onChange={upd("stock")}
                          placeholder="48"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 18,
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: "1px solid #f1f2f5",
                        fontSize: 12.5,
                        color: "#707683",
                      }}
                    >
                      <span>
                        Margin{" "}
                        <strong style={{ color: "#16a34a", fontWeight: 700 }}>
                          ฿{Math.max(0, margin).toLocaleString()}
                        </strong>{" "}
                        <span style={{ color: "#9aa0ac" }}>({marginPct})</span>
                      </span>
                      <span
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          background: "#c8cdd6",
                          display: "inline-block",
                        }}
                      />
                      <span>
                        Stock status{" "}
                        <strong style={{ color: stockColor, fontWeight: 700 }}>
                          {stockLabel}
                        </strong>
                      </span>
                    </div>
                  </section>
                </div>

                {/* ── RIGHT RAIL ── */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                    position: "sticky",
                    top: 28,
                  }}
                >
                  {/* Variant image */}
                  <section style={{ ...sectionStyle, padding: 22 }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>
                      Variant image
                    </h2>
                    {form.imagePreview ? (
                      <div
                        style={{
                          position: "relative",
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid #eceef2",
                        }}
                      >
                        <img
                          src={form.imagePreview}
                          alt="variant"
                          style={{ display: "block", width: "100%", height: "auto" }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              imageFile: null,
                              imagePreview: "",
                            }))
                          }
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            height: 30,
                            padding: "0 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "rgba(20,22,28,.75)",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          height: 190,
                          border: "1.5px dashed #d4d8e0",
                          borderRadius: 12,
                          cursor: "pointer",
                          background: "#fafbfc",
                          textAlign: "center",
                          padding: "0 18px",
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: "#f5ece3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#8b5e3c"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15l-5-5L5 21" />
                            <path d="M3 16V5a2 2 0 0 1 2-2h11" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="M19 3v6M22 6h-6" />
                          </svg>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          Upload image
                        </div>
                        <div style={{ fontSize: 11.5, color: "#9aa0ac" }}>
                          PNG or JPG, drag &amp; drop or click
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          style={{ display: "none" }}
                        />
                      </label>
                    )}
                  </section>

                  {/* Visibility */}
                  <section style={{ ...sectionStyle, padding: 22 }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>
                      Visibility
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        background: "#f4f5f7",
                        padding: 4,
                        borderRadius: 11,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, status: "active" }))}
                        style={{
                          flex: 1,
                          height: 36,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                          background: form.status === "active" ? "#fff" : "transparent",
                          color: form.status === "active" ? "#16181d" : "#8a909c",
                          boxShadow:
                            form.status === "active"
                              ? "0 1px 2px rgba(16,24,40,.1)"
                              : "none",
                        }}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, status: "draft" }))}
                        style={{
                          flex: 1,
                          height: 36,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                          background: form.status === "draft" ? "#fff" : "transparent",
                          color: form.status === "draft" ? "#16181d" : "#8a909c",
                          boxShadow:
                            form.status === "draft"
                              ? "0 1px 2px rgba(16,24,40,.1)"
                              : "none",
                        }}
                      >
                        Draft
                      </button>
                    </div>
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 11.5,
                        color: "#9aa0ac",
                        lineHeight: 1.5,
                      }}
                    >
                      {form.status === "active"
                        ? "This variant is visible to customers in the store."
                        : "Hidden from the store. Only visible to admins."}
                    </p>
                  </section>

                  {/* Summary */}
                  <section style={{ ...sectionStyle, padding: 22 }}>
                    <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>
                      Summary
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 11,
                        fontSize: 12.5,
                      }}
                    >
                      {[
                        { label: "SKU", value: sku },
                        {
                          label: "Variant",
                          value: `${form.size} · ${form.colorName || "—"}`,
                        },
                        {
                          label: "Price",
                          value: `฿${(priceN || 0).toLocaleString()}`,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <span style={{ color: "#9aa0ac" }}>{row.label}</span>
                          <span style={{ fontWeight: 600, color: "#374151" }}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "#9aa0ac" }}>Color</span>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            boxShadow: "0 0 0 1px #e2e5ea",
                            background: form.colorHex,
                            display: "inline-block",
                          }}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Toast */}
            {toast && (
              <div
                style={{
                  position: "fixed",
                  bottom: 26,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#16181d",
                  color: "#fff",
                  padding: "12px 20px",
                  borderRadius: 11,
                  fontSize: 13.5,
                  fontWeight: 500,
                  boxShadow: "0 8px 24px rgba(0,0,0,.22)",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  zIndex: 50,
                }}
              >
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span>
                {editingProduct ? "Variant saved" : "Product added"}
              </div>
            )}

            {/* Responsive: collapse right rail on small screens */}
            <style>{`
              @media (max-width: 900px) {
                .form-grid {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>
          </main>
        )}
      </div>
    </div>
  )
}
