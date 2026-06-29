import type { SeedData } from "@/lib/seed";
import { createSeedData } from "@/lib/seed";
import { oid } from "@/lib/date";

export type MemoryStore = SeedData & { seeded: boolean };

const globalForStore = globalThis as unknown as {
  __pumaStore?: MemoryStore;
};

const SEED_USER_ID = "seed-user-alex";

export function getStore(): MemoryStore {
  if (!globalForStore.__pumaStore) {
    const seed = createSeedData(SEED_USER_ID);
    globalForStore.__pumaStore = { ...seed, seeded: true };
  }
  return globalForStore.__pumaStore;
}

export function resetStore(): MemoryStore {
  const seed = createSeedData(SEED_USER_ID);
  globalForStore.__pumaStore = { ...seed, seeded: true };
  return globalForStore.__pumaStore;
}

export function getCurrentUserId(): string {
  return SEED_USER_ID;
}

export function newId(): string {
  return oid();
}
