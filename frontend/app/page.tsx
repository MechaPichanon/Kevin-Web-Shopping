import ProductGrid from "@/components/productgrid";
import Recommendation from "@/components/recommendation";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Recommendation />
      </main>
      </div>
  );
}

const styles: any = {
  container: {
    background: "#b89f8d",
    minHeight: "100vh",
    padding: "40px",
    color: "#000",
  },
  title: {
    textAlign: "center",
    marginBottom: "30px",
    color: "#fff",
  },
  grid: {
    background: "#8b6f5a",
    padding: "20px",
    borderRadius: "10px",
  },
};
