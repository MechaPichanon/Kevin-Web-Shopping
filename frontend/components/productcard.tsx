"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

type Product = {
  id: number;
  variant_id?: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  category: string;
};

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  console.log(product.image);
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };
  const handleAddToCart = async () => {
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

      alert(data.message || "เพิ่มสินค้าสำเร็จ");
      
      window.dispatchEvent(
        new Event("cartUpdated")
      );
    } catch (err) {
      console.error("Add to cart error:", err);
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  return (
    <div className="group overflow-hidden rounded-xl border bg-white transition hover:shadow-lg">

      {/* IMAGE */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover"
        />

        🛒 Add to cart
        <div className="absolute bottom-3 left-3 right-3 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={handleAddToCart}
            className="w-full rounded-lg bg-black py-2 text-white"
          >
            เพิ่มลงตะกร้า
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 text-black">
        <h3 className="text-xs text-gray-500 uppercase">{product.category}</h3>
        <h3 className="line-clamp-2 font-medium">{product.name}</h3>

        <p className="mt-1 text-lg font-bold">
          {formatPrice(product.price)}
        </p>

        <p className="text-sm text-gray-500">
          {product.stock > 0 ? "มีสินค้า" : "สินค้าหมด"}
        </p>
      </div>
    </div>
  );
}
