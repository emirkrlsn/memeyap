import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";
import { preconnect } from "react-dom";

import { ToastProvider } from "@/components/ui/Toast";
import { strings } from "@/lib/strings";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700", "800", "900"],
});

// Klasik meme yazısı. Impact'in web lisansı olmadığından açık lisanslı Anton kullanılır.
const anton = localFont({
  variable: "--font-anton",
  src: "../../public/fonts/Anton-Regular.ttf",
  weight: "400",
});

export const metadata: Metadata = {
  title: strings.app.name,
  description: strings.app.description,
};

export const viewport: Viewport = {
  themeColor: "#7b3fe4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Supabase bağlantısını erken aç (ilk istek daha hızlı).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) preconnect(supabaseUrl);

  return (
    <html
      lang="tr"
      className={`${nunito.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
