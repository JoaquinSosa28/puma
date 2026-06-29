import * as memory from "./memory/projects";
import * as mongo from "./mongo/projects";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const {
  listProjects,
  getProject,
  insertProject,
  updateProject,
  deleteProject,
} = impl;
