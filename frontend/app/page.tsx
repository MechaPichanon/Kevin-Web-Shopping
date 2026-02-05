import Navbar from "@/components/navbarsub";
import Recommendation from "@/components/recommendation";
import ProductGrid from "@/components/productgrid";
import Navbarsub from "@/components/navbarsub";

export default function HomePage() {
  return (
    <>
      <Navbarsub />
      <Recommendation />

      <main style={{ padding: 40, background: "#8b6f5a" }}>
        <div style={{
          display: "flex",
          gap: 24,
          justifyContent: "center"
        }}>
          <ProductGrid />

        </div>
      </main>


    </>
  );
}
