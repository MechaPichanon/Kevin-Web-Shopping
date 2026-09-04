"use client"

import Link from "next/link"
import { Mail, Phone, MapPin } from "lucide-react"
import { useLang } from "@/lib/language-context"

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="bg-footer text-footer-foreground py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Company */}
          <div>
            <h3 className="font-serif text-lg font-bold text-footer-foreground">{t("footer.brand")}</h3>
            <p className="mt-2 text-sm text-footer-muted">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium text-footer-foreground">{t("footer.quickLinks")}</h4>
            <ul className="mt-2 space-y-1 text-sm text-footer-muted">
              <li>
                <Link href="/" className="hover:text-footer-foreground">
                  {t("footer.home")}
                </Link>
              </li>
              <li>
                <Link href="/products" className="hover:text-footer-foreground">
                  {t("footer.products")}
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-footer-foreground">
                  {t("footer.profile")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-medium text-footer-foreground">{t("footer.support")}</h4>
            <ul className="mt-2 space-y-1 text-sm text-footer-muted">
              <li>
                <Link href="/policy" className="hover:text-footer-foreground">
                  {t("footer.storePolicies")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-medium text-footer-foreground">{t("footer.contact")}</h4>
            <ul className="mt-2 space-y-2 text-sm text-footer-muted">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>095-095-2223</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>pichanon.tavee0079@gmail.com</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-1" />
                <span>Platinum Fashion Mall Floor 4 Zone 2 Room 1115, Bangkok, Thailand</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[#55463a] pt-8 text-center text-sm text-footer-muted">
          <p>{t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  )
}
