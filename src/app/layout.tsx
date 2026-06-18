import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IT Project & Support Tracker",
  description: "A premium glassmorphism MVP for IT Project Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased flex flex-col md:flex-row h-screen overflow-hidden`}>
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
