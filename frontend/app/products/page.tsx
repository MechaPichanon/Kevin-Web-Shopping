"use client";

import { useState } from "react";
import ProductCard from "@/components/productcard";
import { products } from "@/lib/mockdata";

export default function ProductPage() {
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);

  const filtered = products.filter(
    (p) => p.price >= minPrice && p.price <= maxPrice
  );

  return (
    <div style={styles.container}>
      {/* LEFT FILTER */}
      <div style={styles.sidebar}>
        <h2>PRODUCT</h2>

        <p>PRICE</p>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            style={styles.input}
          />
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <input
          type="range"
          min="0"
          max="1000"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* RIGHT PRODUCT */}
      <div style={styles.products}>
        <div style={styles.grid}>
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
const styles: any = {
  container: {
    display: "flex",
    gap: "20px",
    padding: "30px",
    background: "#b89f8d",
    minHeight: "100vh",
    color: "#000",
  },
  sidebar: {
    width: "250px",
    background: "#ddd",
    padding: "20px",
    borderRadius: "8px",
    flexShrink: 0, // 🔥 กันโดนดัน
  },
  input: {
    width: "100%",
    padding: "5px",
  },
  products: {
    flex: 1,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", // 🔥 responsive
    gap: "20px",
  },
};