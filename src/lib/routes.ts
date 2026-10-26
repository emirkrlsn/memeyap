/**
 * Oda sayfasının adresi. Site GitHub Pages'te statik yayınlandığı için oda kodu adres
 * yolunda değil sorgu parametresinde taşınır: /oda/?kod=ABC123
 */
export function roomPath(code: string): string {
  return `/oda/?kod=${encodeURIComponent(code)}`;
}

/** public/ altındaki bir dosyanın adresi (GitHub Pages'te site bir alt dizinde yayınlanır). */
export function publicPath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
