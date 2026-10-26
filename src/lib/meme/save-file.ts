"use client";

/**
 * Dosyayı kullanıcıya verir. Telefonlarda önce paylaşım menüsü denenir (iOS'ta "Resmi
 * Kaydet" ile Fotoğraflar'a kaydedilebilir); olmazsa ya da masaüstündeyse normal indirme.
 */
export async function saveFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;

  if (touchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // Kullanıcı vazgeçtiyse dur; tarayıcı izin vermediyse (ör. uzun GIF hazırlığından
      // sonra dokunma etkisi bitti) normal indirmeye düş.
      if ((error as DOMException).name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
