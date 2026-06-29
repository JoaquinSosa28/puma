"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { getCurrentUserId } from "@/lib/store/memory";
import { userToday } from "@/lib/timezone-server";
import {
  insertNote,
  updateNote,
  deleteNote,
  getNote,
} from "@/lib/db/notes";
import { insertTask } from "@/lib/db/tasks";

export async function createNote(): Promise<ActionResult<{ id: string }>> {
  const userId = getCurrentUserId();
  const { today: td } = await userToday();
  const note = await insertNote({
    userId,
    title: "Untitled note",
    body: "",
    tagIds: [],
    pinned: false,
    lifeArea: "personal",
    createdAt: td,
    updatedAt: td,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: note.id } };
}

export async function updateNoteAction(
  id: string,
  field: "title" | "body",
  value: string
): Promise<ActionResult> {
  const { today: td } = await userToday();
  await updateNote(id, { [field]: value, updatedAt: td });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleNotePin(id: string): Promise<ActionResult> {
  const note = await getNote(id);
  if (!note) return { ok: false, error: "Not found" };
  await updateNote(id, { pinned: !note.pinned });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteNoteAction(id: string): Promise<ActionResult> {
  const note = await getNote(id);
  if (!note) return { ok: false, error: "Not found" };
  await deleteNote(id);
  revalidatePath("/", "layout");
  return {
    ok: true,
    undo: { type: "delete", entity: "note", snapshot: note },
  };
}

export async function convertNoteToTask(id: string): Promise<ActionResult> {
  const note = await getNote(id);
  if (!note) return { ok: false, error: "Not found" };
  const userId = getCurrentUserId();
  const { today: td } = await userToday();
  await insertTask({
    userId,
    title: note.title,
    tagIds: note.tagIds,
    priority: "med",
    status: "todo",
    due: td,
    projectId: null,
    goalId: null,
    lifeArea: note.lifeArea,
    order: -Date.now(),
    createdAt: td,
    completedAt: null,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
