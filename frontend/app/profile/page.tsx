"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

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

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
};

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProfileForm>(emptyForm);

  // 🔥 โหลดข้อมูลจาก backend
  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    fetch("http://localhost:5000/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/login");
        } else {
          setError("");
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
      .catch(() => {
        setError("Unable to load profile");
      });
  }, [router]);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    const nextValue = field === "phone" ? value.replace(/\D/g, "") : value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSave = async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setIsSaving(true);
    setError("");

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
        setError(data.error || "Save failed");
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
    } catch {
      setError("Unable to save profile");
      return;
    } finally {
      setIsSaving(false);
    }
    alert("บันทึกสำเร็จ");
  };

  if (!user) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ minHeight: "100vh", background: "#b89f8d", padding: "40px" }}>
      <div
        style={{
          maxWidth: "700px",
          margin: "auto",
          background: "#fff",
          color: "#111827",
          padding: "30px",
          borderRadius: "10px",
        }}
      >
        <h1 style={{ marginBottom: 20 }}>บัญชีของฉัน</h1>

        {error ? (
          <p style={{ marginBottom: 16, color: "#b91c1c" }}>{error}</p>
        ) : null}

        {/* BUTTON */}
        <div style={{ marginBottom: 20 }}>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              style={btnOutline}
            >
              แก้ไขข้อมูล
            </button>
          ) : (
            <>
              <button onClick={handleSave} style={btnPrimary} disabled={isSaving}>
                บันทึก
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError("");
                  setForm({
                    firstName: user.firstName || "",
                    lastName: user.lastName || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    address: user.address || "",
                  });
                }}
                style={{ ...btnOutline, marginLeft: 10 }}
                disabled={isSaving}
              >
                ยกเลิก
              </button>
            </>
          )}
        </div>

        {/* FORM */}
        <div style={grid}>
          <InputField
            label="ชื่อ"
            value={form.firstName}
            onChange={(v: string) => handleChange("firstName", v)}
            disabled={!isEditing || isSaving}
          />

          <InputField
            label="นามสกุล"
            value={form.lastName}
            onChange={(v: string) => handleChange("lastName", v)}
            disabled={!isEditing || isSaving}
          />

          <InputField
            label="Email"
            value={form.email}
            onChange={(v: string) => handleChange("email", v)}
            disabled={!isEditing || isSaving}
          />

          <InputField
            label="เบอร์โทร"
            value={form.phone}
            onChange={(v: string) => handleChange("phone", v)}
            disabled={!isEditing || isSaving}
            inputMode="numeric"
          />

          <div style={{ gridColumn: "1 / -1" }}>
            <label>ที่อยู่</label>
            <textarea
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              disabled={!isEditing || isSaving}
              style={textarea}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* 🔥 reusable input */
function InputField({
  label,
  value,
  onChange,
  disabled,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <div style={{ color: "#111827" }}>
      <label style={{ color: "#111827", fontWeight: 500 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        style={input}
      />
    </div>
  );
}

/* 🎨 styles */
const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "15px",
};

const input = {
  width: "100%",
  padding: "8px",
  marginTop: "5px",
  border: "1px solid #ccc",
  borderRadius: "5px",
  color: "#111827",
  background: "#ffffff",
};

const textarea = {
  width: "100%",
  padding: "8px",
  marginTop: "5px",
  border: "1px solid #ccc",
  borderRadius: "5px",
  minHeight: "80px",
  color: "#111827",
  background: "#ffffff",
};

const btnPrimary = {
  padding: "8px 15px",
  background: "#8b5e3c",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};

const btnOutline = {
  padding: "8px 15px",
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: "5px",
  cursor: "pointer",
};
