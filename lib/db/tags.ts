import * as memory from "./memory/tags";
import * as mongo from "./mongo/tags";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { listTags, getTagByName, insertTag, ensureTags } = impl;
