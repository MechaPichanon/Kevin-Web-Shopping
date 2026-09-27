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
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { getToken } from "@/lib/auth";
import { useLang } from "@/lib/language-context";
import { en } from "@/lib/i18n/dictionaries";
import AddressBook from "@/components/AddressBook";
import { Check } from "lucide-react"
import { API_BASE } from "@/lib/api";
// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
// Addresses live in the address book (<AddressBook />, /addresses API),
// not in this form.
type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ProfileUser = ProfileForm & {
  id: number;
  username: string;
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
};

const menuItems = [
  { icon: Package, labelKey: "profile.myOrders" as const, href: "/orders" },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { t, lang } = useLang();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "addresses">("profile");

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

    fetch(`${API_BASE}/profile`, {
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
          });
        }
      })
      .catch(() => setProfileError(t("profile.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (![form.firstName, form.lastName, form.email, form.phone].every((v) => v.trim())) {
      setProfileError(t("profile.requiredFields"));
      return;
    }

    setIsSaving(true);
    setProfileError("");

    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setProfileError(data.error || t("profile.saveFailed"));
        return;
      }

      setUser(data.user);
      setForm({
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
      });
      setIsEditing(false);
      alert(t("profile.saved"));
    } catch {
      setProfileError(t("profile.saveFailed"));
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
    });
  };

  // ─────────────────────────────────────────────
  // Handlers – Password
  // ─────────────────────────────────────────────
  const newPasswordRequirements = [
    { text: t("auth.pwReqMinLength"), met: passwordForm.newPassword.length >= 8 },
    { text: t("auth.pwReqUppercase"), met: /[A-Z]/.test(passwordForm.newPassword) },
    { text: t("auth.pwReqNumber"), met: /[0-9]/.test(passwordForm.newPassword) },
  ];

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t("profile.requiredFields"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("profile.pwMismatch"));
      return;
    }
    if (!newPasswordRequirements.every((req) => req.met)) {
      setPasswordError(t("profile.pwRequirementsNotMet"));
      return;
    }

    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/change-password`, {
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
        setPasswordError(data.error || t("profile.pwChangeFailed"));
        return;
      }

      setPasswordSuccess(t("profile.pwChangeSuccess"));
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPasswordError(t("profile.connectionError"));
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
        <p className="text-muted-foreground">{t("common.loading")}</p>
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
            <h1 className="font-serif text-3xl font-bold text-foreground">{t("profile.accountTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t("profile.accountSubtitle")}</p>
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
                <button
                  type="button"
                  onClick={() => setActiveTab("addresses")}
                  aria-pressed={activeTab === "addresses"}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${activeTab === "addresses"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className={`h-5 w-5 ${activeTab === "addresses" ? "" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${activeTab === "addresses" ? "" : "text-foreground"}`}>{t("profile.addresses")}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${activeTab === "addresses" ? "" : "text-muted-foreground"}`} />
                </button>
                {menuItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{t(item.labelKey)}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
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
                    {tab === "profile" && t("profile.tabProfile")}
                    {tab === "security" && t("profile.tabSecurity")}
                  </button>
                ))}
              </div>

              {/* ── Tab: Profile ── */}
              {activeTab === "profile" && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">{t("profile.personalInfo")}</h3>
                    {!isEditing ? (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        {t("profile.editInfo")}
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                          {t("common.cancel")}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                          <Save className="h-4 w-4" />
                          {isSaving ? t("profile.saving") : t("profile.save")}
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
                      <Label htmlFor="firstName">{t("profile.firstName")}<RequiredMark /></Label>
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
                      <Label htmlFor="lastName">{t("profile.lastName")}<RequiredMark /></Label>
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
                      <Label htmlFor="email">{t("profile.email")}<RequiredMark /></Label>
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
                      <Label htmlFor="phone">{t("profile.phone")}<RequiredMark /></Label>
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
                  </div>
                </div>
              )}

              {/* Address book header (Claude Design "Profile Addresses") */}
              {activeTab === "addresses" && (
                <div className="mb-6">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[3px] text-accent">Account · Addresses</div>
                  <h2 className="font-serif text-3xl font-semibold leading-snug text-foreground">{t("address.bookTitle")}</h2>
                  {lang === "th" && <div className="font-fraunces text-lg italic text-muted-foreground">{en["address.bookSubtitle"]}</div>}
                </div>
              )}

              {/* ── Tab: Addresses ── */}
              {activeTab === "addresses" && <AddressBook />}

              {/* ── Tab: Security ── */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  {/* เปลี่ยนรหัสผ่าน */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-semibold text-foreground">{t("profile.changePassword")}</h3>

                    {passwordError && (
                      <p className="mb-3 text-sm text-destructive">{passwordError}</p>
                    )}
                    {passwordSuccess && (
                      <p className="mb-3 text-sm text-green-600">{passwordSuccess}</p>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">{t("profile.currentPassword")}<RequiredMark /></Label>
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
                        <Label htmlFor="newPassword">{t("profile.newPassword")}<RequiredMark /></Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                          }
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        {newPasswordRequirements.map((req, i) => (
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
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t("profile.confirmNewPassword")}<RequiredMark /></Label>
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
                        {isChangingPassword ? t("profile.updatingPassword") : t("profile.updatePassword")}
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