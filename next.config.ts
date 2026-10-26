import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

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
  cacheComponents: true,
  partialPrefetching: true,
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
