import * as chrono from "chrono-node";
import { TAG_PALETTE } from "@/lib/types";
import type { Tag } from "@/lib/schemas";
import { iso, defaultNoteTitle } from "@/lib/date";

export type ParseResult = {
  title: string;
  tagIds: string[];
  pills: { name: string; color: string; isNew?: boolean }[];
  newTagNames: string[];
  due: string | null;
  dateLabel: string | null;
  priority: "low" | "med" | "high";
};

export type NoteParseResult = {
  title: string;
  body: string;
  tagIds: string[];
  newTagNames: string[];
};

type ParseOptions = {
  /** Skip date/priority parsing — for note capture */
  forNote?: boolean;
};

export function parseOmni(
  text: string,
  tags: Tag[],
  referenceDate: Date = new Date(),
  options?: ParseOptions
): ParseResult {
  let title = text;
  const tagIds: string[] = [];
  const pills: ParseResult["pills"] = [];

  const tagMatches = [...text.matchAll(/#([a-z0-9][\w-]*)/gi)];
  for (const m of tagMatches) {
    const name = m[1].toLowerCase();
    const existing = tags.find((t) => t.name === name);
    if (existing) {
      if (!tagIds.includes(existing.id)) {
        tagIds.push(existing.id);
        pills.push({ name: existing.name, color: existing.color });
      }
    } else {
      const color =
        TAG_PALETTE[(tags.length + pills.length) % TAG_PALETTE.length];
      pills.push({ name, color, isNew: true });
    }
  }
  title = title.replace(/#([a-z0-9][\w-]*)/gi, "").replace(/\s+/g, " ").trim();

  let priority: "low" | "med" | "high" = "med";
  if (!options?.forNote) {
    const pm = text.match(/!(high|med|low|h|m|l)\b/i);
    if (pm) {
      const x = pm[1].toLowerCase();
      priority = x[0] === "h" ? "high" : x[0] === "l" ? "low" : "med";
      title = title
        .replace(/!(high|med|low|h|m|l)\b/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  let due: string | null = null;
  let dateLabel: string | null = null;
  if (!options?.forNote) {
    const parsed = chrono.parse(text, referenceDate, { forwardDate: true });
    if (parsed.length > 0) {
      const result = parsed[0];
      const dd = result.start.date();
      const hasTime = result.start.isCertain("hour");
      due =
        iso(dd) +
        (hasTime ? `T${String(dd.getHours()).padStart(2, "0")}:00` : "");
      const label = result.text.trim();
      dateLabel = label.charAt(0).toUpperCase() + label.slice(1);
      title = title.replace(result.text, "").replace(/\s+/g, " ").trim();
    }
  }

  const newTagNames = pills.filter((p) => p.isNew).map((p) => p.name);

  return {
    title: title || text.trim(),
    tagIds,
    pills,
    newTagNames,
    due,
    dateLabel,
    priority,
  };
}

/**
 * Note capture: `Title: body` sets both; otherwise body only with a timestamped title.
 */
export function parseNoteCapture(
  text: string,
  tags: Tag[],
  referenceDate: Date = new Date()
): NoteParseResult {
  const p = parseOmni(text, tags, referenceDate, { forNote: true });
  const cleaned = p.title.trim();
  const colonIdx = cleaned.indexOf(":");

  if (colonIdx > 0) {
    const noteTitle = cleaned.slice(0, colonIdx).trim();
    const body = cleaned.slice(colonIdx + 1).trim();
    if (noteTitle) {
      return {
        title: noteTitle,
        body,
        tagIds: p.tagIds,
        newTagNames: p.newTagNames,
      };
    }
  }

  return {
    title: defaultNoteTitle(referenceDate),
    body: cleaned,
    tagIds: p.tagIds,
    newTagNames: p.newTagNames,
  };
}

export function defaultDue(
  parsedDue: string | null,
  defaultDueToday: boolean,
  today: string = iso()
): string | null {
  if (parsedDue) return parsedDue;
  if (defaultDueToday) return today;
  return null;
}

export function tagBg(color: string): string {
  if (color.startsWith("#")) return "var(--chip)";
  return color.replace(")", " / 0.12)");
}

export function toggleTagInText(text: string, tagName: string): string {
  const pattern = new RegExp(`#${tagName}\\b`, "gi");
  if (pattern.test(text)) {
    return text.replace(pattern, "").replace(/\s+/g, " ").trim();
  }
  const trimmed = text.trim();
  return trimmed ? `${trimmed} #${tagName}` : `#${tagName}`;
}
