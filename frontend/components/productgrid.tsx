import { products } from "@/lib/mockdata";
import ProductCard from "./productcard";

export default function ProductGrid({ columns = 4 }: { columns?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 20,
      }}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}