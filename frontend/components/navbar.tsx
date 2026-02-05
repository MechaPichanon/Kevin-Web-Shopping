import Link from "next/link";

export default function Navbar() {
  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 32px",
      background: "#8b6f5a",
      color: "white"
    }}>
      {/* ซ้าย */}
      <div style={{ fontWeight: "bold" }}>LOGO</div>

      {/* ขวา */}
      <div style={{ display: "flex", gap: 20 }}>
        
        <Link href="/">Language</Link>
        <Link href="/">Currency</Link>
        <Link href="/login">Login</Link>
        <Link href="/signup">Sign up</Link>

      </div>
    </nav>
  );
}
