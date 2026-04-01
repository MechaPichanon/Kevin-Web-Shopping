import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Shopping Chatbot Demo",
  description: "Next.js demo UI for the FastAPI chatbot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
