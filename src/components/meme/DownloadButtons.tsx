"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  exportMeme,
  memeExtension,
  type ExportableMeme,
} from "@/lib/meme/export";
import { memeFileName, uniqueFileNames } from "@/lib/meme/filename";
import { saveFile } from "@/lib/meme/save-file";
import { toBoxes, type Template } from "@/lib/meme/templates";
import { strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/supabase/use-room";
import type { Json } from "@/types/database";

type Props = {
  meme: ExportableMeme;
  round: number;
  /** Dosya adındaki etiket: sahibin adı ya da (sahip gizliyken) "meme3". */
  label: string;
};

/** Tek meme'i indirir: sabit şablon PNG, hareketli şablon GIF. */
export function DownloadButton({ meme, round, label }: Props) {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const extension = memeExtension(meme);

  async function download() {
    setProgress(0);
    try {
      const blob = await exportMeme(meme, setProgress);
      await saveFile(blob, memeFileName(round, label, extension));
    } catch (error) {
      console.error("[MemeYap] İndirme başarısız:", error);
      showToast(strings.download.failed, "error");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={download}
      disabled={progress !== null}
      data-testid="download"
      className="self-center"
    >
      {progress === null
        ? strings.download.button(extension)
        : strings.download.preparing(Math.round(progress * 100))}
    </Button>
  );
}

type GameMeme = {
  round: number;
  owner: string | null;
  boxes: Json;
  template: Pick<Template, "storage_path" | "width" | "height" | "kind">;
};

/** Oyun sonunda oyunun tüm oylanmış meme'lerini tek ZIP olarak indirir. */
export function DownloadAllButton({ room }: { room: Room }) {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<string | null>(null);

  async function download() {
    setProgress(strings.common.loading);
    try {
      const { data, error } = await getSupabaseClient().rpc("get_game_memes");
      if (error) throw error;
      const memes = (data as unknown as GameMeme[] | null) ?? [];
      const exportable = memes.map((meme) => ({
        template: meme.template,
        boxes: toBoxes(meme.boxes),
      }));
      const names = uniqueFileNames(
        memes.map((meme, i) =>
          memeFileName(
            meme.round,
            meme.owner ?? strings.results.unknownOwner,
            memeExtension(exportable[i]),
          ),
        ),
      );

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      // Sırayla: aynı anda çok sayıda GIF işlemek telefonu yorar.
      for (const [i, meme] of exportable.entries()) {
        setProgress(strings.download.allProgress(i + 1, exportable.length));
        zip.file(names[i], await exportMeme(meme));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      await saveFile(blob, `memeyap_${room.code}.zip`);
    } catch (error) {
      console.error("[MemeYap] Toplu indirme başarısız:", error);
      showToast(strings.download.failed, "error");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Button
      size="lg"
      variant="secondary"
      fullWidth
      onClick={download}
      disabled={progress !== null}
      data-testid="download-all"
    >
      {progress ?? strings.download.all}
    </Button>
  );
}
