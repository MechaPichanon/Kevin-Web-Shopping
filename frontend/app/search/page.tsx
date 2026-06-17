"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/productcard";

type ProductApi = {
  product_id: string;
  product_name: string;
  category: string;
  variant_id: string;
  price: number;
  stock: number;
  image_url?: string;
};

function SearchResults() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") || "";

  const [products, setProducts] = useState<ProductApi[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/products")
      .then((res) => res.json())
      .then(setProducts)
      .catch(console.error);
  }, []);

  const filteredProducts = products.filter((p) => {
    const keyword = search.toLowerCase();

    return (
      p.product_name.toLowerCase().includes(keyword) ||
      p.category.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">
      <h1 className="mb-2 text-3xl font-bold text-black">
        Search Results
      </h1>

      <p className="mb-6 text-black/70">
        {filteredProducts.length} results for &quot;{search}&quot;
      </p>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((p) => (
          <ProductCard
            key={p.variant_id}
            product={{
              id: Number(
                p.variant_id.replace(/\D/g, "") || p.product_id.replace(/\D/g, "") || "0"
              ),
              variant_id: p.variant_id,
              name: p.product_name,
              price: Number(p.price),
              stock: Number(p.stock),
              category: p.category,
              image:
                p.image_url ||
                "https://placehold.co/600x800?text=No+Image",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}
