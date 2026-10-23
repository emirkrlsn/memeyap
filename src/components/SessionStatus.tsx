"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";
import { ensureAnonymousSession } from "@/lib/supabase/auth";

type Status = "connecting" | "ready" | "failed";

/** Sayfa açılınca anonim oturumu başlatır ve durumunu gösterir. */
export function SessionStatus() {
  const [status, setStatus] = useState<Status>("connecting");
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    ensureAnonymousSession()
      .then((user) => {
        console.info("[MemeYap] Anonim kullanıcı kimliği:", user.id);
        if (!cancelled) setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("[MemeYap] Anonim oturum açılamadı:", error);
        if (cancelled) return;
        setStatus("failed");
        showToast(strings.session.failed, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return (
    <p
      data-testid="session-status"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold",
        status === "connecting" && "bg-ink/10 text-ink-soft",
        status === "ready" && "bg-mint/15 text-mint-dark",
        status === "failed" && "bg-coral/15 text-coral-dark",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          status === "connecting" && "animate-pulse bg-ink-soft",
          status === "ready" && "bg-mint",
          status === "failed" && "bg-coral",
        )}
      />
      {strings.session[status]}
    </p>
  );
}
