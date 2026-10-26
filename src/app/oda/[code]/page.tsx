import { Suspense } from "react";

import { RoomScreen } from "@/components/room/RoomScreen";
import { normalizeRoomCode } from "@/lib/game-rules";

export default function RoomPage({ params }: PageProps<"/oda/[code]">) {
  // Kod sadece istek anında bilinir; Cache Components bunun Suspense içinde okunmasını ister.
  return (
    <Suspense>
      {params.then(({ code }) => (
        <RoomScreen code={normalizeRoomCode(code)} />
      ))}
    </Suspense>
  );
}
