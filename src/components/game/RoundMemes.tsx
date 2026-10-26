"use client";

import { useEffect, useState } from "react";

import { BoxEditor } from "@/components/meme/BoxEditor";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { templateUrl, toBoxes, type Template } from "@/lib/meme/templates";
import { RATINGS, type Rating } from "@/lib/ratings";
import { formatPoints } from "@/lib/scoreboard";
import { strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/supabase/use-room";
import type { Json } from "@/types/database";

import { RATING_STYLE } from "./rating-style";

/** get_round_results yanıtındaki bir meme (puana göre sıralı gelir). */
type RoundMeme = {
  meme_id: string;
  owner: string | null;
  points: number;
  boxes: Json;
  template: Pick<Template, "storage_path" | "width" | "height" | "kind">;
  distribution: Record<Rating, number>;
};

/** Turda oylanan tüm meme'ler tek sayfada, puana göre sıralı; sahibi ve oy dağılımıyla. */
export function RoundMemes({ room }: { room: Room }) {
  const [memes, setMemes] = useState<RoundMeme[] | null>(null);

  useEffect(() => {
    let active = true;
    getSupabaseClient()
      .rpc("get_round_results")
      .then(({ data }) => {
        if (active) setMemes((data as unknown as RoundMeme[] | null) ?? []);
      });
    return () => {
      active = false;
    };
  }, [room.current_round, room.status]);

  if (!memes) {
    return (
      <p className="animate-pulse text-center font-extrabold text-ink-soft">
        {strings.common.loading}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xl font-black">
        {strings.results.roundMemes(room.current_round)}
      </h3>
      {memes.length === 0 && (
        <Card className="text-center font-bold text-ink-soft">
          {strings.results.noMemes}
        </Card>
      )}
      <ol className="flex flex-col gap-4" data-testid="round-memes">
        {memes.map((meme, index) => (
          <li key={meme.meme_id} data-testid="round-meme">
            <Card className="flex animate-pop-in flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full font-meme text-xl",
                    index === 0 ? "bg-sun text-ink" : "bg-ink/10 text-ink",
                  )}
                >
                  {index === 0 ? "👑" : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-ink-soft">
                    {strings.results.madeBy}
                  </span>
                  <span
                    className="block truncate text-lg font-black"
                    data-testid="meme-owner"
                  >
                    {meme.owner ?? strings.results.unknownOwner}
                  </span>
                </span>
                <span
                  data-testid="meme-points"
                  className={cn(
                    "font-meme text-3xl",
                    meme.points > 0
                      ? "text-mint-dark"
                      : meme.points < 0
                        ? "text-coral-dark"
                        : "text-ink",
                  )}
                >
                  {formatPoints(meme.points)}
                </span>
              </div>

              <BoxEditor
                imageUrl={templateUrl(meme.template)}
                width={meme.template.width}
                height={meme.template.height}
                boxes={toBoxes(meme.boxes)}
                maxHeightVh={45}
              />

              <ul className="flex flex-wrap justify-center gap-1.5">
                {RATINGS.map((rating) => (
                  <li
                    key={rating}
                    title={strings.ratings[rating]}
                    data-rating={rating}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-black",
                      RATING_STYLE[rating].color,
                      meme.distribution[rating] === 0 && "opacity-35",
                    )}
                  >
                    <span aria-hidden>{RATING_STYLE[rating].emoji}</span>
                    <span className="sr-only">{strings.ratings[rating]}:</span>
                    <span className="tabular-nums">
                      {meme.distribution[rating]}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
