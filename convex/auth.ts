// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

// Password provider (spec §9–§11): employee accounts for velcenter log in with
// email/employee-id + password. Passwords are stored ONLY as scrypt hashes by
// the auth library (Lucia) — never plaintext, never reversible, and the
// company can never view an existing password. HR only ever sees a one-time
// temporary credential shown at creation/reset time (see convex/employeeAuth.ts).
const passwordProvider = Password({
  id: "password",
  // Server-side minimum: 8 chars with a letter and a digit (same policy as
  // backend/passwords.ts validatePasswordStrength, enforced again at sign-up).
  validatePasswordRequirements(password: string) {
    if (password.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (!/[a-zA-Z]/.test(password)) throw new Error("รหัสผ่านต้องมีตัวอักษร");
    if (!/[0-9]/.test(password)) throw new Error("รหัสผ่านต้องมีตัวเลข");
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, passwordProvider],
});