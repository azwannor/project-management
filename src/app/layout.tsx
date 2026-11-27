import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { ThemeProvider, type ThemeMode } from "@/components/providers/ThemeProvider";
import { BoardroomProvider } from "@/components/providers/BoardroomProvider";
import { LocaleProvider, type Locale } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Royal Medica IT Tracker",
  description: "Enterprise IT Project, Support SLA, Asset QR & Preventive Maintenance Command Center",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#3B74B8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get("theme")?.value;
  const initialTheme: ThemeMode = rawTheme === "dark" ? "dark" : "light";

  const rawLocale = cookieStore.get("locale")?.value;
  const initialLocale: Locale = rawLocale === "id" ? "id" : "en";

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${montserrat.variable} ${jetbrains.variable}${initialTheme === "dark" ? " dark" : ""}`}
    >
      <body className="antialiased flex flex-col md:flex-row h-screen overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-ink)]">
        <ThemeProvider initialTheme={initialTheme}>
          <LocaleProvider initialLocale={initialLocale}>
            <BoardroomProvider>
              <AppLayout>{children}</AppLayout>
            </BoardroomProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
