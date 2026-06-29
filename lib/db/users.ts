import * as memory from "./memory/users";
import * as mongo from "./mongo/users";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { getCurrentUser, updateUser } = impl;
// Backend-agnostic helpers live in a driver-free module so client components can
// import them without pulling the data layer into the browser bundle.
export { DEFAULT_USER_NAME, displayName } from "@/lib/user-display";
