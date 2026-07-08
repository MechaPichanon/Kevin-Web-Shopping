"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Grid3X3, LayoutGrid } from "lucide-react";
import ProductCard from "@/components/productcard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const DEFAULT_MAX_PRICE = 5000;

const priceRanges = [
  { id: "under-500",  name: "ต่ำกว่า 500",      min: 0,    max: 500    },
  { id: "500-1000",   name: "500 - 1,000",       min: 500,  max: 1000   },
  { id: "1000-2000",  name: "1,000 - 2,000",     min: 1000, max: 2000   },
  { id: "2000-3000",  name: "2,000 - 3,000",     min: 2000, max: 3000   },
  { id: "over-3000",  name: "มากกว่า 3,000",     min: 3000, max: 999999 },
];

type SubCategoryItem = {
  sub_category: string;
  sub_category_th: string;
};

type CategoryItem = {
  category: string;
  category_th: string;
  sub_categories: SubCategoryItem[];
};

type ProductApi = {
  product_id: string;
  product_name: string;
  category: string;
  sub_category?: string;
  variant_id: string;
  price: number;
  stock: number;
  image_url?: string;
};

function SearchResults() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") || "";

  const [products, setProducts]               = useState<ProductApi[]>([]);
  const [categories, setCategories]           = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory]       = useState("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [priceRange, setPriceRange]           = useState<number[]>([0, DEFAULT_MAX_PRICE]);
  const [gridCols, setGridCols]               = useState<3 | 4>(4);

  // Fetch category list once for display names / Thai translations
  useEffect(() => {
    fetch("http://localhost:5000/products/categories")
      .then((res) => res.json())
      .then((data: CategoryItem[]) => setCategories(data))
      .catch(console.error);
  }, []);

  // Fetch search results whenever the query changes; reset filters
  useEffect(() => {
    if (!search.trim()) {
      setProducts([]);
      return;
    }
    setSelectedCategory("all");
    setSelectedSubCategory("all");
    fetch(`http://localhost:5000/products/search?q=${encodeURIComponent(search)}`)
      .then((res) => res.json())
      .then(setProducts)
      .catch(console.error);
  }, [search]);

  // Derive price ceiling from results
  const priceLimit = useMemo(() => {
    const maxPrice = products.reduce(
      (max, p) => Math.max(max, Number(p.price) || 0),
      DEFAULT_MAX_PRICE
    );
    return Math.ceil(maxPrice / 500) * 500;
  }, [products]);

  useEffect(() => {
    setPriceRange([0, priceLimit]);
  }, [priceLimit]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubCategory("all");
  };

  const activeCategoryData = categories.find((c) => c.category === selectedCategory);

  // Only show categories / sub-categories that exist in the current results
  const visibleCategories = categories.filter((cat) =>
    products.some((p) => p.category === cat.category)
  );
  const visibleSubCategories = activeCategoryData?.sub_categories.filter((sub) =>
    products.some((p) => p.sub_category === sub.sub_category)
  ) ?? [];

  // Client-side narrow by category + sub-category + price
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
    if (selectedSubCategory !== "all" && p.sub_category !== selectedSubCategory) return false;
    const price = Number(p.price);
    return price >= priceRange[0] && price <= priceRange[1];
  });

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">Search Results</h1>
        <p className="text-black/70">
          {filteredProducts.length} results for &quot;{search}&quot;
        </p>
      </div>

      {/* Filters — only rendered when there are results */}
      {products.length > 0 && (
        <div className="mb-6 flex flex-col gap-4">
          {/* Category row */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={18} />
            <Button
              onClick={() => handleCategorySelect("all")}
              variant={selectedCategory === "all" ? "default" : "outline"}
            >
              ทั้งหมด
            </Button>
            {visibleCategories.map((cat) => (
              <Button
                key={cat.category}
                onClick={() => handleCategorySelect(cat.category)}
                variant={selectedCategory === cat.category ? "default" : "outline"}
              >
                {cat.category_th}
              </Button>
            ))}
          </div>

          {/* Sub-category row */}
          {selectedCategory !== "all" && visibleSubCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-7">
              <Button
                onClick={() => setSelectedSubCategory("all")}
                variant={selectedSubCategory === "all" ? "default" : "outline"}
                size="sm"
              >
                ทั้งหมด
              </Button>
              {visibleSubCategories.map((sub) => (
                <Button
                  key={sub.sub_category}
                  onClick={() => setSelectedSubCategory(sub.sub_category)}
                  variant={selectedSubCategory === sub.sub_category ? "default" : "outline"}
                  size="sm"
                >
                  {sub.sub_category_th}
                </Button>
              ))}
            </div>
          )}

          {/* Price filter toggle + grid toggle */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowPriceFilter(!showPriceFilter)}>
              กรองราคา
            </Button>
            <Button
              variant={gridCols === 3 ? "default" : "outline"}
              size="icon"
              onClick={() => setGridCols(3)}
            >
              <Grid3X3 size={18} />
            </Button>
            <Button
              variant={gridCols === 4 ? "default" : "outline"}
              size="icon"
              onClick={() => setGridCols(4)}
            >
              <LayoutGrid size={18} />
            </Button>
          </div>

          {/* Price slider panel */}
          {showPriceFilter && (
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="mb-4 flex justify-between">
                <span>฿{priceRange[0].toLocaleString()}</span>
                <span>฿{priceRange[1].toLocaleString()}</span>
              </div>
              <Slider
                value={priceRange}
                onValueChange={(value) => setPriceRange(value)}
                min={0}
                max={priceLimit}
                step={100}
                className="w-full"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>฿0</span>
                <span>฿{priceLimit.toLocaleString()}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {priceRanges.map((range) => (
                  <Button
                    key={range.id}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPriceRange([range.min, Math.min(range.max, priceLimit)])
                    }
                  >
                    {range.name}
                  </Button>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="ghost" onClick={() => setPriceRange([0, priceLimit])}>
                  รีเซ็ต
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Grid */}
      <div
        className={`grid gap-6 ${
          gridCols === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
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
              image: p.image_url || "https://placehold.co/600x800?text=No+Image",
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
