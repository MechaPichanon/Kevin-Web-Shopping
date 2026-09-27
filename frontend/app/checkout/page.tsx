"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, ArrowLeft, ShoppingBag, QrCode, Tag, X, Plus } from "lucide-react"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RequiredMark } from "@/components/ui/required-mark"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { getToken } from "@/lib/auth"
import { useLang } from "@/lib/language-context"
import {
  type Address,
  type AddressInput,
  createAddress,
  emptyAddressInput,
  formatFullAddress,
  formatPhone,
  listAddresses,
  updateAddress,
} from "@/lib/addresses"
import AddressForm from "@/components/AddressForm"
import AddressDeleteDialog from "@/components/AddressDeleteDialog"
import { API_BASE as API, resolveApiUrl } from "@/lib/api"

const paymentMethods = [
  { id: "promptpay", nameKey: "checkout.promptpay" as const, icon: QrCode },
]

export default function CheckoutPage() {
  const { t, locale } = useLang()
  const [orderSummary, setOrderSummary] = useState({ subtotal: 0, shippingFee: 0, totalPrice: 0 })
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
  const [userId, setUserId] = useState<number | null>(null)

  // ── Discount state ──
  const [discountInput, setDiscountInput] = useState("")
  const [discountCode, setDiscountCode] = useState("")
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountError, setDiscountError] = useState("")
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false)

  // ── Shipping address: picked from the saved address book (/addresses) ──
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [editingAddress, setEditingAddress] = useState<"new" | Address | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)
  const [addressError, setAddressError] = useState("")

  // Refetch the address book; keep `preferId` selected if it still exists,
  // otherwise fall back to the default (or the first) address.
  const reloadAddresses = async (preferId?: number | null) => {
    try {
      const list = await listAddresses()
      setAddresses(list)
      setSelectedAddressId((current) => {
        const want = preferId === undefined ? current : preferId
        if (want && list.some((a) => a.id === want)) return want
        return (list.find((a) => a.isDefault) ?? list[0])?.id ?? null
      })
      return list
    } catch {
      setAddressError(t("address.loadError"))
      setAddresses((prev) => prev ?? [])
      return null
    }
  }

  const handleSaveAddress = async (input: AddressInput) => {
    const saved = editingAddress === "new"
      ? await createAddress(input)
      : await updateAddress((editingAddress as Address).id, input)
    setEditingAddress(null)
    setAddressError("")
    await reloadAddresses(saved.id)
  }

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken()
      if (!token) { router.push("/login"); return }
      try {
        const res = await fetch(`${API}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { router.push("/login"); return }
        const data = await res.json()
        setUserId(data.id)
        const list = await reloadAddresses()
        // First-time buyer with an empty address book: open the add form straight away.
        if (list && list.length === 0) setEditingAddress("new")
      } catch (err) {
        console.error("Profile fetch error:", err)
        router.push("/login")
      }
    }

    const loadCart = async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      if (!user.id) return
      const res = await fetch(`${API}/cart/${user.id}`)
      const data = await res.json()
      setItems(data)
      const total = data.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0)
      setTotalPrice(total)
    }

    loadCart()
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "THB", minimumFractionDigits: 0 }).format(price)

  const shippingFee = totalPrice >= 1500 || totalPrice === 0 ? 0 : 50
  const grandTotal = Math.max(0, totalPrice - discountAmount) + shippingFee

  // ── Apply discount ──
  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) { setDiscountError(t("checkout.discountRequired")); return }
    setDiscountError("")
    setIsApplyingDiscount(true)
    try {
      const token = getToken()
      const res = await fetch(`${API}/discount/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: discountInput.trim(), subtotal: totalPrice }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setDiscountError(data.error || t("checkout.discountInvalid"))
        return
      }
      setDiscountCode(discountInput.trim())
      setDiscountAmount(Number(data.discount_amount))
      setDiscountInput("")
    } catch {
      setDiscountError(t("checkout.connectionError"))
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  const handleRemoveDiscount = () => {
    setDiscountCode("")
    setDiscountAmount(0)
    setDiscountError("")
  }

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { setSlipError(t("checkout.slipImageOnly")); return }
    if (file.size > 5 * 1024 * 1024) { setSlipError(t("checkout.slipTooLarge")); return }
    setSlipError("")
    setSlipFile(file)
    const reader = new FileReader()
    reader.onload = () => setSlip(reader.result as string)
    reader.readAsDataURL(file)
  }

  const fetchQrCode = async (amount: number) => {
    setQrLoading(true)
    try {
      const res = await fetch(`${API}/payment/promptpay`, {
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
    if (!slipFile || !userId) return
    setIsUploadingSlip(true)
    setSlipError("")
    try {
      const formData = new FormData()
      formData.append("slip", slipFile)
      formData.append("user_id", String(userId))
      formData.append("address_id", String(selectedAddressId))
      formData.append("payment_method", paymentMethod)
      if (discountCode) formData.append("discount_code", discountCode)

      const res = await fetch(`${API}/orders/create`, { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) { setSlipError(data.error || t("checkout.slipUploadFailed")); return }

      setOrderId(data.order_id || "")
      setOrderSummary({ subtotal: data.subtotal, shippingFee: data.shippingFee, totalPrice: data.totalPrice })
      setItems([])
      setTotalPrice(0)
      window.dispatchEvent(new Event("cartUpdated"))
      setStep("done")
    } catch (err) {
      console.error("Slip upload error:", err)
      setSlipError(t("checkout.connectionError"))
    } finally {
      setIsUploadingSlip(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) { alert(t("checkout.loginRequired")); router.push("/login"); return }
    if (!selectedAddressId) { setAddressError(t("address.chooseRequired")); return }
    setStep("payment")
    fetchQrCode(grandTotal)
  }

  // ── Payment step ──
  if (step === "payment") {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <h1 className="font-serif text-3xl font-bold text-foreground">{t("checkout.payViaPromptPay")}</h1>
            <p className="mt-2 text-muted-foreground">{t("checkout.payViaPromptPayHint")}</p>
            <Card className="mt-6 w-full border-border">
              <CardContent className="flex flex-col items-center gap-4 p-6">
                {orderId && (
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-muted-foreground">{t("checkout.orderNumber")}</span>
                    <span className="font-medium text-foreground">{orderId}</span>
                  </div>
                )}
                <div className="flex justify-between w-full text-sm">
                  <span className="text-muted-foreground">{t("checkout.amountDue")}</span>
                  <span className="font-medium text-foreground">{formatPrice(grandTotal)}</span>
                </div>
                <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-border bg-secondary/30">
                  {qrLoading ? (
                    <span className="text-sm text-muted-foreground">{t("checkout.generatingQr")}</span>
                  ) : qrCode ? (
                    <img src={qrCode} alt="PromptPay QR" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("checkout.qrFailed")}</span>
                  )}
                </div>
                <div className="w-full text-left">
                  <Label htmlFor="slip">{t("checkout.uploadSlipLabel")}<RequiredMark /></Label>
                  <input
                    id="slip"
                    type="file"
                    accept="image/*"
                    onChange={handleSlipChange}
                    className="mt-1.5 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
                  />
                  {slipError && <p className="mt-1 text-sm text-destructive">{slipError}</p>}
                  {slip && <img src={slip} alt={t("checkout.slipPreview")} className="mt-3 max-h-48 w-full rounded-md object-contain" />}
                </div>
                <Button className="w-full" disabled={!slipFile || isUploadingSlip} onClick={handleSlipUpload}>
                  {isUploadingSlip ? t("checkout.uploading") : t("checkout.confirmSlipUpload")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Done step ──
  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mt-6 font-serif text-3xl font-bold text-foreground">{t("checkout.awaitingVerification")}</h1>
            <p className="mt-2 text-muted-foreground">{t("checkout.awaitingVerificationHint")}</p>
            <Card className="mt-6 w-full border-border">
              <CardContent className="p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.orderNumber")}</span>
                  <span className="font-medium text-foreground">{orderId}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.amountDue")}</span>
                  <span className="font-medium text-foreground">{formatPrice(orderSummary.totalPrice)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.paymentMethodLabel")}</span>
                  <span className="font-medium text-foreground">
                    {(() => {
                      const m = paymentMethods.find((p) => p.id === paymentMethod)
                      return m ? t(m.nameKey) : ""
                    })()}
                  </span>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex w-full flex-col gap-2">
              <Link href="/products"><Button className="w-full">{t("checkout.continueShopping")}</Button></Link>
              <Link href="/"><Button variant="ghost" className="w-full">{t("checkout.backHome")}</Button></Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Empty cart ──
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">{t("checkout.emptyCart")}</h1>
            <p className="mt-2 text-muted-foreground">{t("checkout.emptyCartHint")}</p>
            <Link href="/products"><Button className="mt-6">{t("checkout.browse")}</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Main form ──
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("checkout.backToCart")}
          </Link>
          <h1 className="mt-4 font-serif text-3xl font-bold text-foreground sm:text-4xl">{t("checkout.title")}</h1>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-3">
            {/* Shipping & Payment */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Card className="border-border">
                <CardContent className="p-6">
                  <h2 className="font-serif text-xl font-bold text-foreground">{t("checkout.shippingInfo")}<RequiredMark /></h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("address.chooseShipping")}</p>

                  {addresses === null ? (
                    <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
                  ) : (
                    <div role="radiogroup" aria-label={t("address.chooseShipping")} className="mt-4 grid gap-3 sm:grid-cols-2">
                      {addresses.map((a) => {
                        const selected = a.id === selectedAddressId
                        const pick = () => { setSelectedAddressId(a.id); setAddressError("") }
                        return (
                          <div
                            key={a.id}
                            role="radio"
                            aria-checked={selected}
                            tabIndex={0}
                            onClick={pick}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick() } }}
                            className={`flex cursor-pointer flex-col gap-2 rounded-[14px] border p-4 text-left transition-colors ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-[#c8b8a6]"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-plex-thai text-sm font-medium text-foreground">
                                {a.recipientName}
                                <span className="ml-1.5 font-mono text-xs font-normal text-accent">{formatPhone(a.phone)}</span>
                              </div>
                              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary" : "border-border"}`}>
                                {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                              </span>
                            </div>
                            <p className="line-clamp-2 font-plex-thai text-sm leading-relaxed text-foreground">{formatFullAddress(a, t)}</p>
                            <div className="mt-auto flex items-center gap-4 pt-1 text-sm">
                              {a.isDefault && (
                                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] tracking-[1.5px] text-primary-foreground">
                                  {t("address.defaultBadge")}
                                </span>
                              )}
                              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingAddress(a) }} className="ml-auto font-medium text-primary hover:underline">
                                {t("address.edit")}
                              </button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(a) }} className="text-muted-foreground hover:text-foreground">
                                {t("address.delete")}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => setEditingAddress("new")}
                        className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#c8b8a6] bg-card p-4 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <Plus className="h-5 w-5" />
                        {t("address.newTitle")}
                      </button>
                    </div>
                  )}
                  {addressError && <p className="mt-3 text-sm text-destructive">{addressError}</p>}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <h2 className="font-serif text-xl font-bold text-foreground">{t("checkout.paymentMethod")}</h2>
                  <div className="mt-4 flex flex-col gap-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${paymentMethod === method.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                      >
                        <method.icon className="h-5 w-5 text-foreground" />
                        <span className="font-medium text-foreground">{t(method.nameKey)}</span>
                        <span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border ${paymentMethod === method.id ? "border-primary" : "border-border"}`}>
                          {paymentMethod === method.id && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
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
                  <h2 className="font-serif text-xl font-bold text-foreground">{t("checkout.orderSummary", { n: items.length })}</h2>

                  <div className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto">
                    {items.map((item: any) => (
                      <div key={item.cart_item_id} className="flex gap-3">
                        <div className="h-14 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                          <img src={item.image_url ? resolveApiUrl(item.image_url) : "https://placehold.co/100x120"} alt={item.product_name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col justify-center">
                          <p className="line-clamp-1 text-sm font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{t("checkout.qty", { n: item.quantity })}</p>
                        </div>
                        <span className="self-center text-sm font-medium">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Discount Code ── */}
                  <div className="mt-4 flex flex-col gap-2">
                    <Label className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      {t("checkout.discountCode")}
                    </Label>
                    {discountCode ? (
                      <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                        <span className="text-sm font-medium text-primary">{discountCode} (-{formatPrice(discountAmount)})</span>
                        <button type="button" onClick={handleRemoveDiscount} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyDiscount())}
                          placeholder={t("checkout.discountPlaceholder")}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={handleApplyDiscount} disabled={isApplyingDiscount}>
                          {isApplyingDiscount ? "..." : t("checkout.apply")}
                        </Button>
                      </div>
                    )}
                    {discountError && <p className="text-xs text-destructive">{discountError}</p>}
                  </div>

                  {/* ── Price Summary ── */}
                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("checkout.subtotal")}</span>
                      <span className="font-medium text-foreground">{formatPrice(totalPrice)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("checkout.discount")} ({discountCode})</span>
                        <span className="font-medium text-primary">-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("checkout.shipping")}</span>
                      <span className="font-medium text-foreground">{shippingFee === 0 ? t("checkout.free") : formatPrice(shippingFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-medium text-foreground">{t("checkout.grandTotal")}</span>
                      <span className="font-serif text-xl font-bold text-foreground">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>

                  <Button type="submit" className="mt-6 w-full">
                    {t("checkout.placeOrder")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>

          {/* Add / edit address without leaving checkout */}
          <Dialog open={editingAddress !== null} onOpenChange={(open) => { if (!open) setEditingAddress(null) }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
              <DialogTitle className="sr-only">
                {editingAddress === "new" ? t("address.newTitle") : t("address.editTitle")}
              </DialogTitle>
              {editingAddress !== null && (
                <AddressForm
                  key={editingAddress === "new" ? "new" : editingAddress.id}
                  framed={false}
                  mode={editingAddress === "new" ? "new" : "edit"}
                  initial={editingAddress === "new" ? { ...emptyAddressInput, isDefault: (addresses?.length ?? 0) === 0 } : editingAddress}
                  lockDefault={editingAddress === "new" ? (addresses?.length ?? 0) === 0 : editingAddress.isDefault}
                  onSubmit={handleSaveAddress}
                  onCancel={() => setEditingAddress(null)}
                />
              )}
            </DialogContent>
          </Dialog>

          <AddressDeleteDialog
            target={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={(id) => reloadAddresses(selectedAddressId === id ? null : selectedAddressId)}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}