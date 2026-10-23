/** Koşullu sınıf adlarını tek bir `className` dizgisinde birleştirir. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
