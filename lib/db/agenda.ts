import { cache } from "react";
import * as memory from "./memory/agenda";
import * as mongo from "./mongo/agenda";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listAgenda = cache(impl.listAgenda);
