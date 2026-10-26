"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BoxEditor } from "@/components/meme/BoxEditor";
import { DownloadButton } from "@/components/meme/DownloadButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { MAX_BOX_TEXT_LENGTH, MAX_BOXES, type Box } from "@/lib/meme/render";
import {
  NEW_BOX,
  templateUrl,
  toBoxes,
  type Template,
} from "@/lib/meme/templates";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSecondsLeft } from "@/lib/supabase/server-clock";
import { useAdvanceWhenDue } from "@/lib/supabase/use-advance";
import { playSound } from "@/lib/sound";
import { useCountdownTicks } from "@/lib/use-countdown-ticks";
import type { Player, Room } from "@/lib/supabase/use-room";

const SAVE_DELAY_MS = 600;
/** Sunucu süre bitiminden 2 sn sonra ilerletir; istemci biraz daha bekler. */
const ADVANCE_AFTER_SECONDS = 2.5;

type Props = { room: Room; players: Player[]; me: Player };

export function MemeEditor({ room, players, me }: Props) {
  const { showToast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const pendingBoxes = useRef<Box[] | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const secondsLeft = useSecondsLeft(room.phase_ends_at) ?? 0;
  const timeUp = secondsLeft <= 0;
  const editable = !me.is_ready && !timeUp;

  const activePlayers = players.filter(
    (player) =>
      player.active_from_round <= room.current_round && player.is_connected,
  );
  const readyCount = activePlayers.filter((player) => player.is_ready).length;

  useEffect(() => {
    let active = true;
    getSupabaseClient()
      .from("memes")
      .select("boxes, templates(*)")
      .eq("room_id", room.id)
      .eq("round", room.current_round)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          showToast(errorMessage(error), "error");
          return;
        }
        setTemplate(data.templates);
        setBoxes(toBoxes(data.boxes));
      });
    return () => {
      active = false;
    };
  }, [room.id, room.current_round, loadVersion, showToast]);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    const next = pendingBoxes.current;
    if (!next) return;
    pendingBoxes.current = null;
    const { error } = await getSupabaseClient().rpc("save_meme", {
      p_boxes: next,
    });
    if (error && error.message !== "PHASE_OVER")
      showToast(errorMessage(error), "error");
  }, [showToast]);

  function change(next: Box[]) {
    setBoxes(next);
    pendingBoxes.current = next;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }

  // Süre bitmeden son hâli kaydet.
  useEffect(() => {
    if (secondsLeft < 1.5 && pendingBoxes.current) void flush();
  }, [secondsLeft, flush]);
  useAdvanceWhenDue(secondsLeft, ADVANCE_AFTER_SECONDS);
  useCountdownTicks(timeUp ? null : secondsLeft);

  async function run(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    await flush();
    const { error } = await action();
    if (error) showToast(errorMessage(error), "error");
    setBusy(false);
    return !error;
  }

  async function reroll() {
    const ok = await run(() => getSupabaseClient().rpc("reroll_template"));
    if (ok) {
      setSelected(null);
      setLoadVersion((version) => version + 1);
    }
  }

  const toggleReady = () => {
    playSound("pop");
    return run(() =>
      getSupabaseClient().rpc("set_ready", { p_ready: !me.is_ready }),
    );
  };

  if (!template) {
    return (
      <p className="animate-pulse py-10 font-extrabold text-ink-soft">
        {strings.common.loading}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-grape px-3 py-1 text-sm font-black text-white">
          {strings.game.round(room.current_round, room.total_rounds)}
        </span>
        <span
          aria-label={strings.game.timeLeft}
          data-testid="countdown"
          className={cn(
            "font-meme text-4xl tabular-nums",
            secondsLeft <= 10 ? "animate-pulse text-coral" : "text-ink",
          )}
        >
          {timeUp ? strings.game.timeUp : Math.ceil(secondsLeft)}
        </span>
        <span
          className="text-sm font-extrabold text-ink-soft"
          data-testid="ready-count"
        >
          {strings.game.readyCount(readyCount, activePlayers.length)}
        </span>
      </div>

      <BoxEditor
        imageUrl={templateUrl(template)}
        width={template.width}
        height={template.height}
        boxes={boxes}
        onChange={editable ? change : undefined}
        selected={selected}
        onSelect={setSelected}
      />
      {editable && (
        <p className="text-center text-xs font-bold text-ink-soft">
          {strings.game.editorHint}
        </p>
      )}
      <DownloadButton
        meme={{ template, boxes }}
        round={room.current_round}
        label={me.username}
      />

      <Card className="flex flex-col gap-3">
        {boxes.map((box, index) => (
          <div key={index} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`box-${index}`}>
              {strings.game.boxLabel(index + 1)}
            </label>
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-sun text-sm font-black"
            >
              {index + 1}
            </span>
            <input
              id={`box-${index}`}
              value={box.text}
              maxLength={MAX_BOX_TEXT_LENGTH}
              placeholder={strings.game.boxPlaceholder}
              disabled={!editable}
              onFocus={() => setSelected(index)}
              onChange={(event) =>
                change(
                  boxes.map((b, i) =>
                    i === index ? { ...b, text: event.target.value } : b,
                  ),
                )
              }
              className={cn(
                "min-h-11 min-w-0 flex-1 rounded-xl border-[3px] bg-white px-3 font-bold outline-none focus:border-grape disabled:opacity-60",
                selected === index ? "border-sun" : "border-ink/15",
              )}
            />
            {editable && (
              <button
                type="button"
                aria-label={strings.game.removeBox(index + 1)}
                onClick={() => {
                  setSelected(null);
                  change(boxes.filter((_, i) => i !== index));
                }}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral/15 text-xl font-black text-coral-dark hover:bg-coral/25"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {editable && (
          <Button
            variant="ghost"
            disabled={boxes.length >= MAX_BOXES}
            onClick={() => {
              setSelected(boxes.length);
              change([...boxes, NEW_BOX]);
            }}
          >
            {boxes.length >= MAX_BOXES
              ? strings.game.maxBoxes(MAX_BOXES)
              : strings.game.addBox}
          </Button>
        )}
      </Card>

      {!timeUp && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {!me.is_ready && (
            <Button
              variant="secondary"
              fullWidth
              disabled={busy || me.rerolls_left <= 0}
              onClick={reroll}
            >
              {strings.game.reroll(me.rerolls_left)}
            </Button>
          )}
          <Button
            variant={me.is_ready ? "ghost" : "success"}
            size="lg"
            fullWidth
            disabled={busy}
            onClick={toggleReady}
          >
            {me.is_ready ? strings.game.unready : strings.game.ready}
          </Button>
        </div>
      )}
      {me.is_ready && !timeUp && (
        <p className="text-center font-extrabold text-mint-dark">
          {strings.game.waitingOthers}
        </p>
      )}
    </div>
  );
}
