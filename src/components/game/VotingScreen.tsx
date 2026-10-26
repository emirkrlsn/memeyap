"use client";

import { useEffect, useState } from "react";

import { BoxEditor } from "@/components/meme/BoxEditor";
import { DownloadButton } from "@/components/meme/DownloadButtons";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { templateUrl, toBoxes, type Template } from "@/lib/meme/templates";
import { RATING_POINTS, RATINGS, type Rating } from "@/lib/ratings";
import { formatPoints } from "@/lib/scoreboard";
import { errorMessage, strings } from "@/lib/strings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSecondsLeft } from "@/lib/supabase/server-clock";
import { useAdvanceWhenDue } from "@/lib/supabase/use-advance";
import type { Player, Room } from "@/lib/supabase/use-room";
import type { Json } from "@/types/database";

import { RATING_STYLE } from "./rating-style";

/** get_current_vote_meme yanıtı. Sahip bilgisi içermez. */
type VoteMeme = {
  meme_id: string;
  index: number;
  total: number;
  template: Pick<Template, "storage_path" | "width" | "height" | "kind">;
  boxes: Json;
  is_mine: boolean;
  my_rating: Rating | null;
  votes_cast: number;
  voters: number;
};

/** Sunucu oylamayı süre bitiminden 2 sn sonra kapatır; istemci biraz daha bekler. */
const GRACE_SECONDS = 2.5;
/** "Kaç kişi oy verdi" bilgisini tazeleme aralığı. */
const PROGRESS_REFRESH_MS = 3000;

type Props = { room: Room; me: Player };

/** Oylanan meme. Her meme için yeniden kurulur; sahibi tur sonuna kadar gizlidir. */
export function VotingScreen({ room, me }: Props) {
  const { showToast } = useToast();
  const [meme, setMeme] = useState<VoteMeme | null>(null);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const spectating = me.active_from_round > room.current_round;

  const secondsLeft = useSecondsLeft(room.phase_ends_at);
  useAdvanceWhenDue(secondsLeft, GRACE_SECONDS);

  useEffect(() => {
    let active = true;
    const load = () =>
      getSupabaseClient()
        .rpc("get_current_vote_meme")
        .then(({ data }) => {
          if (!active || !data) return;
          const next = data as unknown as VoteMeme;
          setMeme(next);
          setMyRating((current) => current ?? next.my_rating);
        });
    void load();
    const timer = window.setInterval(load, PROGRESS_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [room.phase_ends_at]);

  async function vote(rating: Rating) {
    const previous = myRating;
    setMyRating(rating);
    const { error } = await getSupabaseClient().rpc("cast_vote", {
      p_rating: rating,
    });
    if (error) {
      setMyRating(previous);
      showToast(errorMessage(error), "error");
    }
  }

  if (!meme) {
    return (
      <p className="animate-pulse py-10 font-extrabold text-ink-soft">
        {strings.common.loading}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4" data-testid="voting">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-grape px-3 py-1 text-sm font-black text-white">
          {strings.voting.progress(meme.index, meme.total)}
        </span>
        <span
          data-testid="countdown"
          className={cn(
            "font-meme text-4xl tabular-nums",
            (secondsLeft ?? 0) <= 10 ? "animate-pulse text-coral" : "text-ink",
          )}
        >
          {Math.max(0, Math.ceil(secondsLeft ?? 0))}
        </span>
        <span className="text-sm font-extrabold text-ink-soft">
          {strings.voting.votesCast(meme.votes_cast, meme.voters)}
        </span>
      </div>

      <BoxEditor
        imageUrl={templateUrl(meme.template)}
        width={meme.template.width}
        height={meme.template.height}
        boxes={toBoxes(meme.boxes)}
      />
      <DownloadButton
        meme={{ template: meme.template, boxes: toBoxes(meme.boxes) }}
        round={room.current_round}
        label={`meme${meme.index}`}
      />

      {meme.is_mine || spectating ? (
        <Card className="text-center font-extrabold text-ink-soft">
          {meme.is_mine ? strings.voting.yours : strings.voting.spectating}
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-center text-xl font-black">
            {strings.voting.question}
          </h2>
          {RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              aria-pressed={myRating === rating}
              onClick={() => void vote(rating)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl px-5 text-lg font-black transition-transform active:translate-y-[5px] active:shadow-none",
                RATING_STYLE[rating].color,
                RATING_STYLE[rating].shadow,
                myRating === rating &&
                  "ring-4 ring-grape ring-offset-2 ring-offset-cream",
                myRating && myRating !== rating && "opacity-60",
              )}
            >
              <span aria-hidden className="text-2xl">
                {RATING_STYLE[rating].emoji}
              </span>
              <span className="flex-1 text-left">
                {strings.ratings[rating]}
              </span>
              <span className="tabular-nums">
                {formatPoints(RATING_POINTS[rating])}
              </span>
            </button>
          ))}
          {myRating && (
            <p className="text-center text-sm font-bold text-mint-dark">
              {strings.voting.voted}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
