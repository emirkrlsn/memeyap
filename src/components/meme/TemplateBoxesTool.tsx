"use client";

import { useEffect, useState } from "react";

import { BoxEditor } from "@/components/meme/BoxEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { MAX_BOXES, type Box } from "@/lib/meme/render";
import {
  DEFAULT_TEMPLATE_BOXES,
  NEW_BOX,
  templateUrl,
  toBoxes,
  type Template,
} from "@/lib/meme/templates";
import { strings } from "@/lib/strings";
import { ensureAnonymousSession } from "@/lib/supabase/auth";
import { getSupabaseClient } from "@/lib/supabase/client";

type Filter = "all" | "todo" | "done";

const isDefault = (template: Template) =>
  JSON.stringify(toBoxes(template.default_boxes).map(frameOnly)) ===
  JSON.stringify(DEFAULT_TEMPLATE_BOXES.map(frameOnly));

function frameOnly({ x, y, w, h }: Box) {
  return { x, y, w, h };
}

function withSampleText(boxes: Box[]): Box[] {
  return boxes.map((box, index) => ({
    ...box,
    text: strings.devTools.sample(index + 1),
  }));
}

export function TemplateBoxesTool() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [current, setCurrent] = useState<Template | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    ensureAnonymousSession()
      .then(() =>
        getSupabaseClient()
          .from("templates")
          .select("*")
          .eq("is_active", true)
          .order("source_name"),
      )
      .then(({ data }) => setTemplates(data ?? []));
  }, []);

  const shown = templates.filter(
    (t) => filter === "all" || (filter === "todo") === isDefault(t),
  );

  function open(template: Template) {
    setCurrent(template);
    setBoxes(withSampleText(toBoxes(template.default_boxes)));
    setSelected(null);
  }

  async function save(goNext: boolean) {
    if (!current) return;
    const frames = boxes.map(frameOnly);
    const response = await fetch("/dev/kutular/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceName: current.source_name, boxes: frames }),
    });
    if (!response.ok) {
      showToast(strings.errors.INVALID_BOXES, "error");
      return;
    }
    showToast(strings.devTools.saved, "success");
    const updated = { ...current, default_boxes: frames };
    setTemplates((all) => all.map((t) => (t.id === updated.id ? updated : t)));

    const index = shown.findIndex((t) => t.id === current.id);
    const next = shown.slice(index + 1).find((t) => t.id !== current.id);
    if (goNext && next) open(next);
    else setCurrent(updated);
  }

  async function copyJson() {
    if (!current) return;
    const json = JSON.stringify(
      { [current.source_name]: boxes.map(frameOnly) },
      null,
      2,
    );
    await navigator.clipboard.writeText(json);
    showToast(strings.devTools.copied, "success");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black">{strings.devTools.title}</h1>
        <p className="font-bold text-ink-soft">{strings.devTools.intro}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["todo", "done", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border-[3px] px-4 py-1 font-extrabold",
                  filter === value
                    ? "border-ink bg-sun"
                    : "border-ink/15 bg-white",
                )}
              >
                {
                  {
                    todo: strings.devTools.filterTodo,
                    done: strings.devTools.filterDone,
                    all: strings.devTools.filterAll,
                  }[value]
                }
              </button>
            ))}
            <span className="ml-auto text-sm font-bold text-ink-soft">
              {strings.devTools.count(shown.length, templates.length)}
            </span>
          </div>
          <div className="max-h-[75vh] overflow-y-auto rounded-2xl bg-white/60 p-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {shown.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  title={template.source_name}
                  onClick={() => open(template)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border-[3px] bg-ink",
                    current?.id === template.id
                      ? "border-grape"
                      : "border-transparent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={templateUrl(template)}
                    alt={template.source_name}
                    loading="lazy"
                    className="size-full object-contain"
                  />
                  {!isDefault(template) && (
                    <span className="absolute top-1 right-1 rounded-full bg-mint px-1.5 text-xs font-black text-white">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {current && (
          <Card className="flex h-fit flex-col gap-3 lg:sticky lg:top-6">
            <p
              className="truncate text-sm font-bold text-ink-soft"
              title={current.source_name}
            >
              {current.source_name} · {current.width}×{current.height}
              {current.kind === "gif" && " · GIF"}
            </p>
            <BoxEditor
              imageUrl={templateUrl(current)}
              width={current.width}
              height={current.height}
              boxes={boxes}
              onChange={setBoxes}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={boxes.length >= MAX_BOXES}
                onClick={() => setBoxes(withSampleText([...boxes, NEW_BOX]))}
              >
                {strings.game.addBox}
              </Button>
              {selected !== null && selected < boxes.length && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setBoxes(
                      withSampleText(boxes.filter((_, i) => i !== selected)),
                    );
                    setSelected(null);
                  }}
                >
                  {strings.game.removeBox(selected + 1)}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setBoxes(withSampleText(DEFAULT_TEMPLATE_BOXES))}
              >
                {strings.devTools.reset}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="success" onClick={() => save(true)}>
                {strings.devTools.saveAndNext}
              </Button>
              <Button variant="secondary" onClick={() => save(false)}>
                {strings.devTools.save}
              </Button>
              <Button variant="ghost" onClick={copyJson}>
                {strings.devTools.copyJson}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
