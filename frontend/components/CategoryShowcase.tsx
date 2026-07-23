"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CategoryItem = {
  category: string;
  category_th: string;
  sub_categories: { sub_category: string; sub_category_th: string }[];
};

export default function CategoryShowcase() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/products/categories")
      .then((res) => res.json())
      .then((data: CategoryItem[]) => setCategories(data))
      .catch(console.error);
  }, []);

  if (categories.length === 0) return null;

  const tileGradients = [
    "linear-gradient(160deg,#a88a72,#8b6f5a)",
    "linear-gradient(160deg,#c2a894,#b89f8d)",
    "linear-gradient(160deg,#9a7d64,#7d6450)",
    "linear-gradient(160deg,#b89f8d,#a3876f)",
  ];

  // Add an entry once the matching file exists at frontend/public/images/categories/.
  // Filenames must exactly match the `category` slug from GET /products/categories.
  // Categories with no entry here fall back to tileGradients below (no broken-image risk).
  const categoryImages: Record<string, string> = {
    // shirt: "/images/categories/shirt.jpg",
    // tshirt: "/images/categories/tshirt.jpg",
    // pants: "/images/categories/pants.jpg",
    // jacket: "/images/categories/jacket.jpg",
  };

  return (
    <section className="bg-[#ece2d6] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-2xl font-semibold text-[#3d3025] sm:text-3xl">
          หมวดหมู่สินค้า
        </h2>
        <p className="mt-1 font-mono text-xs text-[#9a8a7a]">Shop by category</p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.category}
              href={`/products?category=${encodeURIComponent(cat.category)}`}
              className="group relative block aspect-[3/4] overflow-hidden rounded-[10px] shadow-[0_2px_10px_rgba(139,94,60,0.1)] transition hover:shadow-[0_8px_20px_rgba(139,94,60,0.2)]"
              style={
                categoryImages[cat.category]
                  ? {
                      backgroundImage: `linear-gradient(160deg, rgba(139,111,90,.35), rgba(61,48,37,.55)), url('${categoryImages[cat.category]}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { background: tileGradients[i % tileGradients.length] }
              }
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 1px, transparent 1px 14px)",
                }}
              />

              <span className="font-serif absolute left-[18px] top-4 text-3xl font-semibold text-white/55">
                {cat.category_th.charAt(0)}
              </span>

              <div className="absolute bottom-0 left-0 right-0 flex flex-col p-[18px]">
                <span className="font-serif text-xl font-semibold text-white">
                  {cat.category_th}
                </span>
                <span className="font-mono mt-0.5 text-[11px] text-white/80">
                  {cat.category}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
