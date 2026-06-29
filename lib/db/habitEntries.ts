import { cache } from "react";
import * as memory from "./memory/habitEntries";
import * as mongo from "./mongo/habitEntries";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listHabitEntries = cache(impl.listHabitEntries);
export const toggleHabitEntry = impl.toggleHabitEntry;
