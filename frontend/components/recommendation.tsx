"use client";

import Link from "next/link";
import { products } from "@/lib/mockdata";
import ProductCard from "@/components/productcard";
import { ArrowRight } from "lucide-react";

export default function Recommendation() {
  return (
    <section className="py-16 sm:py-24 bg-[#b89f8d]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-sm font-medium uppercase tracking-wider text-white">
              สินค้าแนะนำ
            </span>

            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              สินค้ายอดนิยม
            </h2>

            <p className="mt-2 max-w-xl text-gray-200">
              คัดสรรสินค้าคุณภาพที่ลูกค้าชื่นชอบมากที่สุด
            </p>
          </div>

          <Link
            href="/products"
            className="flex items-center gap-2 rounded-lg border border-white px-4 py-2 text-white hover:bg-white hover:text-black transition"
          >
            ดูทั้งหมด
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Product Grid */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

      </div>
    </section>
  );
}