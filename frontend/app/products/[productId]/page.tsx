"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { colorToHex } from "@/lib/color-map";

type Variant = {
  variant_id: string;
  size: string;
  color: string;
  color_th: string | null;
  pattern: string | null;
  pattern_th: string | null;
  chest_min: number | string | null;
  chest_max: number | string | null;
  waist_min: number | string | null;
  waist_max: number | string | null;
  sleeve: string | null;
  sleeve_th: string | null;
  collar: string | null;
  collar_th: string | null;
  price: number | string;
  stock: number;
};

type ProductDetail = {
  product_id: string;
  product_name: string;
  product_name_th: string | null;
  category: string;
  category_th: string | null;
  sub_category: string | null;
  sub_category_th: string | null;
  description: string | null;
  description_th: string | null;
  variants: Variant[];
};

type ProductImage = {
  image_id: number;
  product_id: string;
  color: string | null;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};

type Review = {
  review_id: number;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  username: string;
  first_name: string;
  last_name: string;
};

type ReviewsResponse = {
  avg_rating: number;
  review_count: number;
  reviews: Review[];
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(price);

const starRow = (n: number) => "★★★★★☆☆☆☆☆".slice(5 - n, 10 - n);

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addToCartMessage, setAddToCartMessage] = useState<
    { type: "error" | "success"; text: string } | null
  >(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      fetch(`http://localhost:5000/products/${productId}`).then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      }),
      fetch(`http://localhost:5000/products/${productId}/images`).then((r) =>
        r.json()
      ),
      fetch(`http://localhost:5000/products/${productId}/reviews`).then((r) =>
        r.json()
      ),
    ])
      .then(([productData, imagesData, reviewsResp]) => {
        if (productData) setProduct(productData);
        setImages(Array.isArray(imagesData) ? imagesData : []);
        setReviewsData(reviewsResp);
      })
      .catch((err) => console.error("Failed to load product detail:", err))
      .finally(() => setLoading(false));
  }, [productId]);

  // Jump the gallery to the first image tagged with this color. Images with
  // no color tag (legacy uploads from before per-color tagging existed) are
  // treated as a generic fallback when no color-specific photo exists.
  const findImageIndexForColor = (color: string) => {
    const tagged = images.findIndex((img) => img.color === color);
    if (tagged !== -1) return tagged;
    return images.findIndex((img) => img.color === null);
  };

  // Initialize selection once the product (and its images) load or change.
  useEffect(() => {
    if (!product || product.variants.length === 0) return;
    const firstColor = product.variants[0].color;
    setSelectedColor(firstColor);
    setSelectedSize(null);
    setQuantity(1);
    const idx = findImageIndexForColor(firstColor);
    setActiveImageIndex(idx !== -1 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, images]);

  const colors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, Variant>();
    for (const v of product.variants) {
      if (!seen.has(v.color)) seen.set(v.color, v);
    }
    return Array.from(seen.values());
  }, [product]);

  const allSizes = useMemo(() => {
    if (!product) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const v of product.variants) {
      if (!seen.has(v.size)) {
        seen.add(v.size);
        ordered.push(v.size);
      }
    }
    return ordered;
  }, [product]);

  const sizesForSelectedColor = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.variants.filter((v) => v.color === selectedColor);
  }, [product, selectedColor]);

  const selectedVariant = useMemo(() => {
    return sizesForSelectedColor.find((v) => v.size === selectedSize) ?? null;
  }, [sizesForSelectedColor, selectedSize]);

  const displayPrice = Number(
    selectedVariant?.price ??
      sizesForSelectedColor[0]?.price ??
      product?.variants[0]?.price ??
      0
  );

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setSelectedSize(null);
    setAddToCartMessage(null);
    const idx = findImageIndexForColor(color);
    if (idx !== -1) setActiveImageIndex(idx);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setAddToCartMessage(null);
  };

  const goPrev = () => {
    if (images.length === 0) return;
    setActiveImageIndex((i) => (i - 1 + images.length) % images.length);
  };
  const goNext = () => {
    if (images.length === 0) return;
    setActiveImageIndex((i) => (i + 1) % images.length);
  };

  const maxQuantity = Math.max(1, Math.min(10, selectedVariant?.stock ?? 10));

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setAddToCartMessage({
        type: "error",
        text: "กรุณาเลือกไซซ์ก่อนเพิ่มลงตะกร้า",
      });
      return;
    }
    if (selectedVariant.stock === 0) {
      setAddToCartMessage({ type: "error", text: "สินค้าหมด" });
      return;
    }

    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token || !user.id) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          variant_id: selectedVariant.variant_id,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddToCartMessage({
          type: "error",
          text: data.error || "เพิ่มสินค้าไม่สำเร็จ",
        });
        return;
      }

      setAddToCartMessage({
        type: "success",
        text: data.message || "เพิ่มลงตะกร้าแล้ว",
      });
      window.dispatchEvent(new Event("cartUpdated"));
    } catch (err) {
      console.error("Add to cart error:", err);
      setAddToCartMessage({
        type: "error",
        text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#b89f8d] px-6 py-8 text-black">
        กำลังโหลด...
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#b89f8d] px-6 py-8 text-black">
        <p className="mb-4">ไม่พบสินค้า</p>
        <Link href="/products" className="text-blue-700 underline">
          กลับไปหน้าสินค้าทั้งหมด
        </Link>
      </div>
    );
  }

  const activeImage = images[activeImageIndex] ?? null;

  const stockLabel = (() => {
    if (!selectedVariant) return null;
    if (selectedVariant.stock === 0) return "สินค้าหมด";
    if (selectedVariant.stock <= 5) return `เหลือ ${selectedVariant.stock} ชิ้น`;
    return "มีสินค้า";
  })();
  const stockColor =
    selectedVariant && selectedVariant.stock > 0 ? "#2f7d4f" : "#b23b3b";

  const measurementLines: string[] = [];
  if (selectedVariant?.chest_min != null && selectedVariant?.chest_max != null) {
    measurementLines.push(
      `รอบอก ${Number(selectedVariant.chest_min)}–${Number(
        selectedVariant.chest_max
      )} นิ้ว`
    );
  }
  if (selectedVariant?.waist_min != null && selectedVariant?.waist_max != null) {
    measurementLines.push(
      `รอบเอว ${Number(selectedVariant.waist_min)}–${Number(
        selectedVariant.waist_max
      )} นิ้ว`
    );
  }

  const specs = [
    { label: "หมวดหมู่", value: product.category_th || product.category },
    product.sub_category_th
      ? { label: "หมวดหมู่ย่อย", value: product.sub_category_th }
      : null,
    selectedVariant?.pattern_th
      ? { label: "ลวดลาย", value: selectedVariant.pattern_th }
      : null,
    selectedVariant?.sleeve_th
      ? { label: "แขนเสื้อ", value: selectedVariant.sleeve_th }
      : null,
    selectedVariant?.collar_th
      ? { label: "คอเสื้อ", value: selectedVariant.collar_th }
      : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  const addDisabled = !selectedVariant || selectedVariant.stock === 0;

  return (
    <div className="min-h-screen bg-[#b89f8d] px-6 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        {/* breadcrumb */}
        <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-black/60">
          <Link href="/" className="hover:text-black">
            หน้าแรก
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-black">
            {product.category_th || product.category}
          </Link>
          {product.sub_category_th && (
            <>
              <span>/</span>
              <span className="font-medium text-black">
                {product.sub_category_th}
              </span>
            </>
          )}
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          {/* gallery */}
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gray-100">
              <img
                src={activeImage?.image_url || "https://placehold.co/600x800"}
                alt={
                  activeImage?.alt_text ||
                  product.product_name_th ||
                  product.product_name
                }
                className="h-full w-full object-cover"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    aria-label="ก่อนหน้า"
                    className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
                  >
                    ‹
                  </button>
                  <button
                    onClick={goNext}
                    aria-label="ถัดไป"
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"
                  >
                    ›
                  </button>
                  <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
                    {activeImageIndex + 1}/{images.length}
                  </span>
                </>
              )}
            </div>

            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.image_id}
                    onClick={() => setActiveImageIndex(i)}
                    className={`aspect-[4/5] w-16 flex-none overflow-hidden rounded-md outline outline-2 ${
                      i === activeImageIndex
                        ? "outline-black"
                        : "outline-transparent"
                    }`}
                  >
                    <img
                      src={img.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* info panel */}
          <div className="rounded-xl border border-black/10 bg-white p-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/50">
              {product.category_th || product.category}
              {product.sub_category_th ? ` · ${product.sub_category_th}` : ""}
            </div>

            <h1 className="mb-1 text-2xl font-bold leading-tight">
              {product.product_name_th || product.product_name}
            </h1>
            {product.product_name_th && (
              <div className="mb-4 text-sm text-black/50">
                {product.product_name}
              </div>
            )}

            <div className="mb-4 flex items-center gap-2">
              <div className="text-base tracking-widest">
                {starRow(Math.round(reviewsData?.avg_rating ?? 0))}
              </div>
              <span className="text-sm text-black/55">
                {reviewsData && reviewsData.review_count > 0
                  ? `${reviewsData.avg_rating.toFixed(1)} · ${
                      reviewsData.review_count
                    } รีวิว`
                  : "ยังไม่มีรีวิว"}
              </span>
            </div>

            <div className="mb-1 text-2xl font-bold">
              {formatPrice(displayPrice)}
            </div>
            {stockLabel && (
              <div
                className="mb-5 inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: stockColor }}
              >
                <span
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ background: stockColor }}
                />
                {stockLabel}
              </div>
            )}

            {/* color */}
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold">สี</span>
                <span className="text-sm text-black/60">
                  {colors.find((c) => c.color === selectedColor)?.color_th ||
                    selectedColor}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => handleColorSelect(c.color)}
                    aria-label={c.color_th || c.color}
                    title={c.color_th || c.color}
                    className="grid h-[38px] w-[38px] place-items-center rounded-full bg-white p-[3px]"
                    style={{
                      border:
                        c.color === selectedColor
                          ? "2px solid #1a1a1a"
                          : "2px solid transparent",
                      boxShadow:
                        c.color === selectedColor
                          ? "none"
                          : "inset 0 0 0 1px rgba(0,0,0,.08)",
                    }}
                  >
                    <span
                      className="block h-full w-full rounded-full border border-black/10"
                      style={{ background: colorToHex(c.color_th || c.color) }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* size */}
            <div className="mb-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold">ไซซ์</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {allSizes.map((size) => {
                  const variant = sizesForSelectedColor.find(
                    (v) => v.size === size
                  );
                  const oos = !variant || variant.stock === 0;
                  const selected = size === selectedSize;
                  return (
                    <button
                      key={size}
                      disabled={oos}
                      onClick={() => handleSizeSelect(size)}
                      className={`h-11 min-w-[52px] rounded-lg border px-3 text-sm font-semibold ${
                        selected
                          ? "border-black bg-black text-white"
                          : oos
                          ? "cursor-not-allowed border-black/10 bg-[#f4f1eb] text-black/30 line-through"
                          : "cursor-pointer border-black/20 bg-white text-black"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {measurementLines.length > 0 && (
              <div className="mb-5 whitespace-pre rounded-lg bg-[#f6f2ec] px-3 py-2 text-sm text-black/65">
                {measurementLines.join("     ")}
              </div>
            )}

            {/* quantity + add to cart */}
            <div className="flex items-stretch gap-3">
              <div className="flex flex-none items-center overflow-hidden rounded-lg border border-black/15">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="ลด"
                  className="h-12 w-10 bg-white text-lg"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-semibold">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(maxQuantity, q + 1))
                  }
                  aria-label="เพิ่ม"
                  className="h-12 w-10 bg-white text-lg"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addDisabled}
                className={`h-12 flex-1 rounded-lg text-sm font-semibold ${
                  addDisabled
                    ? "cursor-not-allowed bg-[#dcd6cc] text-black/40"
                    : "cursor-pointer bg-black text-white"
                }`}
              >
                เพิ่มลงตะกร้า
              </button>
            </div>

            {addToCartMessage && (
              <div
                className="mt-2 text-[12.5px]"
                style={{
                  color:
                    addToCartMessage.type === "error" ? "#b23b3b" : "#2f7d4f",
                }}
              >
                {addToCartMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* description */}
        <div className="mt-8 rounded-xl border border-black/10 bg-white p-7">
          <h2 className="mb-3 text-lg font-bold">รายละเอียดสินค้า</h2>
          {(product.description_th || product.description) && (
            <p className="mb-4 max-w-[760px] text-[15px] leading-relaxed text-black/80">
              {product.description_th || product.description}
            </p>
          )}
          {specs.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
              {specs.map((s) => (
                <li key={s.label}>
                  <strong className="font-semibold">{s.label}:</strong>{" "}
                  {s.value}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* reviews */}
        <div className="mt-5 rounded-xl border border-black/10 bg-white p-7">
          <div className="mb-5 flex items-baseline gap-3">
            <h2 className="text-lg font-bold">รีวิวจากลูกค้า</h2>
            {reviewsData && reviewsData.review_count > 0 && (
              <span className="text-sm text-black/55">
                {reviewsData.avg_rating.toFixed(1)} · {reviewsData.review_count}{" "}
                รีวิว
              </span>
            )}
          </div>

          {!reviewsData || reviewsData.review_count === 0 ? (
            <p className="text-sm text-black/55">
              ยังไม่มีรีวิวสำหรับสินค้านี้
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {reviewsData.reviews.map((r) => (
                <div
                  key={r.review_id}
                  className="border-t border-black/[.07] pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div className="text-sm tracking-widest">
                      {starRow(r.rating)}
                    </div>
                    {r.title && (
                      <span className="text-sm font-semibold">{r.title}</span>
                    )}
                  </div>
                  {r.body && (
                    <p className="mb-1 max-w-[720px] text-sm leading-relaxed text-black/75">
                      {r.body}
                    </p>
                  )}
                  <span className="text-[12.5px] text-black/45">
                    {(r.first_name && r.first_name.trim()) || r.username}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
