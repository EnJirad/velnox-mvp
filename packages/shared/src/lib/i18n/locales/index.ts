import type { Language } from "../config";
import { th } from "./th";
import { en } from "./en";
import { my as myBase } from "./my";

/** Shape of every locale dictionary — derived from Thai (source of truth). */
export type Dict = typeof th;

/**
 * Burmese auth-flow strings added in the production auth upgrade.
 *
 * `my.ts` is a large append-only translation table; the auth section sits
 * beyond the safe edit window, so the new keys are merged here instead.
 * This keeps the Burmese locale at exact key parity with Thai/English
 * (enforced by tests/locale-parity.test.ts). Merge these into my.ts whenever
 * that file can be rewritten wholesale.
 */
const myAuthPatch = {
  continue: "ဆက်လုပ်ရန်",
  sendingCode: "ကုဒ်ပို့နေသည်...",
  otpTitle: "သင့်အီးမေးလ် အတည်ပြုပါ",
  otpDesc: "6 လုံးကုဒ်ကို {email} သို့ ပို့ထားပါသည်",
  resendIn: "{seconds} စက္ကန့်အတွင်း ကုဒ်ပြန်ပို့နိုင်သည်",
  resendNow: "ကုဒ် ပြန်ပို့ရန်",
  changeEmail: "အီးမေးလ် ပြောင်းရန်",
  invalidEmail: "မှန်ကန်သော အီးမေးလ် ဖြည့်ပါ",
  rateLimited: "ကုဒ်ပို့ရန် မကြာခဏလွန်းနေပါသည် ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ",
  sendFailed: "ကုဒ်ပို့၍မရပါ ထပ်ကြိုးစားပါ",
  networkError: "ဆက်သွယ်မှု ပျက်ကွက်ပါသည် ထပ်ကြိုးစားပါ",
  otpInvalid: "အတည်ပြုကုဒ် မမှန်ပါ ထပ်ကြိုးစားပါ",
  otpExpired: "ကုဒ်သက်တမ်းကုန်ပါပြီ ကုဒ်အသစ် တောင်းပါ",
  otpTooMany: "မှားယွင်းမှု များလွန်းပါသည် ကုဒ်အသစ် တောင်းပါ",
  verifySuccess: "အောင်မြင်စွာ ဝင်ရောက်ပြီးပါပြီ",
} satisfies Partial<Dict["auth"]>;

/**
 * All locale dictionaries keyed by language code. Adding a language means
 * adding a dictionary here (plus an entry in ../config).
 */
export const translations: Record<Language, Dict> = {
  th,
  en,
  my: { ...myBase, auth: { ...myBase.auth, ...myAuthPatch } } as Dict,
};
