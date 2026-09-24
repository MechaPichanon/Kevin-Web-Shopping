"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import ImageSearchButton from "./ImageSearchButton";
import { useWishlist } from "@/lib/wishlist-context";
import { useLang } from "@/lib/language-context";
import { API_BASE } from "@/lib/api";

type User = {
  id: number;
  username: string;
  email: string;
  role?: string;
};

type CartItem = {
  quantity: number;
};

export default function Navbar() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const { totalItems: wishlistCount } = useWishlist();
  const { lang, setLang, t } = useLang();

  const fetchCartCount = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/cart/${userId}`);
      const data = await res.json();
      const total = data.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
      setCartCount(total);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setUser(null); setCartCount(0); return; }

      try {
        const storedUser = localStorage.getItem("user");
        let storedRole: string | undefined;
        if (storedUser) {
          try { storedRole = JSON.parse(storedUser)?.role; } catch { storedRole = undefined; }
        }

        const res = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.error) {
          setUser({ ...data, role: data.role ?? storedRole });
          fetchCartCount(data.id);
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchUser();
    window.addEventListener("login", fetchUser);
    window.addEventListener("cartUpdated", fetchUser);
    return () => {
      window.removeEventListener("login", fetchUser);
      window.removeEventListener("cartUpdated", fetchUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCartCount(0);
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#faf7f2] border-b border-[#e0d5c8] shadow-sm transition-all duration-300">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logo */}
          <div
            className="flex-shrink-0 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 duration-300"
            onClick={() => router.push("/")}
          >
            <div className="w-10 h-10 rounded-xl bg-[#8b5e3c] flex items-center justify-center text-white font-bold text-2xl shadow-sm">
              🛍️
            </div>
            <span className="font-extrabold text-[#8b5e3c] text-xl tracking-tight hidden md:block">
              Kevin<span className="text-[#b89f8d]">Store</span>
            </span>
          </div>

          {/* Menu */}
          <div className="hidden lg:flex items-center space-x-6 text-sm font-medium text-[#5a4a3d]">
            <Link href="/">{t("nav.home")}</Link>
            <Link href="/products">{t("nav.products")}</Link>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl hidden sm:flex items-center relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  router.push(`/search?q=${encodeURIComponent(search.trim())}`);
                }
              }}
              placeholder={t("nav.searchPlaceholder")}
              className="w-full pl-5 pr-14 py-2.5 rounded-full bg-white border border-[#e0d5c8] text-[#3d3025] placeholder-[#9a8a7a]"
            />
            <button
              onClick={() => { if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`); }}
              className="absolute right-2 bg-[#8b5e3c] text-white hover:bg-[#7a5233] p-2 rounded-full"
            >
              🔍
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center space-x-3 sm:space-x-5">

            {/* Language toggle */}
            <div
              className="flex items-center rounded-full border border-[#e0d5c8] bg-white p-0.5 text-xs font-semibold"
              role="group"
              aria-label={t("nav.langToggle")}
            >
              {(["th", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors ${
                    lang === code
                      ? "bg-[#8b5e3c] text-white"
                      : "text-[#9a8a7a] hover:text-[#5a4a3d]"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <ImageSearchButton />

            {/* Wishlist */}
            <Link href="/wishlist">
              <button className="relative p-2 text-[#8b6f5a] hover:bg-[#ece2d6] rounded-full transition-colors">
                <Heart className="h-6 w-6" />
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-[#8b5e3c] rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </button>
            </Link>

            {/* Cart */}
            <Link href="/cart">
              <button className="relative p-2 text-[#8b6f5a] hover:bg-[#ece2d6] rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-[#8b5e3c] rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            </Link>

            <div className="h-6 w-px bg-[#e0d5c8] hidden sm:block"></div>

            {!user ? (
              <div className="flex items-center space-x-2">
                <Link href="/login" className="px-3 py-2 text-sm font-medium text-[#5a4a3d]">{t("nav.login")}</Link>
                <Link href="/signup" className="px-5 py-2 text-sm font-semibold text-white bg-[#8b5e3c] rounded-full">{t("nav.signup")}</Link>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href={
                    user.role === "admin" || user.role === "staff"
                      ? "/admin"
                      : "/profile"
                  }
                  className="text-[#5a4a3d]"
                >
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-semibold text-[#8b5e3c] border border-[#e0d5c8] rounded-full hover:bg-[#ece2d6]"
                >
                  {t("nav.logout")}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}