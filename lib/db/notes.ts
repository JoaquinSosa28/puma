import * as memory from "./memory/notes";
import * as mongo from "./mongo/notes";

const impl = process.env.DATA_SOURCE === "mongodb" ? mongo : memory;

export const { listNotes, getNote, insertNote, updateNote, deleteNote } = impl;
