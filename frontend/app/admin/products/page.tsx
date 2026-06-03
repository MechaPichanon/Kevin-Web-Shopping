"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/product", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

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
}

export default function AdminProductsPage() {
  const router = useRouter()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAdmin] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }

    const user = localStorage.getItem("user")

    if (!user) {
      return false
    }

    try {
      return JSON.parse(user).role === "admin"
    } catch {
      return false
    }
  })

  const [products, setProducts] = useState<ProductRow[]>([])

  const [searchTerm, setSearchTerm] = useState("")

  const [showAddForm, setShowAddForm] = useState(false)

  const [newProduct, setNewProduct] = useState({
    product_name: "",
    category: "",
    sub_category: "",
    description: "",

    size: "",
    color: "",
    pattern: "",

    price: "",
    stock: "",
  })

  useEffect(() => {
    if (!isAdmin) {
      router.push("/login")
    }
  }, [isAdmin, router])

  const fetchProducts = async () => {
    try {
      const res = await fetch("http://localhost:5000/products")

      const data = (await res.json()) as ProductRow[]

      setProducts(data)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    let ignore = false

    fetch("http://localhost:5000/products")
      .then((res) => res.json())
      .then((data: ProductRow[]) => {
        if (!ignore) {
          setProducts(data)
        }
      })
      .catch((err) => {
        console.log(err)
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/login")
  }

  const handleAddProduct = async () => {
    try {
      const res = await fetch("http://localhost:5000/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProduct),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        return
      }

      alert("เพิ่มสินค้าสำเร็จ")

      fetchProducts()

      setShowAddForm(false)

      setNewProduct({
        product_name: "",
        category: "",
        sub_category: "",
        description: "",

        size: "",
        color: "",
        pattern: "",

        price: "",
        stock: "",
      })
    } catch (err) {
      console.log(err)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">
                  L
                </span>
              </div>

              <span className="font-semibold">BosButter</span>
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  item.href === "/admin/product"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-semibold">จัดการสินค้า</h1>
          </div>

          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มสินค้า
          </Button>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {/* Add Form */}
          {showAddForm && (
            <Card className="mb-6">
              <CardContent className="space-y-4 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder="ชื่อสินค้า"
                    value={newProduct.product_name}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        product_name: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="หมวดหมู่"
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        category: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="หมวดหมู่ย่อย"
                    value={newProduct.sub_category}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        sub_category: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="รายละเอียดสินค้า"
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        description: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="ไซส์"
                    value={newProduct.size}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        size: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="สี"
                    value={newProduct.color}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        color: e.target.value,
                      })
                    }
                  />

                  <Input
                    placeholder="ลาย"
                    value={newProduct.pattern}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        pattern: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="number"
                    placeholder="ราคา"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        price: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="number"
                    placeholder="Stock"
                    value={newProduct.stock}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        stock: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                  >
                    ยกเลิก
                  </Button>

                  <Button onClick={handleAddProduct}>
                    บันทึกสินค้า
                  </Button>
                </div>
              </CardContent>
            </Card>
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

          {/* Product Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">ชื่อสินค้า</th>
                      <th className="px-4 py-3 text-left">หมวดหมู่</th>
                      <th className="px-4 py-3 text-left">ไซส์</th>
                      <th className="px-4 py-3 text-left">สี</th>
                      <th className="px-4 py-3 text-left">ราคา</th>
                      <th className="px-4 py-3 text-left">Stock</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.variant_id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          {product.product_name}
                        </td>

                        <td className="px-4 py-3">
                          {product.category}
                        </td>

                        <td className="px-4 py-3">
                          {product.size}
                        </td>

                        <td className="px-4 py-3">
                          {product.color}
                        </td>

                        <td className="px-4 py-3">
                          ฿{Number(product.price).toLocaleString()}
                        </td>

                        <td className="px-4 py-3">
                          {product.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
