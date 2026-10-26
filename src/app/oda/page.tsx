"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { RoomScreen } from "@/components/room/RoomScreen";
import { normalizeRoomCode } from "@/lib/game-rules";

/** Oda sayfası: /oda/?kod=ABC123 (kod sadece tarayıcıda okunur; sayfa statik yayınlanır). */
export default function RoomPage() {
  return (
    <Suspense>
      <RoomFromQuery />
    </Suspense>
  );
}

function RoomFromQuery() {
  const code = normalizeRoomCode(useSearchParams().get("kod") ?? "");
  return <RoomScreen code={code} />;
}
