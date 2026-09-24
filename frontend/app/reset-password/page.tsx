"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLang } from "@/lib/language-context"
import { API_BASE as API } from "@/lib/api"

function ResetPasswordForm() {
  const { t } = useLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const passwordRequirements = [
    { text: t("auth.pwReqMinLength"), met: password.length >= 8 },
    { text: t("auth.pwReqUppercase"), met: /[A-Z]/.test(password) },
    { text: t("auth.pwReqNumber"), met: /[0-9]/.test(password) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"))
      return
    }
    if (!passwordRequirements.every((req) => req.met)) {
      setError(t("auth.pwRequirementsNotMet"))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || t("auth.serverError"))
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error("Reset password error:", err)
      setError(t("auth.connectionError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
                <span className="font-serif text-2xl font-bold text-primary-foreground">K</span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {t("auth.resetPasswordTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.resetPasswordSubtitle")}
              </p>
            </div>

            {!token ? (
              <div className="space-y-4 text-center">
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {t("auth.missingToken")}
                </div>
                <Link href="/forgot-password">
                  <Button className="w-full">{t("auth.requestNewLink")}</Button>
                </Link>
              </div>
            ) : success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("auth.resetSuccess")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetSuccessHint")}</p>
                </div>
                <Button className="w-full" onClick={() => router.push("/login")}>
                  {t("auth.loginButton")}
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      {t("auth.newPassword")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("auth.newPasswordPlaceholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                        type={showPassword ? "text" : "password"}
                        placeholder={t("auth.confirmNewPasswordPlaceholder")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("auth.resettingPassword") : t("auth.resetPasswordButton")}
                  </Button>
                </form>
              </>
            )}
          </div>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
