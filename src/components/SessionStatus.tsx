"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";
import { ensureAnonymousSession } from "@/lib/supabase/auth";

type Status = keyof typeof strings.session;

const styles: Record<Status, { badge: string; dot: string }> = {
  connecting: {
    badge: "bg-ink/10 text-ink-soft",
    dot: "animate-pulse bg-ink-soft",
  },
  ready: { badge: "bg-mint/15 text-mint-dark", dot: "bg-mint" },
  failed: { badge: "bg-coral/15 text-coral-dark", dot: "bg-coral" },
};

/** Sayfa açılınca anonim oturumu başlatır ve durumunu gösterir. */
export function SessionStatus() {
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let cancelled = false;
    ensureAnonymousSession()
      .then((user) => {
        console.info("[MemeYap] Anonim kullanıcı kimliği:", user.id);
        if (!cancelled) setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("[MemeYap] Anonim oturum açılamadı:", error);
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p
      role="status"
      data-testid="session-status"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold",
        styles[status].badge,
      )}
    >
      <span
        aria-hidden
        className={cn("size-2.5 rounded-full", styles[status].dot)}
      />
      {strings.session[status]}
    </p>
  );
}
