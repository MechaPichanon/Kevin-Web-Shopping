"use client";
import { useState } from "react";
import Navbarsub from "@/components/navbarsub"
import { useRouter } from "next/navigation";
import { Eye, EyeOff} from "lucide-react"
import { useLang } from "@/lib/language-context";

export default function SignupPage() {
    const router = useRouter();
    const { t } = useLang();
    const [showPassword, setShowPassword] = useState(false)
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        try {
            const res = await fetch("http://localhost:5000/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || t("auth.signupFailed"));
                return;
            }

            alert(t("auth.signupSuccess"));

            // ไปหน้า Login
            router.push("/login");

        } catch (err) {
            console.error(err);
            alert(t("auth.serverError"));
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h1 style={styles.title}>{t("auth.signupTitle")}</h1>

                <div style={styles.form}>
                    <div>

                        <label style={styles.label}>{t("auth.username")}</label>
                        <input
                            name="username"
                            placeholder={t("auth.usernamePlaceholder")}
                            onChange={handleChange}
                            style={styles.input} />
                    </div>

                    <div>
                        <label style={styles.label}>{t("auth.email")}</label>
                        <input
                            name="email"
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
                            onChange={handleChange}
                            style={styles.input} />
                    </div>

                    <div className="relative">
                        <label style={styles.label}>{t("auth.password")}</label>
                        <input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder={t("auth.passwordPlaceholder")}
                            value={form.password}
                            onChange={handleChange}
                            style={styles.input}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 bottom-3 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </button>
                    </div>

                    <button onClick={handleSubmit} style={styles.button}>
                        {t("auth.signupButton")}
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
