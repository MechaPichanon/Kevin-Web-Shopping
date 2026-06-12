import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";
import Navbarsub from "@/components/navbarsub";
import { CartProvider } from "@/lib/cart-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Navbar />
          {/* <Navbarsub /> */}
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
