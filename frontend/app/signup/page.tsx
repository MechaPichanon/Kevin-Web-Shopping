"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLang } from "@/lib/language-context"
import { API_BASE as API } from "@/lib/api"

export default function SignupPage() {
  const router = useRouter()
  const { t } = useLang()

  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === "phone" ? value.replace(/\D/g, "").slice(0, 10) : value,
    })
  }

  const passwordRequirements = [
    { text: t("auth.pwReqMinLength"), met: formData.password.length >= 8 },
    { text: t("auth.pwReqUppercase"), met: /[A-Z]/.test(formData.password) },
    { text: t("auth.pwReqNumber"), met: /[0-9]/.test(formData.password) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.passwordMismatch"))
      return
    }
    if (!passwordRequirements.every((req) => req.met)) {
      setError(t("auth.pwRequirementsNotMet"))
      return
    }
    if (!agreedToTerms) {
      setError(t("auth.termsRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      const trimmedName = formData.name.trim()
      const [firstName, ...rest] = trimmedName.split(/\s+/)
      const lastName = rest.join(" ")

      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          firstName: firstName || "",
          lastName: lastName || "",
          phone: formData.phone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t("auth.signupFailed"))
        return
      }

      router.push("/login")
    } catch (err) {
      console.error("Signup error:", err)
      setError(t("auth.connectionError"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
                <span className="font-serif text-2xl font-bold text-primary-foreground">K</span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {t("auth.signupTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.subtitle")}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                  {t("auth.username")}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder={t("auth.usernamePlaceholder")}
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  {t("auth.name")}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder={t("auth.namePlaceholder")}
                    value={formData.name}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-foreground">
                  {t("auth.phone")}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t("auth.phonePlaceholder")}
                    value={formData.phone}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  {t("auth.email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t("auth.password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder")}
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs ${req.met ? "text-green-600" : "text-muted-foreground"
                        }`}
                    >
                      <Check className={`h-3 w-3 ${req.met ? "opacity-100" : "opacity-30"}`} />
                      {req.text}
                    </div>
                  ))}
                </div>

              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  {t("auth.confirmPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
                )}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${agreedToTerms
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                    }`}
                >
                  {agreedToTerms && <Check className="h-3 w-3" />}
                </button>
                <span className="text-sm leading-6 text-muted-foreground">
                  {t("auth.agreeToTermsPrefix")}{" "}
                  <button type="button" onClick={() => setPolicyOpen(true)} className="font-medium text-primary hover:underline">
                    {t("auth.termsLinkText")}
                  </button>
                  <span className="mt-1 block text-xs text-muted-foreground">{t("auth.termsHint")}</span>
                </span>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={!agreedToTerms || isSubmitting}>
                {isSubmitting ? t("auth.signingUp") : t("auth.signupButton")}
              </Button>
            </form>

            <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 font-serif text-xl">
                    <FileText className="h-5 w-5 text-primary" />
                    {t("auth.policyDialogTitle")}
                  </DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-3 text-sm leading-7 text-muted-foreground">
                  <section>
                    <h2 className="mb-1 font-semibold text-foreground">{t("auth.policyBenefitsTitle")}</h2>
                    <p>{t("auth.policyBenefitsBody")}</p>
                  </section>
                  <section>
                    <h2 className="mb-1 font-semibold text-foreground">{t("auth.policyAccountTitle")}</h2>
                    <p>{t("auth.policyAccountBody")}</p>
                  </section>
                  <section>
                    <h2 className="mb-1 font-semibold text-foreground">{t("auth.policyDataTitle")}</h2>
                    <p>{t("auth.policyDataBody")}</p>
                  </section>
                  <section>
                    <h2 className="mb-1 font-semibold text-foreground">{t("auth.policyOrdersTitle")}</h2>
                    <p>{t("auth.policyOrdersBody")}</p>
                  </section>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-foreground">{t("auth.policyAgreeNotice")}</div>
                </div>
                <Button type="button" className="w-full" onClick={() => setPolicyOpen(false)}>{t("auth.policyAcceptButton")}</Button>
              </DialogContent>
            </Dialog>

            {/* Login Link */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("auth.loginButton")}
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <Link
            href="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("auth.backToHome")}
          </Link>
        </div>
      </main>

    </div>
  )
}