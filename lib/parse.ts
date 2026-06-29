import * as chrono from "chrono-node";
import type { Tag } from "@/lib/schemas";
import { iso, defaultNoteTitle, fakeLocalFromTz } from "@/lib/date";
import { getDefaultTimezone } from "@/lib/timezone";

/** Preview color for #tags that do not exist yet (created on save). */
export const NEW_TAG_PREVIEW_COLOR = "oklch(0.58 0.06 265)";

export type ParseResult = {
  title: string;
  tagIds: string[];
  pills: { name: string; color: string; isNew?: boolean }[];
  pendingTag: { name: string; color: string; isNew: boolean } | null;
  newTagNames: string[];
  due: string | null;
  dateLabel: string | null;
  priority: "low" | "med" | "high";
  hasPriorityToken: boolean;
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
  referenceDate?: Date,
  options?: ParseOptions,
  timeZone?: string
): ParseResult {
  const tz = timeZone ?? getDefaultTimezone();
  const ref = referenceDate ?? fakeLocalFromTz(new Date(), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
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
      pills.push({ name, color: NEW_TAG_PREVIEW_COLOR, isNew: true });
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
    const parsed = chrono.parse(text, ref, { forwardDate: true });
    if (parsed.length > 0) {
      const result = parsed[0];
      const dd = result.start.date();
      const hasTime = result.start.isCertain("hour");
      const datePart = `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
      due =
        datePart +
        (hasTime ? `T${pad(dd.getHours())}:${pad(dd.getMinutes())}` : "");
      const label = result.text.trim();
      dateLabel = label.charAt(0).toUpperCase() + label.slice(1);
      title = title.replace(result.text, "").replace(/\s+/g, " ").trim();
    }
  }

  const newTagNames = pills.filter((p) => p.isNew).map((p) => p.name);

  let pendingTag: ParseResult["pendingTag"] = null;
  const pendingMatch = text.match(/#([a-z0-9][\w-]*)$/i);
  if (pendingMatch) {
    const name = pendingMatch[1].toLowerCase();
    if (!pills.some((p) => p.name === name)) {
      const existing = tags.find((t) => t.name === name);
      pendingTag = existing
        ? { name: existing.name, color: existing.color, isNew: false }
        : { name, color: NEW_TAG_PREVIEW_COLOR, isNew: true };
    }
  }

  const hasPriorityToken = /!(high|med|low|h|m|l)\b/i.test(text);

  return {
    title: title || text.trim(),
    tagIds,
    pills,
    pendingTag,
    newTagNames,
    due,
    dateLabel,
    priority,
    hasPriorityToken,
  };
}

/**
 * Note capture: `Title: body` sets both; otherwise body only with a timestamped title.
 */
export function parseNoteCapture(
  text: string,
  tags: Tag[],
  referenceDate?: Date,
  timeZone?: string
): NoteParseResult {
  const p = parseOmni(text, tags, referenceDate, { forNote: true }, timeZone);
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
    title: defaultNoteTitle(referenceDate ?? fakeLocalFromTz(new Date(), timeZone ?? getDefaultTimezone()), timeZone),
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

export type OmniInputToken =
  | { kind: "text"; text: string }
  | {
      kind: "tag";
      text: string;
      name: string;
      color: string;
      isNew: boolean;
    }
  | { kind: "priority"; text: string; level: "low" | "med" | "high" };

/** Split omnibar text into plain text + inline #tag / !prio tokens for overlay rendering. */
export function tokenizeOmniInput(
  text: string,
  tags: Tag[],
  options?: { showTags?: boolean; showPriority?: boolean }
): OmniInputToken[] {
  const showTags = options?.showTags !== false;
  const showPriority = options?.showPriority !== false;

  type Match = { start: number; end: number; token: OmniInputToken };
  const matches: Match[] = [];

  if (showTags) {
    for (const m of text.matchAll(/#([a-z0-9][\w-]*)/gi)) {
      if (m.index === undefined) continue;
      const name = m[1].toLowerCase();
      const existing = tags.find((t) => t.name === name);
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: {
          kind: "tag",
          text: m[0],
          name,
          color: existing?.color ?? NEW_TAG_PREVIEW_COLOR,
          isNew: !existing,
        },
      });
    }
  }

  if (showPriority) {
    for (const m of text.matchAll(/!(high|med|low|h|m|l)\b/gi)) {
      if (m.index === undefined) continue;
      const x = m[1].toLowerCase();
      const level: "low" | "med" | "high" =
        x[0] === "h" ? "high" : x[0] === "l" ? "low" : "med";
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: { kind: "priority", text: m[0], level },
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: OmniInputToken[] = [];
  let cursor = 0;
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start < lastEnd) continue;
    if (m.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, m.start) });
    }
    segments.push(m.token);
    cursor = m.end;
    lastEnd = m.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments.length ? segments : text ? [{ kind: "text", text }] : [];
}
