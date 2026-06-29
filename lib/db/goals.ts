import * as memory from "./memory/goals";
import * as mongo from "./mongo/goals";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const {
  nextGoalOrder,
  listGoals,
  insertGoal,
  updateGoal,
  updateGoalsLayout,
} = impl;
