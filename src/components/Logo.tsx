import Link from "next/link";

import { cn } from "@/lib/cn";
import { strings } from "@/lib/strings";

/** Meme yazısı stilinde oyun adı. `small` başlıkta, büyük hâli ana sayfada kullanılır. */
export function Logo({ small = false }: { small?: boolean }) {
  const title = (
    <span
      className={cn(
        "font-meme tracking-wide text-white uppercase [paint-order:stroke_fill]",
        small
          ? "text-3xl [-webkit-text-stroke:2px_var(--color-ink)] [text-shadow:3px_3px_0_var(--color-grape)]"
          : "animate-pop-in text-6xl [-webkit-text-stroke:3px_var(--color-ink)] [text-shadow:5px_5px_0_var(--color-grape)] sm:text-7xl",
      )}
    >
      {strings.app.name}
    </span>
  );

  if (small) {
    return (
      <Link href="/" aria-label={strings.app.name}>
        {title}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1>{title}</h1>
      <p className="text-lg font-bold text-ink-soft">{strings.app.tagline}</p>
    </div>
  );
}
