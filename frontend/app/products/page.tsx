"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Filter, Grid3X3, LayoutGrid } from "lucide-react";

import ProductCard from "@/components/productcard";
import { Slider } from "@/components/ui/slider";

const DEFAULT_MAX_PRICE = 5000;

const priceRanges = [
  { id: "under-500", name: "ต่ำกว่า 500 · Under ฿500", min: 0, max: 500 },
  { id: "500-1000", name: "฿500 – 1,000", min: 500, max: 1000 },
  { id: "1000-2000", name: "฿1,000 – 2,000", min: 1000, max: 2000 },
  { id: "2000-3000", name: "฿2,000 – 3,000", min: 2000, max: 3000 },
  { id: "over-3000", name: "มากกว่า 3,000 · & up", min: 3000, max: 999999 },
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
  product_name_th?: string;
  category: string;
  category_th?: string;
  sub_category?: string;
  variant_id: string;
  price: number;
  stock: number;
  image_url?: string;
};

type ToastItem = {
  name: string;
  name_en?: string;
  price: number;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(price);

export default function ProductPage() {
  return (
    <Suspense fallback={null}>
      <ProductPageContent />
    </Suspense>
  );
}

function ProductPageContent() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<ProductApi[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get("category") || "all"
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");

  const [gridCols, setGridCols] = useState<3 | 4>(4);

  const [priceRange, setPriceRange] = useState<number[]>([
    0,
    DEFAULT_MAX_PRICE,
  ]);

  const [toast, setToast] = useState<ToastItem | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (item: ToastItem) => {
    setToast(item);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Fetch categories from DB on mount
  useEffect(() => {
    fetch("http://localhost:5000/products/categories")
      .then((res) => res.json())
      .then((data: CategoryItem[]) => setCategories(data))
      .catch(console.error);
  }, []);

  // Fetch products whenever category or sub-category filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedSubCategory !== "all") params.set("sub_category", selectedSubCategory);
    const qs = params.toString();

    fetch(`http://localhost:5000/products/filter${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((data: ProductApi[]) => setProducts(data))
      .catch(console.error);
  }, [selectedCategory, selectedSubCategory]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubCategory("all");
  };

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

  // Price filter stays client-side (slider UX)
  const filteredProducts = products.filter((p) =>
    Number(p.price) >= priceRange[0] &&
    Number(p.price) <= priceRange[1]
  );

  const categoryButtonClass = (active: boolean) =>
    `flex w-full flex-col items-start gap-0.5 rounded-lg px-3.5 py-2 text-left transition-colors ${
      active
        ? "bg-[#8b5e3c] text-white hover:bg-[#7a4f30]"
        : "bg-transparent text-black hover:bg-black/5"
    }`;

  const subButtonClass = (active: boolean) =>
    `flex w-full items-baseline gap-1.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
      active
        ? "bg-[#8b5e3c]/10 font-semibold text-[#8b5e3c]"
        : "text-black/60 hover:bg-black/5"
    }`;

  const presetButtonClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-colors ${
      active
        ? "border-[#8b5e3c] bg-[#8b5e3c] text-white hover:bg-[#7a4f30]"
        : "border-black/25 bg-transparent text-black hover:bg-black/5"
    }`;

  const densityButtonClass = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
      active
        ? "border-[#8b5e3c] bg-[#8b5e3c] text-white hover:bg-[#7a4f30]"
        : "border-black/20 bg-[#ece2d6] text-black/60 hover:bg-black/5"
    }`;

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-3xl font-bold text-black">สินค้าทั้งหมด</h1>
        <div className="text-sm text-black/55">All Products</div>
      </div>

      <p className="mb-6 text-sm text-black/70">
        พบสินค้า {filteredProducts.length} รายการ · {filteredProducts.length} items
      </p>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full flex-none rounded-2xl border border-black/10 bg-[#ece2d6] p-5 shadow-sm lg:sticky lg:top-24 lg:w-64">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={16} />
            <span className="text-sm font-semibold">ตัวกรอง</span>
            <span className="text-xs text-black/45">Filters</span>
          </div>

          <div className="mb-2.5 flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/50">
            หมวดหมู่ <span className="font-medium">Category</span>
          </div>

          <div className="mb-2 flex flex-col gap-1">
            <button
              onClick={() => handleCategorySelect("all")}
              className={categoryButtonClass(selectedCategory === "all")}
            >
              <span className="text-sm">ทั้งหมด</span>
              <span
                className={`text-[11px] ${
                  selectedCategory === "all" ? "text-white/65" : "text-black/45"
                }`}
              >
                All
              </span>
            </button>

            {categories.map((cat) => {
              const active = selectedCategory === cat.category;
              const showSubs = active && cat.sub_categories.length > 0;
              return (
                <Fragment key={cat.category}>
                  <button
                    onClick={() => handleCategorySelect(cat.category)}
                    className={categoryButtonClass(active)}
                  >
                    <span className="text-sm">{cat.category_th}</span>
                    <span
                      className={`text-[11px] ${
                        active ? "text-white/65" : "text-black/45"
                      }`}
                    >
                      {cat.category}
                    </span>
                  </button>

                  {showSubs && (
                    <div className="mb-2 ml-3 flex flex-col gap-1 border-l-2 border-black/10 pl-3">
                      <button
                        onClick={() => setSelectedSubCategory("all")}
                        className={subButtonClass(selectedSubCategory === "all")}
                      >
                        <span className="text-[13px]">ทั้งหมด</span>
                        <span className="text-[11px] text-black/40">All</span>
                      </button>

                      {cat.sub_categories.map((sub) => {
                        const subActive = selectedSubCategory === sub.sub_category;
                        return (
                          <button
                            key={sub.sub_category}
                            onClick={() => setSelectedSubCategory(sub.sub_category)}
                            className={subButtonClass(subActive)}
                          >
                            <span className="text-[13px]">{sub.sub_category_th}</span>
                            <span className="text-[11px] text-black/40">{sub.sub_category}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          <div className="my-5 h-px bg-black/10" />

          <div className="mb-3.5 flex items-baseline justify-between">
            <span className="flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/50">
              ช่วงราคา <span className="font-medium">Price</span>
            </span>
            <button
              onClick={() => setPriceRange([0, priceLimit])}
              className="text-xs font-medium text-black/50 underline"
            >
              ล้าง / Clear
            </button>
          </div>

          <div className="mb-2.5 text-sm font-semibold">
            {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
          </div>

          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange(value)}
            min={0}
            max={priceLimit}
            step={100}
            className="mb-1"
          />

          <div className="mb-3 flex justify-between text-xs text-black/45">
            <span>฿0</span>
            <span>฿{priceLimit.toLocaleString()}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {priceRanges.map((range) => {
              const active =
                priceRange[0] === range.min &&
                priceRange[1] === Math.min(range.max, priceLimit);
              return (
                <button
                  key={range.id}
                  onClick={() =>
                    setPriceRange([range.min, Math.min(range.max, priceLimit)])
                  }
                  className={presetButtonClass(active)}
                >
                  {range.name}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="mr-auto text-sm text-black/60">
              {filteredProducts.length} รายการ
            </span>

            <button
              title="3 คอลัมน์ / 3 columns"
              onClick={() => setGridCols(3)}
              className={densityButtonClass(gridCols === 3)}
            >
              <Grid3X3 size={17} />
            </button>

            <button
              title="4 คอลัมน์ / 4 columns"
              onClick={() => setGridCols(4)}
              className={densityButtonClass(gridCols === 4)}
            >
              <LayoutGrid size={17} />
            </button>
          </div>

          {filteredProducts.length > 0 ? (
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
                  onAdded={showToast}
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
          ) : (
            <div className="py-16 text-center text-black/60">
              <p className="mb-1.5 text-base font-semibold">
                ไม่พบสินค้า · No products found
              </p>
              <p className="text-sm">
                ลองปรับตัวกรองหรือช่วงราคาใหม่ / Try adjusting your filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div
        className={`fixed top-6 right-6 z-50 flex w-80 max-w-[calc(100vw-3rem)] items-center gap-3 rounded-2xl border border-black/10 bg-white p-3.5 text-black shadow-2xl transition-all duration-300 ${
          toast
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[calc(100%+2rem)] opacity-0"
        }`}
      >
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-emerald-50">
          <CheckCircle2 size={20} className="text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[11px] font-semibold text-emerald-600">
            เพิ่มลงตะกร้าแล้ว · Added to cart
          </div>
          <div className="truncate text-sm font-semibold">{toast?.name}</div>
          {toast?.name_en && (
            <div className="truncate text-xs text-black/50">{toast.name_en}</div>
          )}
          <div className="text-xs text-black/50">
            {toast ? formatPrice(toast.price) : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
