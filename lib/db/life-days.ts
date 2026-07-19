import * as memory from "./memory/life-days";
import * as mongo from "./mongo/life-days";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { listLifeDays, getLifeDay, upsertLifeDay } = impl;
