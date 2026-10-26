import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/** `next build` yayın derlemesidir; `next dev` geliştirme. */
const isProductionBuild = process.env.NODE_ENV === "production";

/**
 * GitHub Pages siteyi bir alt dizinde yayınlar (ör. /memeyap). Yayın iş akışı
 * PAGES_BASE_PATH ile verir; yerelde boştur.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

/**
 * Bu bilgisayarın yerel ağ adresleri (ör. 192.168.1.102). Aynı Wi-Fi'deki telefonlar
 * geliştirme sunucusuna bu adresle bağlanınca Next.js'in sayfanın JavaScript'ini
 * engellememesi için gerekli. Sadece `npm run dev` için geçerlidir.
 */
const localNetworkAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === "IPv4" && !address.internal)
  .map((address) => address!.address);

const nextConfig: NextConfig = {
  // Yayın: GitHub Pages için statik dosyalar (out/). Sunucu gerektiren hiçbir şey yok;
  // oyunun tüm mantığı Supabase'de.
  ...(isProductionBuild && { output: "export" as const }),
  basePath,
  // /oda → /oda/index.html (GitHub Pages bu biçimi sunar)
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // *.dev.tsx / *.dev.ts sayfaları (kutu tanımlama yardımcısı) sadece geliştirmede var.
  pageExtensions: isProductionBuild
    ? ["tsx", "ts"]
    : ["dev.tsx", "dev.ts", "tsx", "ts"],
  allowedDevOrigins: localNetworkAddresses,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
