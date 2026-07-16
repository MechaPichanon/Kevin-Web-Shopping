"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type Product = {
  id: number;
  product_id?: string;
  variant_id?: string;
  name: string;
  name_en?: string;
  price: number;
  stock: number;
  image: string;
  category: string;
};

type AddedPayload = {
  name: string;
  name_en?: string;
  price: number;
};

export default function ProductCard({
  product,
  onAdded,
}: {
  product: Product;
  onAdded?: (item: AddedPayload) => void;
}) {
  const router = useRouter();
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const soldOut = product.stock <= 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (soldOut) return;

    const variantId = product.variant_id ?? String(product.id);
    const token = localStorage.getItem("token");
    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    if (!token || !user.id) {
      alert("กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้า");
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(
        "http://localhost:5000/cart/add",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            variant_id: variantId,
            quantity: 1,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "เพิ่มสินค้าไม่สำเร็จ");
        return;
      }

      if (onAdded) {
        onAdded({
          name: product.name,
          name_en: product.name_en,
          price: product.price,
        });
      } else {
        alert(data.message || "เพิ่มสินค้าสำเร็จ");
      }

      window.dispatchEvent(
        new Event("cartUpdated")
      );
    } catch (err) {
      console.error("Add to cart error:", err);
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const cardInner = (
    <>
      {/* IMAGE */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover"
        />

        <div className="absolute bottom-3 left-3 right-3 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={handleAddToCart}
            disabled={soldOut}
            className={`w-full rounded-lg py-2 text-white ${
              soldOut
                ? "cursor-not-allowed bg-black/40"
                : "bg-black"
            }`}
          >
            {soldOut ? "สินค้าหมด · Sold out" : "เพิ่มลงตะกร้า · Add to cart"}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 text-black">
        <h3 className="text-xs text-gray-500 uppercase">{product.category}</h3>
        <h3 className="line-clamp-2 font-medium">{product.name}</h3>

        {product.name_en && (
          <p className="line-clamp-1 text-xs text-gray-400">{product.name_en}</p>
        )}

        <p className="mt-1 text-lg font-bold">
          {formatPrice(product.price)}
        </p>

        <p className={`text-sm ${soldOut ? "font-semibold text-red-600" : "text-gray-500"}`}>
          {soldOut ? "สินค้าหมด" : "มีสินค้า"}
        </p>
      </div>
    </>
  );

  const className =
    "group block overflow-hidden rounded-xl border bg-white transition hover:shadow-lg";

  if (product.product_id) {
    return (
      <Link href={`/products/${product.product_id}`} className={className}>
        {cardInner}
      </Link>
    );
  }

  return <div className={className}>{cardInner}</div>;
}
