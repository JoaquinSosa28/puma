import { cache } from "react";
import * as memory from "./memory/notes";
import * as mongo from "./mongo/notes";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const listNotes = cache(impl.listNotes);
export const getNote = cache(impl.getNote);
export const insertNote = impl.insertNote;
export const updateNote = impl.updateNote;
export const deleteNote = impl.deleteNote;
