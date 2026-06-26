"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Save,
  Lock,
  Bell,
  CreditCard,
  Package,
  Heart,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getToken } from "@/lib/auth";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ProfileUser = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;

};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;

};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",

};

// const menuItems = [
//   { icon: Package, label: "คำสั่งซื้อของฉัน", href: "/orders", badge: "3" },
//   { icon: Heart, label: "สินค้าที่ชอบ", href: "/wishlist", badge: "12" },
//   { icon: CreditCard, label: "วิธีการชำระเงิน", href: "/payment-methods" },
//   { icon: MapPin, label: "ที่อยู่จัดส่ง", href: "/addresses" },
//   { icon: Lock, label: "เปลี่ยนรหัสผ่าน", href: "/change-password" },
// ];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  // ── Profile state ──
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [form, setForm] = useState<ProfileForm>(emptyForm);


  // ── Security / password state ──
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // ─────────────────────────────────────────────
  // Load profile from backend
  // ─────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    fetch("http://localhost:5000/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/login");
        } else {
          setProfileError("");
          setUser(data);
          setForm({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
          });
        }
      })
      .catch(() => setProfileError("ไม่สามารถโหลดข้อมูลได้"));
  }, [router]);

  // ─────────────────────────────────────────────
  // Handlers – Profile
  // ─────────────────────────────────────────────
  const handleChange = (field: keyof ProfileForm, value: string) => {
    const next = field === "phone" ? value.replace(/\D/g, "") : value;
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setIsSaving(true);
    setProfileError("");

    try {
      const res = await fetch("http://localhost:5000/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setProfileError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }

      setUser(data.user);
      setForm({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        address: data.user.address || "",
      });
      setIsEditing(false);
      alert("บันทึกสำเร็จ");
    } catch {
      setProfileError("ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!user) return;
    setIsEditing(false);
    setProfileError("");
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
    });
  };

  // ─────────────────────────────────────────────
  // Handlers – Password
  // ─────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setIsChangingPassword(true);
    try {
      const res = await fetch("http://localhost:5000/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setPasswordError(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }

      setPasswordSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPasswordError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background">

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground">บัญชีของฉัน</h1>
            <p className="mt-2 text-muted-foreground">จัดการข้อมูลส่วนตัวและการตั้งค่าของคุณ</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-4">
            {/* ── Sidebar ── */}
            <aside className="lg:col-span-1">
              {/* Profile Card */}
              <div className="mb-6 rounded-xl border border-border bg-card p-6 text-center">
                <div className="relative mx-auto mb-4 h-24 w-24">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <span className="font-serif text-3xl font-bold">
                      {user.firstName?.charAt(0) || user.username?.charAt(0) || "U"}
                    </span>
                  </div>
                  <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-secondary-foreground transition-colors hover:bg-muted">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              {/* Quick Menu */}
              <div className="space-y-2">
                {/* {menuItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </a>
                ))} */}
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="lg:col-span-3">
              {/* Tabs */}
              <div className="mb-6 flex gap-2 border-b border-border">
                {(["profile", "security"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {tab === "profile" && "ข้อมูลส่วนตัว"}
                    {tab === "security" && "ความปลอดภัย"}
                  </button>
                ))}
              </div>

              {/* ── Tab: Profile ── */}
              {activeTab === "profile" && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">ข้อมูลส่วนตัว</h3>
                    {!isEditing ? (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        แก้ไขข้อมูล
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                          ยกเลิก
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                          <Save className="h-4 w-4" />
                          {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {profileError && (
                    <p className="mb-4 text-sm text-destructive">{profileError}</p>
                  )}

                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* ชื่อ */}
                    <div className="space-y-2">
                      <Label htmlFor="firstName">ชื่อ</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="firstName"
                          value={form.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          disabled={!isEditing || isSaving}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* นามสกุล */}
                    <div className="space-y-2">
                      <Label htmlFor="lastName">นามสกุล</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="lastName"
                          value={form.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          disabled={!isEditing || isSaving}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* อีเมล */}
                    <div className="space-y-2">
                      <Label htmlFor="email">อีเมล</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          disabled={!isEditing || isSaving}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* เบอร์โทร (กรองเฉพาะตัวเลข) */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="phone"
                          inputMode="numeric"
                          value={form.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          disabled={!isEditing || isSaving}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    {/* ที่อยู่ */}
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">ที่อยู่</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          id="address"
                          value={form.address}
                          onChange={(e) => handleChange("address", e.target.value)}
                          disabled={!isEditing || isSaving}
                          className="min-h-[80px] pl-10"
                        />
                      </div>
                    </div>


                  </div>
                </div>
              )}

              {/* ── Tab: Security ── */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  {/* เปลี่ยนรหัสผ่าน */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-semibold text-foreground">เปลี่ยนรหัสผ่าน</h3>

                    {passwordError && (
                      <p className="mb-3 text-sm text-destructive">{passwordError}</p>
                    )}
                    {passwordSuccess && (
                      <p className="mb-3 text-sm text-green-600">{passwordSuccess}</p>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) =>
                            setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) =>
                            setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        className="mt-2"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                      >
                        {isChangingPassword ? "กำลังอัปเดต..." : "อัปเดตรหัสผ่าน"}
                      </Button>
                    </div>
                  </div>


                </div>
              )}
            </div>
          </div>
        </div>
      </main>


    </div>
  );
}