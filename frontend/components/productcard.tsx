"use client";

import { useState } from "react";
import Image from "next/image";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image: string;
  category: string;
};

export default function ProductCard({ product }: { product: Product }) {

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="group overflow-hidden rounded-xl border bg-white transition hover:shadow-lg">
      
      {/* IMAGE */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
        />

        {/* 🛒 Add to cart
        <div className="absolute bottom-3 left-3 right-3 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2 text-white text-sm">
            <ShoppingCart className="h-4 w-4" />
            เพิ่มลงตะกร้า
          </button>
        </div> */}
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