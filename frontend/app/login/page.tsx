"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbarsub from "@/components/navbarsub";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const res = await fetch("http://localhost:5000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);

    //  แจ้งทุก component ว่า login ระบบจะได้ไม่เอ๋อ ตอนแรกมีปัญหา Login เสร็จไม่ขึ้นปุ่ม logout
    window.dispatchEvent(new Event("login"));

    router.push("/profile");


  };

  return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Login</h1>

          <div style={styles.form}>
            <div>
              <label style={styles.label}>Email</label>
              <input
                name="email"
                type="email"
                placeholder="Enter your email"
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Password</label>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                onChange={handleChange}
                style={styles.input}
              />
            </div>

            <button onClick={handleSubmit} style={styles.button}>
              Login
            </button>
          </div>
        </div>
      </div>
  );
}


const styles: any = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#b89f8d",
  },
  card: {
    background: "#fff",
    padding: "40px",
    borderRadius: "12px",
    width: "380px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  },
  title: {
    textAlign: "center",
    marginBottom: "25px",
    color: "#5b3a29",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  label: {
    fontSize: "14px",
    marginBottom: "6px",
    display: "block",
    color: "#5b3a29",
    fontWeight: "600",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    marginTop: "10px",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#8b5e3c",
    color: "white",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },
};
