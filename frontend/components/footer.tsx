import { Home, Mail, Phone, MapPin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Company */}
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground">ร้านบอสเนยย์</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ขายสินค้าคุณภาพดีราคาถูก เชื่อใจได้
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium text-foreground">ลิงค์ด่วน</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <a href="/" className="hover:text-foreground">
                  หน้าหลัก
                </a>
              </li>
              <li>
                <a href="/products" className="hover:text-foreground">
                  สินค้า
                </a>
              </li>
              <li>
                <a href="/profile" className="hover:text-foreground">
                  โปรไฟล์
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-medium text-foreground">ช่วยเหลือ</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground">
                  ติดต่อเรา
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  เงื่อนไขการใช้งาน
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  นโยบายความเป็นส่วนตัว
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-medium text-foreground">ติดต่อ</h4>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>081-XXX-XXXX</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>contact@bosbutter.com</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-1" />
                <span>Bangkok, Thailand</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Boss Butter. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
