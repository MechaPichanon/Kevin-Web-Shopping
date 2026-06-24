import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";
import Navbarsub from "@/components/navbarsub";
import { CartProvider } from "@/lib/cart-context";
import ChatWidget from "@/components/ChatWidget";

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
          <ChatWidget />
        </CartProvider>
      </body>
    </html>
  );
}
