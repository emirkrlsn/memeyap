"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { HEARTBEAT_INTERVAL_MS } from "@/lib/game-rules";
import type { Tables } from "@/types/database";

import { ensureAnonymousSession } from "./auth";
import { getSupabaseClient } from "./client";

export type Room = Tables<"rooms">;
export type Player = Tables<"players">;

export type RoomState =
  | { status: "loading" }
  | { status: "not-member" }
  | { status: "error" }
  | { status: "ready"; room: Room; players: Player[]; me: Player };

/**
 * Odanın canlı durumu: ilk yükleme, Realtime ile güncelleme ve bağlantı heartbeat'i.
 * Her değişiklikte odanın tamamı yeniden okunur; oda en fazla 15 oyuncu olduğundan
 * bu, olayları tek tek işlemekten hem basit hem güvenilirdir.
 */
export function useRoom(code: string) {
  const [state, setState] = useState<RoomState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const playerIds = useRef(new Set<string>());

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let disposed = false;
    let latestRequest = 0;
    let refreshTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function load(): Promise<RoomState> {
      const user = await ensureAnonymousSession();
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!room) return { status: "not-member" };

      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .order("joined_at");
      if (playersError) throw playersError;

      const me = players.find((player) => player.user_id === user.id);
      return me
        ? { status: "ready", room, players, me }
        : { status: "not-member" };
    }

    async function refresh() {
      const request = ++latestRequest;
      let next: RoomState;
      try {
        next = await load();
      } catch (error) {
        console.error("[MemeYap] Oda yüklenemedi:", error);
        next = { status: "error" };
      }
      if (disposed || request !== latestRequest) return;
      playerIds.current = new Set(
        next.status === "ready" ? next.players.map((p) => p.id) : [],
      );
      setState(next);
      if (next.status === "ready") startLive(next.room.id);
    }

    // Aynı anda gelen olayları tek yenilemede birleştir.
    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 150);
    }

    async function heartbeat() {
      await supabase.rpc("heartbeat");
      // Güvenlik ağı: kaçırılmış bir Realtime olayı ekranı en fazla bir aralık eski tutar.
      // (Hata da olsa yenile: ör. NOT_IN_ROOM ise oyuncu odadan çıkarılmıştır.)
      scheduleRefresh();
    }

    function startLive(roomId: string) {
      if (channel) return;
      channel = supabase
        // replication_ready: veritabanı dinlemesi gerçekten başlayınca "system" olayı gelir.
        // "SUBSCRIBED" ondan biraz önce gelir; arada olan değişiklikler kaçabilir.
        .channel(`room:${roomId}`, {
          config: { broadcast: { replication_ready: true } },
        })
        .on("system", {}, (payload: { status?: string }) => {
          if (payload.status === "ok") scheduleRefresh();
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`,
          },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
            filter: `room_id=eq.${roomId}`,
          },
          scheduleRefresh,
        )
        // Silme olayları filtrelenemez; sadece bu odadaki oyuncular için yenile.
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "players" },
          (payload) => {
            if (playerIds.current.has(String(payload.old.id)))
              scheduleRefresh();
          },
        )
        // Bağlantı kopup geri gelince kaçırılan olayları telafi et.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") scheduleRefresh();
        });

      void heartbeat();
      heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || !channel) return;
      void heartbeat();
      scheduleRefresh();
    }

    void refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearTimeout(refreshTimer);
      window.clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [code, version]);

  return { state, reload };
}
