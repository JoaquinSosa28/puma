import { getStore, getCurrentUserId } from "@/lib/store/memory";
import { toDto, type AgendaItem, agendaItemSchema } from "@/lib/schemas";

export async function listAgenda(
  userId = getCurrentUserId()
): Promise<AgendaItem[]> {
  const store = getStore();
  return store.agenda
    .filter((a) => a.userId === userId)
    .map((a) => toDto(agendaItemSchema.parse(a)));
}
