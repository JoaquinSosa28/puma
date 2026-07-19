import { getDb } from "@/lib/mongodb";
import { newId } from "@/lib/store/memory";
import { toDto, type AgendaItem, agendaItemSchema } from "@/lib/schemas";
import type { AgendaItemDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<AgendaItemDoc>("agenda");
}

export async function listAgenda(userId: string): Promise<AgendaItem[]> {
  const c = await col();
  const docs = await c.find({ userId }).toArray();
  return docs.map((a) => toDto(agendaItemSchema.parse(a)));
}

export async function insertAgendaItem(
  doc: Omit<AgendaItemDoc, "_id"> & { _id?: string }
): Promise<AgendaItem> {
  const c = await col();
  const full = agendaItemSchema.parse({ ...doc, _id: doc._id ?? newId() });
  await c.insertOne(full);
  return toDto(full);
}

export async function deleteAgendaItem(
  userId: string,
  id: string
): Promise<boolean> {
  const c = await col();
  const res = await c.deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}
