"use client";

import { useEffect, useState } from "react";

import { BoxEditor } from "@/components/meme/BoxEditor";
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

/** get_current_vote_meme yanıtı. Oylama sırasında sahip bilgisi içermez. */
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
  reveal: {
    owner: string | null;
    points: number;
    distribution: Record<Rating, number>;
  } | null;
};

const RATING_STYLE: Record<Rating, { emoji: string; className: string }> = {
  cok_begenildi: {
    emoji: "🤣",
    className: "bg-mint text-white shadow-[0_5px_0_0_var(--color-mint-dark)]",
  },
  begenildi: {
    emoji: "😄",
    className: "bg-sky text-white shadow-[0_5px_0_0_var(--color-sky-dark)]",
  },
  fena_degil: {
    emoji: "🙂",
    className: "bg-sun text-ink shadow-[0_5px_0_0_var(--color-sun-dark)]",
  },
  begenilmedi: {
    emoji: "😕",
    className: "bg-coral text-white shadow-[0_5px_0_0_var(--color-coral-dark)]",
  },
  berbat: {
    emoji: "🤮",
    className: "bg-ink text-white shadow-[0_5px_0_0_#000]",
  },
};

/** Sunucu oylamayı süre bitiminden 2 sn sonra kapatır; açıklama tam süresinde biter. */
const VOTING_GRACE_SECONDS = 2.5;
const REVEAL_GRACE_SECONDS = 0.5;
/** Oylama sırasında "kaç kişi oy verdi" bilgisini tazeleme aralığı. */
const PROGRESS_REFRESH_MS = 3000;

type Props = { room: Room; me: Player };

/** Oylanan meme (voting) ve sahibinin açıklanması (reveal). Her meme için yeniden kurulur. */
export function VotingScreen({ room, me }: Props) {
  const { showToast } = useToast();
  const [meme, setMeme] = useState<VoteMeme | null>(null);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const isReveal = room.status === "reveal";
  const spectating = me.active_from_round > room.current_round;

  const secondsLeft = useSecondsLeft(room.phase_ends_at);
  useAdvanceWhenDue(
    secondsLeft,
    isReveal ? REVEAL_GRACE_SECONDS : VOTING_GRACE_SECONDS,
  );

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
    const timer = isReveal
      ? undefined
      : window.setInterval(load, PROGRESS_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isReveal, room.phase_ends_at]);

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
    <div
      className="flex w-full flex-col gap-4"
      data-testid={isReveal ? "reveal" : "voting"}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-grape px-3 py-1 text-sm font-black text-white">
          {strings.voting.progress(meme.index, meme.total)}
        </span>
        <span
          data-testid="countdown"
          className={cn(
            "font-meme text-4xl tabular-nums",
            !isReveal && (secondsLeft ?? 0) <= 10
              ? "animate-pulse text-coral"
              : "text-ink",
          )}
        >
          {Math.max(0, Math.ceil(secondsLeft ?? 0))}
        </span>
        {!isReveal && (
          <span className="text-sm font-extrabold text-ink-soft">
            {strings.voting.votesCast(meme.votes_cast, meme.voters)}
          </span>
        )}
      </div>

      <BoxEditor
        imageUrl={templateUrl(meme.template)}
        width={meme.template.width}
        height={meme.template.height}
        boxes={toBoxes(meme.boxes)}
      />

      {isReveal && meme.reveal ? (
        <Reveal reveal={meme.reveal} />
      ) : meme.is_mine || spectating ? (
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
                RATING_STYLE[rating].className,
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

function Reveal({ reveal }: { reveal: NonNullable<VoteMeme["reveal"]> }) {
  const total = Math.max(
    1,
    ...RATINGS.map((rating) => reveal.distribution[rating]),
  );
  return (
    <Card className="flex animate-pop-in flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-ink-soft">
            {strings.voting.owner}
          </p>
          <p
            className="truncate text-2xl font-black"
            data-testid="reveal-owner"
          >
            {reveal.owner ?? strings.voting.unknownOwner}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold text-ink-soft">
            {strings.voting.points}
          </p>
          <p
            data-testid="reveal-points"
            className={cn(
              "font-meme text-4xl",
              reveal.points > 0
                ? "text-mint-dark"
                : reveal.points < 0
                  ? "text-coral-dark"
                  : "text-ink",
            )}
          >
            {formatPoints(reveal.points)}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5" data-testid="distribution">
        {RATINGS.map((rating) => (
          <li
            key={rating}
            className="flex items-center gap-2 text-sm font-extrabold"
          >
            <span aria-hidden>{RATING_STYLE[rating].emoji}</span>
            <span className="w-28 shrink-0">{strings.ratings[rating]}</span>
            <span className="h-4 flex-1 overflow-hidden rounded-full bg-ink/10">
              <span
                className={cn(
                  "block h-full rounded-full",
                  RATING_STYLE[rating].className,
                )}
                style={{
                  width: `${(reveal.distribution[rating] / total) * 100}%`,
                }}
              />
            </span>
            <span className="w-12 text-right tabular-nums" data-rating={rating}>
              {strings.voting.votes(reveal.distribution[rating])}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
