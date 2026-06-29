import { getStore, getCurrentUserId } from "@/lib/store/memory";
import { newId } from "@/lib/store/memory";
import { toDto, type Note, noteSchema } from "@/lib/schemas";

export async function listNotes(userId = getCurrentUserId()): Promise<Note[]> {
  const store = getStore();
  return store.notes
    .filter((n) => n.userId === userId)
    .map((n) => toDto(noteSchema.parse(n)));
}

export async function getNote(id: string): Promise<Note | null> {
  const store = getStore();
  const doc = store.notes.find((n) => n._id === id);
  return doc ? toDto(noteSchema.parse(doc)) : null;
}

export async function insertNote(
  doc: Omit<import("@/lib/schemas").NoteDoc, "_id"> & { _id?: string }
): Promise<Note> {
  const store = getStore();
  const full = { ...doc, _id: doc._id ?? newId() };
  store.notes.unshift(full as import("@/lib/schemas").NoteDoc);
  return toDto(noteSchema.parse(full));
}

export async function updateNote(
  id: string,
  patch: Partial<import("@/lib/schemas").NoteDoc>
): Promise<Note | null> {
  const store = getStore();
  const idx = store.notes.findIndex((n) => n._id === id);
  if (idx < 0) return null;
  store.notes[idx] = { ...store.notes[idx], ...patch };
  return toDto(noteSchema.parse(store.notes[idx]));
}

export async function deleteNote(id: string): Promise<boolean> {
  const store = getStore();
  store.notes = store.notes.filter((n) => n._id !== id);
  return true;
}
