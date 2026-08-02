import * as memory from "./memory/account";
import * as mongo from "./mongo/account";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const exportUserData = impl.exportUserData;
export const deleteAllUserData = impl.deleteAllUserData;
