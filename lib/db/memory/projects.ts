import { getStore, getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Project, projectSchema } from "@/lib/schemas";

export async function listProjects(
  userId = getCurrentUserId()
): Promise<Project[]> {
  const store = getStore();
  return store.projects
    .filter((p) => p.userId === userId)
    .map((p) => toDto(projectSchema.parse(p)));
}

export async function getProject(id: string): Promise<Project | null> {
  const store = getStore();
  const doc = store.projects.find((p) => p._id === id);
  return doc ? toDto(projectSchema.parse(doc)) : null;
}

export async function insertProject(
  doc: Omit<import("@/lib/schemas").ProjectDoc, "_id"> & { _id?: string }
): Promise<Project> {
  const store = getStore();
  const full = { ...doc, _id: doc._id ?? newId() };
  store.projects.unshift(full as import("@/lib/schemas").ProjectDoc);
  return toDto(projectSchema.parse(full));
}

export async function updateProject(
  id: string,
  patch: Partial<import("@/lib/schemas").ProjectDoc>
): Promise<Project | null> {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p._id === id);
  if (idx < 0) return null;
  store.projects[idx] = { ...store.projects[idx], ...patch };
  return toDto(projectSchema.parse(store.projects[idx]));
}

export async function deleteProject(id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p._id === id);
  if (idx < 0) return false;
  for (const task of store.tasks) {
    if (task.projectId === id) task.projectId = null;
  }
  store.projects.splice(idx, 1);
  return true;
}
