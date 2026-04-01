import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar";
import Navbarsub from "@/components/navbarsub";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar/>
        <Navbarsub />
        {children}
      </body>
    </html>
  );
}
