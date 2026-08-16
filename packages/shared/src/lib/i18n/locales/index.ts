import type { Language } from "../config";
import { th } from "./th";
import { en } from "./en";
import { my } from "./my";

/** Shape of every locale dictionary — derived from Thai (source of truth). */
export type Dict = typeof th;

/**
 * All locale dictionaries keyed by language code. Adding a language means
 * adding a dictionary here (plus an entry in ../config).
 */
export const translations: Record<Language, Dict> = { th, en, my };
