import { getDb } from "@/lib/mongodb";
import { getCurrentUserId } from "@/lib/store/memory";
import { toDto, type AgendaItem, agendaItemSchema } from "@/lib/schemas";
import type { AgendaItemDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<AgendaItemDoc>("agenda");
}

export async function listAgenda(
  userId = getCurrentUserId()
): Promise<AgendaItem[]> {
  const c = await col();
  const docs = await c.find({ userId }).toArray();
  return docs.map((a) => toDto(agendaItemSchema.parse(a)));
}
