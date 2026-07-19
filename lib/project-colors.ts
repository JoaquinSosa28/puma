export const PROJECT_COLORS = [
  "oklch(0.64 0.18 25)",
  "oklch(0.58 0.14 245)",
  "oklch(0.55 0.16 274)",
  "oklch(0.58 0.17 300)",
  "oklch(0.6 0.13 155)",
  "oklch(0.7 0.12 70)",
] as const;

export function pickProjectColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((p) => p.color));
  const unused = PROJECT_COLORS.find((c) => !used.has(c));
  return unused ?? PROJECT_COLORS[existing.length % PROJECT_COLORS.length];
}
