import Link from "next/link";

export default function Navbarsub() {
    return (
        <nav style={{
            background: "#8b6f5a",
            color: "white",
            padding: "16px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        }}>
            <div style={{ display: "flex", gap: 12,  alignItems: "center" }}>
                <Link href="/">Home</Link>
                <Link href="/products">Products</Link>
                <input placeholder="Search..." />
                <button>📷</button>
                <button>🛒</button>
            </div>
        </nav>
    );
}
