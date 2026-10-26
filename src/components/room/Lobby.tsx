"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import {
  MIN_PLAYERS,
  REROLL_OPTIONS,
  ROUND_COUNT_OPTIONS,
  ROUND_SECONDS_OPTIONS,
} from "@/lib/game-rules";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Player, Room } from "@/lib/supabase/use-room";

import { PlayerList } from "./PlayerList";

type Props = { room: Room; players: Player[]; me: Player };

type Settings = Pick<Room, "total_rounds" | "round_seconds" | "reroll_limit">;

export function Lobby({ room, players, me }: Props) {
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);
  const isHost = room.host_player_id === me.id;
  const connectedCount = players.filter((player) => player.is_connected).length;
  const canStart = connectedCount >= MIN_PLAYERS;

  async function updateSettings(change: Partial<Settings>) {
    const next = { ...room, ...change };
    const { error } = await getSupabaseClient().rpc("update_settings", {
      p_total_rounds: next.total_rounds,
      p_round_seconds: next.round_seconds,
      p_reroll_limit: next.reroll_limit,
    });
    if (error) showToast(errorMessage(error), "error");
  }

  async function startGame() {
    setStarting(true);
    const { error } = await getSupabaseClient().rpc("start_game");
    if (error) {
      showToast(errorMessage(error), "error");
      setStarting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      showToast(strings.room.codeCopied, "success");
    } catch {
      // Panoya erişim yoksa kod zaten ekranda yazıyor.
    }
  }

  const onChange = (key: keyof Settings) =>
    isHost
      ? (value: number) => void updateSettings({ [key]: value })
      : undefined;

  return (
    <div className="flex w-full flex-col gap-5">
      <Card className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-extrabold text-ink-soft">
          {strings.room.codeLabel}
        </p>
        <button
          type="button"
          onClick={copyCode}
          aria-describedby="copy-code-hint"
          data-testid="room-code"
          className="rounded-2xl bg-sun px-6 py-2 font-meme text-5xl tracking-[0.2em] text-ink transition-transform hover:scale-105 active:scale-95"
        >
          {room.code}
        </button>
        <p id="copy-code-hint" className="text-xs font-bold text-ink-soft">
          {strings.room.copyCode}
        </p>
      </Card>

      <Card>
        <PlayerList room={room} players={players} me={me} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-black">{strings.room.settings}</h2>
        <Segmented
          label={strings.room.rounds}
          options={ROUND_COUNT_OPTIONS}
          value={room.total_rounds}
          onChange={onChange("total_rounds")}
        />
        <Segmented
          label={strings.room.roundSeconds}
          options={ROUND_SECONDS_OPTIONS}
          value={room.round_seconds}
          format={strings.room.seconds}
          onChange={onChange("round_seconds")}
        />
        <Segmented
          label={strings.room.rerolls}
          options={REROLL_OPTIONS}
          value={room.reroll_limit}
          onChange={onChange("reroll_limit")}
        />
      </Card>

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            variant="success"
            fullWidth
            disabled={!canStart || starting}
            onClick={startGame}
          >
            {starting ? strings.common.loading : strings.room.start}
          </Button>
          {!canStart && (
            <p className="text-center text-sm font-bold text-ink-soft">
              {strings.room.needMorePlayers(MIN_PLAYERS, connectedCount)}
            </p>
          )}
        </div>
      ) : (
        <p className="animate-pulse text-center font-extrabold text-ink-soft">
          {strings.room.waitingForHost}
        </p>
      )}
    </div>
  );
}
