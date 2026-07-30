import { Mail, Phone, MapPin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-footer text-footer-foreground py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Company */}
          <div>
            <h3 className="font-serif text-lg font-bold text-footer-foreground">ร้านเควิน</h3>
            <p className="mt-2 text-sm text-footer-muted">
              ขายสินค้าคุณภาพดีราคาถูก เชื่อใจได้
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium text-footer-foreground">ลิงค์ด่วน</h4>
            <ul className="mt-2 space-y-1 text-sm text-footer-muted">
              <li>
                <a href="/" className="hover:text-footer-foreground">
                  หน้าหลัก
                </a>
              </li>
              <li>
                <a href="/products" className="hover:text-footer-foreground">
                  สินค้า
                </a>
              </li>
              <li>
                <a href="/profile" className="hover:text-footer-foreground">
                  โปรไฟล์
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-medium text-footer-foreground">ช่วยเหลือ</h4>
            <ul className="mt-2 space-y-1 text-sm text-footer-muted">
              <li>
                <a href="#" className="hover:text-footer-foreground">
                  ติดต่อเรา
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-footer-foreground">
                  เงื่อนไขการใช้งาน
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-footer-foreground">
                  นโยบายความเป็นส่วนตัว
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-medium text-footer-foreground">ติดต่อ</h4>
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
          <p>&copy; 2026 Kevin. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
