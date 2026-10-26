import { cn } from "@/lib/cn";

type Props = {
  label: string;
  options: readonly number[];
  value: number;
  format?: (value: number) => string;
  /** Verilmezse salt okunur gösterilir. */
  onChange?: (value: number) => void;
};

/** Birkaç seçenekten birini seçmek için büyük, dokunmaya uygun düğme grubu. */
export function Segmented({
  label,
  options,
  value,
  format = String,
  onChange,
}: Props) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-extrabold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={!onChange}
              onClick={() => onChange?.(option)}
              className={cn(
                "min-h-11 min-w-12 flex-1 rounded-xl border-[3px] px-3 font-extrabold transition-colors",
                selected
                  ? "border-ink bg-sun text-ink"
                  : "border-ink/15 bg-white text-ink-soft",
                onChange ? "hover:border-ink/40" : "cursor-default",
                !onChange && !selected && "opacity-50",
              )}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
