import type { Metadata } from "next";
import {
  Noto_Serif_Thai,
  Noto_Sans_Thai,
  IBM_Plex_Sans_Thai,
  IBM_Plex_Mono,
  Fraunces,
} from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Navbarsub from "@/components/navbarsub";
import Footer from "@/components/footer";
import { CartProvider } from "@/lib/cart-context";
import ChatWidget from "@/components/ChatWidget";

const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: "variable",
  variable: "--font-noto-serif-thai",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: "variable",
  variable: "--font-noto-sans-thai",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-thai",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Kevin Shop · ร้านเสื้อผ้าคุณภาพ",
  description: "เสื้อคุณภาพ ราคาที่คุณเข้าถึงได้",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${notoSerifThai.variable} ${notoSansThai.variable} ${ibmPlexSansThai.variable} ${ibmPlexMono.variable} ${fraunces.variable}`}
    >
      <body>
        <CartProvider>
          <Navbar />
          {/* <Navbarsub /> */}
          {children}
          <Footer />
          <ChatWidget />
        </CartProvider>
      </body>
    </html>
  );
}
