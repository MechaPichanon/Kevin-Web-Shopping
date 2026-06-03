"use client";

import { useSearchParams } from "next/navigation";
import { products } from "@/lib/mockdata";
import ProductCard from "@/components/productcard";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") || "";

  const filteredProducts = products.filter((p) => {
    const keyword = search.toLowerCase();

    return (
      p.name.toLowerCase().includes(keyword) ||
      p.category.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Search results</h1>
      <p className="mb-6 text-black/70">
        {filteredProducts.length} results for "{search}"
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
