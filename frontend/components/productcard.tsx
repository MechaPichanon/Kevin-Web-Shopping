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
        <div className="product-card" style={{ background: "#fff", border: "1px solid #ddd", padding: 10, width: 200 }}>
            <Image src={product.image} alt={product.name} width={180} height={180} />
            <h3 className="product-name">{product.name}</h3>
            <p className="product-price">{product.price} บาท</p>
            <p className="product-stock">
                {product.stock > 0 ? "มีสินค้า" : "สินค้าหมด"}
            </p>
        </div>
    );
}
