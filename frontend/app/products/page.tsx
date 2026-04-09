"use client";

import { useState } from "react";
import ProductCard from "@/components/productcard";
import { products } from "@/lib/mockdata";

const categories = [
  { id: "all", name: "ทั้งหมด" },
  { id: "tshirt", name: "เสื้อแขนสั้น" },
  { id: "hoodie", name: "ฮู้ด" },
  { id: "jeans", name: "ยีนส์" },
  { id: "short", name: "กางเกงขาสั้น" },
  { id: "long", name: "กางเกงขายาว" },
  { id: "dress", name: "เดรส" },
];

export default function ProductPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);

  // ✅ filter รวม (category + price)
  const finalProducts = products.filter((p) => {
    let categoryMatch = true;

    if (selectedCategory === "tshirt") categoryMatch = p.category === "เสื้อแขนสั้น";
    else if (selectedCategory === "hoodie") categoryMatch = p.category === "ฮู้ด";
    else if (selectedCategory === "jeans") categoryMatch = p.category === "ยีนส์";
    else if (selectedCategory === "short") categoryMatch = p.category === "กางเกงขาสั้น";
    else if (selectedCategory === "long") categoryMatch = p.category === "กางเกงขายาว";
    else if (selectedCategory === "dress") categoryMatch = p.category === "เดรส";

    const priceMatch =
      p.price >= priceRange[0] && p.price <= priceRange[1];

    return categoryMatch && priceMatch;
  });

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">สินค้า</h1>
        <p className="text-black/70">{finalProducts.length} รายการ</p>
      </div>

      {/* FILTER BAR */}
      <div className="mb-6 flex flex-col gap-4">

        {/* CATEGORY */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                cursor-pointer px-4 py-2 rounded-lg text-sm transition
                ${selectedCategory === cat.id
                  ? "bg-[#8b5e3c] text-white"
                  : "bg-white text-black hover:bg-gray-200"}
              `}
            >
              {cat.name}
            </div>
          ))}
        </div>

        {/* PRICE RANGE */}
        <div className="bg-white p-4 rounded-lg">
          <div className="flex justify-between text-sm text-black mb-2">
            <span>฿{priceRange[0]}</span>
            <span>฿{priceRange[1]}</span>
          </div>

          <input
            type="range"
            min={0}
            max={2000}
            value={priceRange[1]}
            onChange={(e) =>
              setPriceRange([priceRange[0], Number(e.target.value)])
            }
            className="w-full"
          />

          <div className="flex gap-2 mt-3">
            <input
              type="number"
              value={priceRange[0]}
              onChange={(e) =>
                setPriceRange([Number(e.target.value), priceRange[1]])
              }
              className="w-full border p-1 text-black"
            />
            <input
              type="number"
              value={priceRange[1]}
              onChange={(e) =>
                setPriceRange([priceRange[0], Number(e.target.value)])
              }
              className="w-full border p-1 text-black"
            />
          </div>
        </div>
      </div>

      {/* PRODUCT GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {finalProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}