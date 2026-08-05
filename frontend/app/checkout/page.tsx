"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, ArrowLeft, CreditCard, Truck, ShoppingBag, QrCode } from "lucide-react"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { useRouter } from "next/navigation"
import { getToken } from "@/lib/auth"
import type { ShippingAddress } from "@/types/address"


const paymentMethods = [
  { id: "promptpay", name: "พร้อมเพย์ (PromptPay)", icon: QrCode },

]

export default function CheckoutPage() {
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    shippingFee: 0,
    totalPrice: 0,
  })
  const [items, setItems] = useState<any[]>([])
  const [totalPrice, setTotalPrice] = useState(0)
  const router = useRouter()
  const [slip, setSlip] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState("")
  const [isUploadingSlip, setIsUploadingSlip] = useState(false)
  const [step, setStep] = useState<"form" | "payment" | "done">("form")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("promptpay")
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [form, setForm] = useState<ShippingAddress>({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    province: "",
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
        setForm((prev) => ({
          ...prev,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
          addressLine1: data.addressLine1 || "",
          addressLine2: data.addressLine2 || "",
          province: data.province || "",
          postalCode: data.postalCode || "",
        }))
      } catch (err) {
        console.error("Profile fetch error:", err)
        router.push("/login")
      }
    }
    const loadCart = async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}")

      if (!user.id) return

      const res = await fetch(
        `http://localhost:5000/cart/${user.id}`
      )

      const data = await res.json()

      setItems(data)

      const total = data.reduce(
        (sum: number, item: any) =>
          sum + Number(item.price) * item.quantity,
        0
      )

      setTotalPrice(total)
    }

    loadCart()
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
  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setSlipError("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSlipError("ขนาดไฟล์ต้องไม่เกิน 5MB")
      return
    }
    setSlipError("")
    setSlipFile(file)
    const reader = new FileReader()
    reader.onload = () => setSlip(reader.result as string)
    reader.readAsDataURL(file)
  }

  const fetchQrCode = async (amount: number) => {
    setQrLoading(true)
    try {
      const res = await fetch("http://localhost:5000/payment/promptpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (res.ok) setQrCode(data.qr)
    } catch (err) {
      console.error("QR fetch error:", err)
    } finally {
      setQrLoading(false)
    }
  }

  const handleSlipUpload = async () => {
    if (!slipFile || !orderId) return
    setIsUploadingSlip(true)
    setSlipError("")
    try {
      const formData = new FormData()
      formData.append("slip", slipFile)
      const res = await fetch(`http://localhost:5000/orders/${orderId}/payment-slip`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setSlipError(data.error || "อัปโหลดสลิปไม่สำเร็จ")
        return
      }
      setStep("done")
    } catch (err) {
      console.error("Slip upload error:", err)
      setSlipError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
    } finally {
      setIsUploadingSlip(false)
    }
  }
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
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        province: form.province,
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
      setItems([])
      setTotalPrice(0)
      setOrderSummary({
        subtotal: data.subtotal,
        shippingFee: data.shippingFee,
        totalPrice: data.totalPrice,
      })
      window.dispatchEvent(new Event("cartUpdated"))
      setStep("payment")
      fetchQrCode(data.totalPrice)
    } catch (err) {
      console.error("Order submit error:", err)
      alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
    } finally {
      setIsLoading(false)
    }
  }

  // Payment step: show the PromptPay QR and collect the transfer slip
  if (step === "payment") {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              ชำระเงินผ่านพร้อมเพย์
            </h1>
            <p className="mt-2 text-muted-foreground">
              สแกน QR เพื่อชำระเงิน แล้วอัปโหลดสลิปการโอนเพื่อยืนยัน
            </p>
            <Card className="mt-6 w-full border-border">
              <CardContent className="flex flex-col items-center gap-4 p-6">
                <div className="flex justify-between w-full text-sm">
                  <span className="text-muted-foreground">หมายเลขคำสั่งซื้อ</span>
                  <span className="font-medium text-foreground">{orderId}</span>
                </div>
                <div className="flex justify-between w-full text-sm">
                  <span className="text-muted-foreground">ยอดชำระ</span>
                  <span className="font-medium text-foreground">{formatPrice(orderSummary.totalPrice)}</span>
                </div>

                <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-border bg-secondary/30">
                  {qrLoading ? (
                    <span className="text-sm text-muted-foreground">กำลังสร้าง QR...</span>
                  ) : qrCode ? (
                    <img src={qrCode} alt="PromptPay QR" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm text-muted-foreground">ไม่สามารถสร้าง QR ได้</span>
                  )}
                </div>

                <div className="w-full text-left">
                  <Label htmlFor="slip">อัปโหลดสลิปการโอนเงิน</Label>
                  <input
                    id="slip"
                    type="file"
                    accept="image/*"
                    onChange={handleSlipChange}
                    className="mt-1.5 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
                  />
                  {slipError && <p className="mt-1 text-sm text-destructive">{slipError}</p>}
                  {slip && (
                    <img src={slip} alt="ตัวอย่างสลิป" className="mt-3 max-h-48 w-full rounded-md object-contain" />
                  )}
                </div>

                <Button
                  className="w-full"
                  disabled={!slipFile || isUploadingSlip}
                  onClick={handleSlipUpload}
                >
                  {isUploadingSlip ? "กำลังอัปโหลด..." : "ยืนยันการอัปโหลดสลิป"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Order placed, awaiting payment verification
  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col">

        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mt-6 font-serif text-3xl font-bold text-foreground">
              รอตรวจสอบการชำระเงิน
            </h1>
            <p className="mt-2 text-muted-foreground">
              เราได้รับคำสั่งซื้อและสลิปการโอนของคุณแล้ว ทีมงานจะตรวจสอบและยืนยันการชำระเงินเร็วๆ นี้
            </p>
            <Card className="mt-6 w-full border-border">
              <CardContent className="p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">หมายเลขคำสั่งซื้อ</span>
                  <span className="font-medium text-foreground">{orderId}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">ยอดชำระ</span>
                  <span className="font-medium text-foreground">{formatPrice(orderSummary.totalPrice)}</span>
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
                    <div>
                      <Label htmlFor="firstName">ชื่อ</Label>
                      <Input
                        id="firstName"
                        required
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        className="mt-1.5"
                        placeholder="ชื่อ"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">นามสกุล</Label>
                      <Input
                        id="lastName"
                        required
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        className="mt-1.5"
                        placeholder="นามสกุล"
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
                      <Label htmlFor="addressLine1">ที่อยู่</Label>
                      <Input
                        id="addressLine1"
                        required
                        value={form.addressLine1}
                        onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                        className="mt-1.5"
                        placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="addressLine2">ที่อยู่เพิ่มเติม (ถ้ามี)</Label>
                      <Input
                        id="addressLine2"
                        value={form.addressLine2}
                        onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                        className="mt-1.5"
                        placeholder="ชั้น, ห้อง, อาคาร (ไม่บังคับ)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="province">จังหวัด</Label>
                      <Input
                        id="province"
                        required
                        value={form.province}
                        onChange={(e) => setForm({ ...form, province: e.target.value })}
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
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${paymentMethod === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                          }`}
                      >
                        <method.icon className="h-5 w-5 text-foreground" />
                        <span className="font-medium text-foreground">{method.name}</span>
                        <span
                          className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border ${paymentMethod === method.id ? "border-primary" : "border-border"
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
                    สรุปคำสั่งซื้อ ({items.length})
                  </h2>
                  <div className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto">
                    {items.map((item: any) => (
                      <div
                        key={item.cart_item_id}
                        className="flex gap-3"
                      >
                        <div className="h-14 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                          <img
                            src={
                              item.image_url ||
                              "https://placehold.co/100x120"
                            }
                            alt={item.product_name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="flex flex-1 flex-col justify-center">
                          <p className="line-clamp-1 text-sm font-medium">
                            {item.product_name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            จำนวน {item.quantity}
                          </p>
                        </div>

                        <span className="self-center text-sm font-medium">
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
