"use client";

import { useState } from "react";
import ProductGrid from "@/components/productgrid";
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "20px",
          }}
        >
          {filtered.map((p) => (
            <div key={p.id}>
              {/* reuse card */}
              <ProductGrid columns={3} />
            </div>
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
  },
  input: {
    width: "100%",
    padding: "5px",
  },
  products: {
    flex: 1,
  },
};