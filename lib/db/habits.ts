import * as memory from "./memory/habits";
import * as mongo from "./mongo/habits";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { listHabits, insertHabit, updateHabit } = impl;
