import Image from "next/image";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image: string;
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div style={styles.card}>
      <Image
        src={product.image}
        alt={product.name}
        width={150}
        height={150}
      />

      <h3>{product.name}</h3>
      <p>{product.price} บาท</p>
      <p>{product.stock > 0 ? "มีสินค้า" : "สินค้าหมด"}</p>

      <button style={styles.button}>VIEW</button>
    </div>
  );
}

const styles: any = {
  card: {
    background: "#eee",
    padding: "15px",
    textAlign: "center",
    borderRadius: "10px",
    color: "#000",
  },
  button: {
    marginTop: "10px",
    padding: "8px",
    background: "#d6d0c5",
    border: "none",
    cursor: "pointer",
  },
};