import { cache } from "react";
import * as memory from "./memory/goals";
import * as mongo from "./mongo/goals";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listGoals = cache(impl.listGoals);
export const nextGoalOrder = impl.nextGoalOrder;
export const insertGoal = impl.insertGoal;
export const updateGoal = impl.updateGoal;
export const deleteGoal = impl.deleteGoal;
export const updateGoalsLayout = impl.updateGoalsLayout;
