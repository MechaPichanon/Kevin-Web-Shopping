"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  username: string;
  email: string;
};

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        return;
      }

      const res = await fetch("http://localhost:5000/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!data.error) {
        setUser(data);
      }
    };

    fetchUser();

    
    window.addEventListener("login", fetchUser);

    return () => {
      window.removeEventListener("login", fetchUser);
    };
  }, []);


  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 32px",
        background: "#8b6f5a",
        color: "white",
      }}
    >
      {/* ซ้าย */}
      <div style={{ fontWeight: "bold" }}>LOGO</div>

      {/* ขวา */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <Link href="/">Language</Link>
        <Link href="/">Currency</Link>

        {!user ? (
          <>
            <Link href="/login">Login</Link>
            <Link href="/signup">Sign up</Link>
          </>
        ) : (
          <>
            <Link
              href="/profile"
              style={{
                color: "white",
                textDecoration: "none",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
               {user.username}
            </Link>

            <button
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "1px solid white",
                color: "white",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </>

        )}
      </div>
    </nav>
  );
}
