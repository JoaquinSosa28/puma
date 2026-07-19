import { cache } from "react";
import * as memory from "./memory/tasks";
import * as mongo from "./mongo/tasks";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listTasks = cache(impl.listTasks);
export const getTask = cache(impl.getTask);
export const getTasksByDue = cache(impl.getTasksByDue);
export const getCarryoverTasks = cache(impl.getCarryoverTasks);
export const getTasksByProject = cache(impl.getTasksByProject);
export const getRunningTimerTask = cache(impl.getRunningTimerTask);
export const insertTask = impl.insertTask;
export const updateTask = impl.updateTask;
export const accumulateRunningTime = impl.accumulateRunningTime;
export const stopRunningTimers = impl.stopRunningTimers;
export const deleteTask = impl.deleteTask;
