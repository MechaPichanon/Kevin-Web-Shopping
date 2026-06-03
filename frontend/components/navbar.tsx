"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { products } from "@/lib/mockdata";
type User = {
  id: number;
  username: string;
  email: string;
};

export default function Navbar() {

  const [search, setSearch] = useState("");
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
    <nav className="sticky top-0 z-50 w-full bg-[#8b6f5a] shadow-lg transition-all duration-300">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* 1. Logo */}
          <div
            className="flex-shrink-0 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 duration-300"
            onClick={() => router.push("/")}
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#8b6f5a] font-bold text-2xl shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="font-extrabold text-white text-xl tracking-tight hidden md:block">
              Kevin<span className="text-amber-100">Store</span>
            </span>
          </div>

          {/* 2. Main Navigation Links */}
          <div className="hidden lg:flex items-center space-x-6 text-sm font-medium text-white/95">
            <Link
              href="/"
              className="hover:text-amber-200 transition-colors duration-200"
            >
              Home
            </Link>
            <Link
              href="/products"
              className="hover:text-amber-200 transition-colors duration-200"
            >
              Products
            </Link>
            <Link
              href="/chat"
              className="hover:text-amber-200 transition-colors duration-200 whitespace-nowrap"
            >
              Chat with Bot
            </Link>
            {/* Keeping old references as well */}
            <div className="h-4 w-px bg-white/30 hidden xl:block"></div>
            {/* <Link
              href="/"
              className="hidden xl:block hover:text-amber-200 transition-colors duration-200"
            >
              Language
            </Link>
            <Link
              href="/"
              className="hidden xl:block hover:text-amber-200 transition-colors duration-200"
            >
              Currency
            </Link> */}
          </div>

          {/* 3. Search Bar */}
          <div className="flex-1 max-w-xl hidden sm:flex items-center relative group">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  router.push(`/search?q=${encodeURIComponent(search.trim())}`);
                }
              }}
              placeholder="Search products..."
              className="w-full pl-5 pr-14 py-2.5 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all duration-300 shadow-inner"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {/* Camera Button */}
              <button
                className="text-white hover:text-amber-200 p-1.5 transition-colors"
                title="Search by image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              {/* Search Icon */}
              <button
                onClick={() => {
                  if (search.trim()) {
                    router.push(`/search?q=${encodeURIComponent(search.trim())}`);
                  }
                }} className="bg-white text-[#8b6f5a] hover:bg-gray-100 p-1.5 rounded-full transition-colors shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 4. Right side: Cart & Auth */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Cart Button */}
            <button className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {/* <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#8b6f5a] transform translate-x-1/4 -translate-y-1/4 bg-amber-200 rounded-full">
                3
              </span> */}
            </button>

            <div className="h-6 w-px bg-white/30 hidden sm:block"></div>

            {!user ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-medium text-white hover:text-amber-200 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-5 py-2 text-sm font-semibold text-[#8b6f5a] bg-white hover:bg-gray-100 rounded-full shadow-md transition-transform transform hover:-translate-y-0.5 whitespace-nowrap"
                >
                  Sign up
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 text-sm font-medium text-white hover:text-amber-200 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white border border-white/30 group-hover:bg-white/30 group-hover:border-white/50 transition-all">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <span className="hidden sm:block truncate max-w-[100px]">
                    {user.username}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-semibold text-white bg-transparent border border-white/50 rounded-full hover:bg-white/10 hover:border-white transition-all whitespace-nowrap shadow-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
