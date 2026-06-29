import * as memory from "./memory/tasks";
import * as mongo from "./mongo/tasks";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const {
  listTasks,
  getTask,
  getTasksByDue,
  getCarryoverTasks,
  getTasksByProject,
  insertTask,
  updateTask,
  getRunningTimerTask,
  accumulateRunningTime,
  stopRunningTimers,
  deleteTask,
} = impl;
