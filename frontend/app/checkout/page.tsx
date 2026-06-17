"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, ArrowLeft, CreditCard, Truck, ShoppingBag } from "lucide-react"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { useRouter } from "next/navigation"
import { getToken } from "@/lib/auth"

const paymentMethods = [
  { id: "cod", name: "เก็บเงินปลายทาง", icon: Truck },
  { id: "card", name: "บัตรเครดิต/เดบิต", icon: CreditCard },
  { id: "transfer", name: "โอนผ่านธนาคาร", icon: ShoppingBag },
]

export default function CheckoutPage() {
  const { items, totalItems, totalPrice, clearCart } = useCart()
  const router = useRouter()
  const [isComplete, setIsComplete] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cod")
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  })

  useEffect(() => {
    // Ensure user is logged in and fetch profile for user_id
    const fetchProfile = async () => {
      const token = getToken()
      if (!token) {
        router.push("/login")
        return
      }

      try {
        const res = await fetch("http://localhost:5000/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          router.push("/login")
          return
        }

        const data = await res.json()
        setUserId(data.id)
      } catch (err) {
        console.error("Profile fetch error:", err)
        router.push("/login")
      }
    }

    fetchProfile()
  }, [router])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price)

  const shippingFee = totalPrice >= 1500 || totalPrice === 0 ? 0 : 50
  const grandTotal = totalPrice + shippingFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ")
      router.push("/login")
      return
    }

    setIsLoading(true)

    try {
      const payload = {
        user_id: userId,
        name: form.name,
        phone: form.phone,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        payment_method: paymentMethod,
      }

      const res = await fetch("http://localhost:5000/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "เกิดข้อผิดพลาดในการสั่งซื้อ")
        setIsLoading(false)
        return
      }

      setOrderId(data.order_id || "")
      setIsComplete(true)
      clearCart()
    } catch (err) {
      console.error("Order submit error:", err)
      alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
    } finally {
      setIsLoading(false)
    }
  }

  // Order success screen
  if (isComplete) {
    return (
      <div className="flex min-h-screen flex-col">
        
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mt-6 font-serif text-3xl font-bold text-foreground">
              สั่งซื้อสำเร็จ!
            </h1>
            <p className="mt-2 text-muted-foreground">
              ขอบคุณสำหรับการสั่งซื้อ เราได้รับคำสั่งซื้อของคุณแล้ว
            </p>
            <Card className="mt-6 w-full border-border">
              <CardContent className="p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">หมายเลขคำสั่งซื้อ</span>
                  <span className="font-medium text-foreground">{orderId}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">ยอดชำระ</span>
                  <span className="font-medium text-foreground">{formatPrice(grandTotal)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">วิธีชำระเงิน</span>
                  <span className="font-medium text-foreground">
                    {paymentMethods.find((p) => p.id === paymentMethod)?.name}
                  </span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex w-full flex-col gap-2">
              <Link href="/products">
                <Button className="w-full">เลือกซื้อสินค้าต่อ</Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full">กลับหน้าหลัก</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Empty cart guard
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">
              ไม่มีสินค้าในตะกร้า
            </h1>
            <p className="mt-2 text-muted-foreground">เพิ่มสินค้าลงตะกร้าก่อนทำการสั่งซื้อ</p>
            <Link href="/products">
              <Button className="mt-6">เลือกซื้อสินค้า</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับไปที่ตะกร้า
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-bold text-foreground sm:text-4xl">
            ชำระเงิน
          </h1>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-3">
            {/* Shipping & Payment */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Shipping Info */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <h2 className="font-serif text-xl font-bold text-foreground">ข้อมูลการจัดส่ง</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                      <Input
                        id="name"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="mt-1.5"
                        placeholder="กรอกชื่อ-นามสกุล"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <Input
                        id="phone"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="mt-1.5"
                        placeholder="08X-XXX-XXXX"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="address">ที่อยู่</Label>
                      <Input
                        id="address"
                        required
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="mt-1.5"
                        placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">จังหวัด</Label>
                      <Input
                        id="city"
                        required
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="mt-1.5"
                        placeholder="จังหวัด"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
                      <Input
                        id="postalCode"
                        required
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                        className="mt-1.5"
                        placeholder="10XXX"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <h2 className="font-serif text-xl font-bold text-foreground">วิธีการชำระเงิน</h2>
                  <div className="mt-4 flex flex-col gap-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                          paymentMethod === method.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <method.icon className="h-5 w-5 text-foreground" />
                        <span className="font-medium text-foreground">{method.name}</span>
                        <span
                          className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border ${
                            paymentMethod === method.id ? "border-primary" : "border-border"
                          }`}
                        >
                          {paymentMethod === method.id && (
                            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20 border-border">
                <CardContent className="p-6">
                  <h2 className="font-serif text-xl font-bold text-foreground">
                    สรุปคำสั่งซื้อ ({totalItems})
                  </h2>
                  <div className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto">
                    {items.map((item: any) => (
                      <div key={`${item.id}-${item.size}`} className="flex gap-3">
                        <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-md bg-secondary text-2xl">
                          {item.image}
                        </div>
                        <div className="flex flex-1 flex-col justify-center">
                          <p className="line-clamp-1 text-sm font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ไซส์ {item.size} x {item.quantity}
                          </p>
                        </div>
                        <span className="self-center text-sm font-medium text-foreground">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ยอดรวมสินค้า</span>
                      <span className="font-medium text-foreground">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ค่าจัดส่ง</span>
                      <span className="font-medium text-foreground">
                        {shippingFee === 0 ? "ฟรี" : formatPrice(shippingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-medium text-foreground">ยอดรวมทั้งหมด</span>
                      <span className="font-serif text-xl font-bold text-foreground">
                        {formatPrice(grandTotal)}
                      </span>
                    </div>
                  </div>
                  <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
                    {isLoading ? "กำลังดำเนินการ..." : "ยืนยันคำสั่งซื้อ"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
