import * as memory from "./memory/settings";
import * as mongo from "./mongo/settings";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { getSettings, updateSettings } = impl;
