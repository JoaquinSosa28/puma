import * as memory from "./memory/life-weeks";
import * as mongo from "./mongo/life-weeks";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const {
  listLifeWeeks,
  getLifeWeek,
  upsertLifeWeek,
  removeLifeWeeksByDates,
} = impl;
