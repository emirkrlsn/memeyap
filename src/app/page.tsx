import { SessionStatus } from "@/components/SessionStatus";
import { Card } from "@/components/ui/Card";
import { strings } from "@/lib/strings";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="animate-pop-in font-meme text-6xl tracking-wide text-white uppercase [-webkit-text-stroke:3px_var(--color-ink)] [paint-order:stroke_fill] [text-shadow:5px_5px_0_var(--color-grape)] sm:text-7xl">
          {strings.app.name}
        </h1>
        <p className="text-lg font-bold text-ink-soft">{strings.app.tagline}</p>
      </div>

      <Card className="flex w-full flex-col items-center gap-4 text-center">
        <p className="text-lg font-extrabold">{strings.home.comingSoon}</p>
        <SessionStatus />
      </Card>
    </main>
  );
}
