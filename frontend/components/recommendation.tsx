"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/productcard";
import { ArrowRight } from "lucide-react";

type BestSellerApi = {
  product_id: string;
  product_name: string;
  product_name_th?: string;
  category: string;
  category_th?: string;
  variant_id?: string;
  price: number;
  stock: number;
  image_url?: string;
};

export default function Recommendation() {
  const [products, setProducts] = useState<BestSellerApi[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/products/best-sellers?limit=4")
      .then((res) => res.json())
      .then((data: BestSellerApi[]) => setProducts(data))
      .catch(console.error);
  }, []);

  return (
    <section className="py-16 sm:py-24 bg-[#ece2d6]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#8b6f5a]">
              สินค้าแนะนำ
            </span>

            <h2 className="font-serif mt-2 text-3xl font-semibold text-[#3d3025] sm:text-4xl">
              สินค้ายอดนิยม
            </h2>

            <p className="mt-2 max-w-xl text-[#8b6f5a]">
              คัดสรรสินค้าคุณภาพที่ลูกค้าชื่นชอบมากที่สุด
            </p>
          </div>

          <Link
            href="/products"
            className="flex items-center gap-2 rounded-lg border border-[#8b5e3c] px-4 py-2 text-[#8b5e3c] transition hover:bg-[#8b5e3c] hover:text-white"
          >
            ดูทั้งหมด
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Product Grid */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.variant_id || p.product_id}
              product={{
                id: Number(p.variant_id?.replace(/\D/g, "") || "0"),
                product_id: p.product_id,
                variant_id: p.variant_id,
                name: p.product_name_th || p.product_name,
                name_en: p.product_name_th ? p.product_name : undefined,
                price: Number(p.price),
                stock: Number(p.stock),
                category: p.category_th || p.category,
                image: p.image_url || "https://placehold.co/600x800",
              }}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
