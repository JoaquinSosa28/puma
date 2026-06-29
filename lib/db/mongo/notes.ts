import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Note, noteSchema } from "@/lib/schemas";
import type { NoteDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<NoteDoc>("notes");
}

export async function listNotes(userId = getCurrentUserId()): Promise<Note[]> {
  const c = await col();
  // createdAt desc approximates the memory store's unshift (newest first).
  const docs = await c.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map((n) => toDto(noteSchema.parse(n)));
}

export async function getNote(id: string): Promise<Note | null> {
  const c = await col();
  const doc = await c.findOne({ _id: id });
  return doc ? toDto(noteSchema.parse(doc)) : null;
}

export async function insertNote(
  doc: Omit<NoteDoc, "_id"> & { _id?: string }
): Promise<Note> {
  const c = await col();
  const full = { ...doc, _id: doc._id ?? newId() } as NoteDoc;
  await c.insertOne(full);
  return toDto(noteSchema.parse(full));
}

export async function updateNote(
  id: string,
  patch: Partial<NoteDoc>
): Promise<Note | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(noteSchema.parse(doc)) : null;
}

export async function deleteNote(id: string): Promise<boolean> {
  const c = await col();
  await c.deleteOne({ _id: id });
  return true;
}
