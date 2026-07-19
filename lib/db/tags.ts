import { cache } from "react";
import * as memory from "./memory/tags";
import * as mongo from "./mongo/tags";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listTags = cache(impl.listTags);
export const getTagByName = cache(impl.getTagByName);
export const insertTag = impl.insertTag;
export const updateTag = impl.updateTag;
export const deleteTag = impl.deleteTag;
export const ensureTags = impl.ensureTags;
export const ensureDefaultTag = impl.ensureDefaultTag;
