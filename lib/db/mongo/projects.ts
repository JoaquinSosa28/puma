import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Project, projectSchema } from "@/lib/schemas";
import type { ProjectDoc, TaskDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<ProjectDoc>("projects");
}

export async function listProjects(
  userId = getCurrentUserId()
): Promise<Project[]> {
  const c = await col();
  // createdAt desc approximates the memory store's unshift (newest first).
  const docs = await c.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map((p) => toDto(projectSchema.parse(p)));
}

export async function getProject(id: string): Promise<Project | null> {
  const c = await col();
  const doc = await c.findOne({ _id: id });
  return doc ? toDto(projectSchema.parse(doc)) : null;
}

export async function insertProject(
  doc: Omit<ProjectDoc, "_id"> & { _id?: string }
): Promise<Project> {
  const c = await col();
  const full = { ...doc, _id: doc._id ?? newId() } as ProjectDoc;
  await c.insertOne(full);
  return toDto(projectSchema.parse(full));
}

export async function updateProject(
  id: string,
  patch: Partial<ProjectDoc>
): Promise<Project | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(projectSchema.parse(doc)) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const c = await col();
  const db = await getDb();
  // Detach tasks from the project, then remove it (no transaction, sequential).
  await db
    .collection<TaskDoc>("tasks")
    .updateMany({ projectId: id }, { $set: { projectId: null } });
  const res = await c.deleteOne({ _id: id });
  return res.deletedCount > 0;
}
