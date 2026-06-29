import { cache } from "react";
import * as memory from "./memory/users";
import * as mongo from "./mongo/users";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const getCurrentUser = cache(impl.getCurrentUser);
export const updateUser = impl.updateUser;
export { DEFAULT_USER_NAME, displayName } from "@/lib/user-display";
