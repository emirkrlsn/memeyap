import { notFound } from "next/navigation";

import { TemplateBoxesTool } from "@/components/meme/TemplateBoxesTool";

/** Şablonların varsayılan yazı kutularını tanımlama aracı. Sadece `npm run dev` ile açılır. */
export default function TemplateBoxesPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TemplateBoxesTool />;
}
