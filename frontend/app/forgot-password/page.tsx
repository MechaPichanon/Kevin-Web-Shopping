"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLang } from "@/lib/language-context"
import { API_BASE as API } from "@/lib/api"

export default function ForgotPasswordPage() {
  const { t } = useLang()

  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [devResetLink, setDevResetLink] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(t("auth.enterBoth"))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || t("auth.serverError"))
        return
      }

      setDevResetLink(data.devResetLink || null)
      setSubmitted(true)
    } catch (err) {
      console.error("Forgot password error:", err)
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
                {t("auth.forgotPasswordTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.forgotPasswordSubtitle")}
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  {t("auth.resetLinkSentGeneric")}
                </div>
                {devResetLink && (
                  <div className="rounded-lg border border-border bg-muted p-3 text-xs">
                    <p className="mb-1.5 font-medium text-muted-foreground">
                      {t("auth.devResetLinkNotice")}
                    </p>
                    <Link
                      href={devResetLink.replace(/^https?:\/\/[^/]+/, "")}
                      className="break-all text-primary hover:underline"
                    >
                      {devResetLink}
                    </Link>
                  </div>
                )}
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
                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                      {t("auth.email")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("auth.emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
                  </Button>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("auth.backToLogin")}
              </Link>
            </p>
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
