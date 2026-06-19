"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Grid3X3, LayoutGrid } from "lucide-react";

import ProductCard from "@/components/productcard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const categories = [
  { id: "all", name: "ทั้งหมด" },
  { id: "shirt", name: "เสื้อแขนสั้น" },
  { id: "hoodie", name: "ฮู้ด" },
  { id: "jeans", name: "ยีนส์" },
  { id: "short", name: "กางเกงขาสั้น" },
  { id: "long", name: "กางเกงขายาว" },
  { id: "dress", name: "เดรส" },
];

const categoryAliases: Record<string, string[]> = {
  shirt: ["shirt", "tshirt", "เสื้อแขนสั้น"],
  hoodie: ["hoodie", "ฮู้ด"],
  jeans: ["jeans", "ยีนส์"],
  short: ["short", "shorts", "กางเกงขาสั้น"],
  long: ["long", "pants", "กางเกงขายาว"],
  dress: ["dress", "เดรส"],
};

const DEFAULT_MAX_PRICE = 5000;

const priceRanges = [
  { id: "under-500", name: "ต่ำกว่า 500", min: 0, max: 500 },
  { id: "500-1000", name: "500 - 1,000", min: 500, max: 1000 },
  { id: "1000-2000", name: "1,000 - 2,000", min: 1000, max: 2000 },
  { id: "2000-3000", name: "2,000 - 3,000", min: 2000, max: 3000 },
  { id: "over-3000", name: "มากกว่า 3,000", min: 3000, max: 999999 },
];

type ProductApi = {
  product_id: string;
  product_name: string;
  category: string;
  variant_id: string;
  price: number;
  stock: number;
  image_url?: string;
};

export default function ProductPage() {
  const [products, setProducts] = useState<ProductApi[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [gridCols, setGridCols] = useState<3 | 4>(4);

  const [showPriceFilter, setShowPriceFilter] =
    useState(false);

  const [priceRange, setPriceRange] = useState<number[]>([
    0,
    DEFAULT_MAX_PRICE,
  ]);

  useEffect(() => {
    fetch("http://localhost:5000/products")
      .then((res) => res.json())
      .then((data: ProductApi[]) => {
        setProducts(data);
      })
      .catch(console.error);
  }, []);

  const priceLimit = useMemo(() => {
    const maxPrice = products.reduce(
      (max, p) =>
        Math.max(max, Number(p.price) || 0),
      DEFAULT_MAX_PRICE
    );

    return Math.ceil(maxPrice / 500) * 500;
  }, [products]);

  useEffect(() => {
    setPriceRange([0, priceLimit]);
  }, [priceLimit]);

  const filteredProducts = products.filter((p) => {
    const normalizedCategory =
      p.category?.trim().toLowerCase();

    const categoryMatch =
      selectedCategory === "all" ||
      categoryAliases[selectedCategory]?.includes(
        normalizedCategory
      );

    const priceMatch =
      Number(p.price) >= priceRange[0] &&
      Number(p.price) <= priceRange[1];

    return categoryMatch && priceMatch;
  });

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">
      {/* Header */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">
          สินค้าทั้งหมด
        </h1>

        <p className="text-black/70">
          {filteredProducts.length} รายการ
        </p>
      </div>

      {/* Filters */}

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={18} />

          {categories.map((cat) => (
            <Button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(cat.id)
              }
              variant={
                selectedCategory === cat.id
                  ? "default"
                  : "outline"
              }
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              setShowPriceFilter(!showPriceFilter)
            }
          >
            กรองราคา
          </Button>

          <Button
            variant={
              gridCols === 3
                ? "default"
                : "outline"
            }
            size="icon"
            onClick={() => setGridCols(3)}
          >
            <Grid3X3 size={18} />
          </Button>

          <Button
            variant={
              gridCols === 4
                ? "default"
                : "outline"
            }
            size="icon"
            onClick={() => setGridCols(4)}
          >
            <LayoutGrid size={18} />
          </Button>
        </div>

        {/* Price Filter */}

        {showPriceFilter && (
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="mb-4 flex justify-between">
              <span>
                ฿{priceRange[0].toLocaleString()}
              </span>

              <span>
                ฿{priceRange[1].toLocaleString()}
              </span>
            </div>

            <Slider
              value={priceRange}
              onValueChange={(value) =>
                setPriceRange(value)
              }
              min={0}
              max={priceLimit}
              step={100}
              className="w-full"
            />

            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>฿0</span>
              <span>
                ฿{priceLimit.toLocaleString()}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {priceRanges.map((range) => (
                <Button
                  key={range.id}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPriceRange([
                      range.min,
                      Math.min(
                        range.max,
                        priceLimit
                      ),
                    ])
                  }
                >
                  {range.name}
                </Button>
              ))}
            </div>

            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={() =>
                  setPriceRange([
                    0,
                    priceLimit,
                  ])
                }
              >
                รีเซ็ต
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Product Grid */}

      <div
        className={`grid gap-6 ${
          gridCols === 3
            ? "grid-cols-2 lg:grid-cols-3"
            : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {filteredProducts.map((p) => (
          <ProductCard
            key={p.variant_id}
            product={{
              id: Number(
                p.variant_id.replace(/\D/g, "")
              ),
              variant_id: p.variant_id,
              name: p.product_name,
              price: Number(p.price),
              stock: Number(p.stock),
              category: p.category,
              image:
                p.image_url ||
                "https://placehold.co/600x800",
            }}
          />
        ))}
      </div>
    </div>
  );
}