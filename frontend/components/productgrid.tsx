import { products } from "@/lib/mockdata";
import ProductCard from "./productcard";

export default function ProductGrid() {
  return (
    <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
