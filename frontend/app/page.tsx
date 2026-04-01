import ProductGrid from "@/components/productgrid";

export default function HomePage() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>RECOMMENDATION</h1>

      <div style={styles.grid}>
        <ProductGrid columns={4} />
      </div>
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