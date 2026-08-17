import { Button } from "@velnox/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@velnox/shared/components/ui/card";
import { Input } from "@velnox/shared/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@velnox/shared/components/ui/input-otp";

import { Logo } from "@velnox/shared/components/Logo";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import { useLanguage } from "@velnox/shared/lib/i18n";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import {
  OTP_MAX_AGE_MS,
  RESEND_COUNTDOWN_SECONDS,
  classifySendError,
  classifyVerifyError,
  isCompleteOtp,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  tickResendCountdown,
  type AuthErrorKind,
} from "@velnox/shared/lib/auth-flow";
import {
  ArrowRight,
  Check,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  UserX,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

/** Which of the 3 SEPARATE apps this auth page is running inside. */
function currentSite(): "velshop" | "velseller" | "velcenter" {
  const path = window.location.pathname;
  if (path.startsWith("/velseller") || path.startsWith("/seller")) return "velseller";
  if (path.startsWith("/velcenter") || path.startsWith("/center")) return "velcenter";
  return "velshop"; // standalone shop domain (and the legacy portal) live under "/" paths
}

/**
 * Where to land after sign-in when no explicit returnTo was requested.
 * The 3 sites are separate apps, so cross-site homes are real entry URLs
 * (full page load) while in-app homes stay client-side routes.
 */
function roleHome(role: string | undefined): string {
  const isCenterRole = role === "owner" || role === "admin" || role === "staff";
  const site = currentSite();

  // velcenter: the company dashboard lives at the site root.
  if (site === "velcenter") return "/";
  // velseller: merchants land on their goals dashboard; company staff go to velcenter.
  if (site === "velseller") return isCenterRole ? SITE_URLS.velcenter : "/seller/goals";
  // velshop (and the portal): customers stay in the shop; send merchants and
  // company staff to the site that matches their role. The shop's own routes
  // live at the domain root (standalone deploy), so the home is "/".
  if (isCenterRole) return SITE_URLS.velcenter;
  if (role === "seller") return SITE_URLS.velseller;
  return "/";
}

/**
 * User-facing copy for every auth error kind. Only safe, friendly messages —
 * never request ids, env-var names, provider responses or stack traces.
 */
const ERROR_MESSAGE_KEYS: Record<AuthErrorKind, string> = {
  rateLimited: "auth.rateLimited",
  sendFailed: "auth.sendFailed",
  network: "auth.networkError",
  otpInvalid: "auth.otpInvalid",
  otpExpired: "auth.otpExpired",
  otpTooMany: "auth.otpTooMany",
  generic: "auth.emailError",
};

function Auth() {
  const { t } = useLanguage();
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  // ---- 2-step Email OTP flow state -------------------------------------
  const [step, setStep] = useState<"email" | "otp">("email");
  const [emailInput, setEmailInput] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isSending, setIsSending] = useState(false); // email step: requesting a code
  const [isVerifying, setIsVerifying] = useState(false); // otp step: submitting the code
  const [isResending, setIsResending] = useState(false); // otp step: requesting again
  const [verified, setVerified] = useState(false); // otp accepted, awaiting redirect
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0); // seconds until resend is allowed
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const verifyInFlight = useRef(false);

  // ---- Employee password sign-in (spec §11): employee ID / email → canonical
  // email → password. Only users with an active staff profile can resolve.
  const resolveLoginEmail = useAction(api.employeeAuth.resolveLoginEmailAction);
  const [empIdentifier, setEmpIdentifier] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empError, setEmpError] = useState<string | null>(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // ---- Redirect after a real Convex Auth session is created -------------
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const target =
      returnTo?.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : roleHome(user?.role);
    // Cross-app entry URLs (e.g. a legacy /velseller/... path or another
    // app's route) belong to a different app — a client-side navigate would
    // render 404 inside this router instead.
    if (target.startsWith("/vel") || !target.startsWith("/")) {
      window.location.assign(target);
    } else {
      navigate(target);
    }
  }, [authLoading, isAuthenticated, navigate, returnTo, user?.role]);

  // ---- Resend countdown (60s) -------------------------------------------
  useEffect(() => {
    if (step !== "otp" || resendIn <= 0) return;
    const id = window.setInterval(() => {
      setResendIn((s) => {
        const next = tickResendCountdown(s);
        if (next === 0) window.clearInterval(id);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, resendIn > 0]);

  /**
   * Email step: request a code. We advance to the OTP screen ONLY when the
   * backend accepted the email — signIn rejects (throws) whenever
   * sendVerificationRequest fails (rate limited, provider/config error,
   * network), so the OTP screen is never shown for a failed send.
   */
  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSending || isVerifying) return; // double-click guard
    const email = normalizeEmail(emailInput);
    if (!isValidEmail(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      await signIn("email-otp", { email });
      // Backend accepted the email — OTP is on its way (Resend accepted it).
      setPendingEmail(email);
      setOtp("");
      setOtpAttempts(0);
      setOtpSentAt(Date.now());
      setResendIn(RESEND_COUNTDOWN_SECONDS);
      setStep("otp");
    } catch (error) {
      const kind = classifySendError(error);
      console.error(`[auth] OTP request failed (${kind})`);
      setError(t(ERROR_MESSAGE_KEYS[kind]));
    } finally {
      setIsSending(false);
    }
  };

  /** OTP step: submit the 6-digit code to Convex Auth (creates the session). */
  const handleVerify = useCallback(
    async (code: string) => {
      if (verifyInFlight.current || !pendingEmail) return; // no double submit
      if (!isCompleteOtp(code)) return;
      const expired = otpSentAt !== null && Date.now() - otpSentAt > OTP_MAX_AGE_MS;
      if (expired) {
        // Client-side expiry heads-up — the backend still rejects expired
        // codes server-side; this just lets us say *why* it failed.
        setError(t("auth.otpExpired"));
        setOtp("");
        return;
      }
      verifyInFlight.current = true;
      setIsVerifying(true);
      setVerified(false);
      setError(null);
      try {
        await signIn("email-otp", { email: pendingEmail, code });
        // Session created by Convex Auth — the redirect effect takes over.
        setVerified(true);
      } catch (error) {
        const attempts = otpAttempts + 1;
        setOtpAttempts(attempts);
        const kind = classifyVerifyError(error, { expired, attempts });
        console.error(`[auth] OTP verification failed (${kind})`);
        setError(t(ERROR_MESSAGE_KEYS[kind]));
        setOtp("");
        setIsVerifying(false);
        verifyInFlight.current = false;
      }
    },
    [otpAttempts, otpSentAt, pendingEmail, signIn, t],
  );

  // Keep the latest handler available to the auto-submit effect.
  const handleVerifyRef = useRef(handleVerify);
  useEffect(() => {
    handleVerifyRef.current = handleVerify;
  }, [handleVerify]);

  /** Auto-submit as soon as 6 digits are entered (paste included). */
  useEffect(() => {
    if (step !== "otp" || isVerifying || isResending) return;
    if (isCompleteOtp(otp)) {
      void handleVerifyRef.current(otp);
    }
  }, [step, otp, isVerifying, isResending]);

  /** OTP step: request a new code through the REAL backend (rate limits apply). */
  const handleResend = async () => {
    if (isResending || isSending || resendIn > 0 || !pendingEmail) return;
    setIsResending(true);
    setError(null);
    try {
      await signIn("email-otp", { email: pendingEmail });
      setOtp("");
      setOtpAttempts(0);
      setOtpSentAt(Date.now());
      setResendIn(RESEND_COUNTDOWN_SECONDS);
    } catch (error) {
      const kind = classifySendError(error);
      console.error(`[auth] OTP resend failed (${kind})`);
      setError(t(ERROR_MESSAGE_KEYS[kind]));
    } finally {
      setIsResending(false);
    }
  };

  /** Back to the email screen — clears OTP state, creates NO new session. */
  const handleChangeEmail = () => {
    if (isVerifying || isResending) return;
    setStep("email");
    setOtp("");
    setError(null);
    setOtpSentAt(null);
    setOtpAttempts(0);
    setResendIn(0);
    setPendingEmail(null);
    setVerified(false);
  };

  const handleGuestLogin = async () => {
    if (guestLoading) return;
    setGuestLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (error) {
      console.error("Guest login error:", error);
      setError(t("auth.guestError", { message: error instanceof Error ? error.message : "unknown" }));
      setGuestLoading(false);
    }
  };

  const handleEmployeeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (empLoading) return;
    setEmpLoading(true);
    setEmpError(null);
    try {
      const identifier = empIdentifier.trim();
      // Resolve employee-id / email to the canonical account email (only
      // active staff profiles resolve — shop customers never do).
      const { email } = await resolveLoginEmail({ identifier });
      await signIn("password", { email, password: empPassword });
    } catch (error) {
      console.error("Employee sign-in error:", error);
      setEmpError(error instanceof Error ? error.message : t("auth.employeeError"));
      setEmpLoading(false);
    }
  };

  const emailBusy = isSending;
  const otpBusy = isVerifying || isResending;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Auth Content — centered card on desktop, app-like on mobile */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <Card className="w-full max-w-[400px] border shadow-md pb-0">
          {step === "email" ? (
            <>
              <CardHeader className="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="mx-auto mb-5 cursor-pointer rounded-xl transition-opacity hover:opacity-80"
                  aria-label={t("auth.backHomeAria")}
                >
                  <Logo />
                </button>
                <CardTitle className="text-xl">{t("auth.title")}</CardTitle>
                <CardDescription>{t("auth.desc")}</CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit} noValidate>
                <CardContent className="grid gap-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (error) setError(null);
                      }}
                      className="h-12 pl-9 text-base"
                      disabled={emailBusy}
                      required
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-red-500">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="h-12 w-full gap-2 text-base"
                    disabled={emailBusy || emailInput.trim().length === 0}
                  >
                    {emailBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auth.sendingCode")}
                      </>
                    ) : (
                      <>
                        {t("auth.continue")}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="relative mt-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {t("auth.or")}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full gap-2"
                    onClick={handleGuestLogin}
                    disabled={emailBusy || guestLoading}
                  >
                    {guestLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserX className="h-4 w-4" />
                    )}
                    {t("auth.guest")}
                  </Button>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{t("auth.otpTitle")}</CardTitle>
                <CardDescription>
                  {t("auth.otpDesc", { email: maskEmail(pendingEmail ?? "") })}
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleVerify(otp);
                }}
              >
                <CardContent className="grid gap-3 pb-4">
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={(value) => {
                        setOtp(value);
                        if (error) setError(null);
                      }}
                      maxLength={6}
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={otpBusy}
                      aria-label={t("auth.otpTitle")}
                      containerClassName="gap-2 sm:gap-2.5"
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-14 w-11 text-lg font-semibold sm:h-12 sm:w-10 sm:text-base"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && (
                    <p role="alert" className="text-center text-sm text-red-500">
                      {error}
                    </p>
                  )}

                  {/* Resend: real backend call, guarded by a 60s countdown */}
                  <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>{t("auth.noCode")}</span>
                    {resendIn > 0 ? (
                      <span aria-live="polite">
                        {t("auth.resendIn", { seconds: resendIn })}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        className="h-11 p-0 px-1 text-sm"
                        onClick={handleResend}
                        disabled={isResending}
                      >
                        {isResending ? (
                          <>
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            {t("auth.sendingCode")}
                          </>
                        ) : (
                          t("auth.resendNow")
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="h-12 w-full gap-2 text-base"
                    disabled={otpBusy || !isCompleteOtp(otp)}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("auth.verifying")}
                      </>
                    ) : verified ? (
                      <>
                        <Check className="h-4 w-4" />
                        {t("auth.verifySuccess")}
                      </>
                    ) : (
                      <>
                        {t("auth.confirmCode")}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleChangeEmail}
                    disabled={otpBusy}
                    className="h-12 w-full"
                  >
                    {t("auth.changeEmail")}
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          {/* Employee (velcenter) password sign-in — customers never see this path */}
          {step === "email" && (
            <div className="border-t bg-muted/50 px-6 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("auth.employeeLabel")}
              </p>
              <form onSubmit={handleEmployeeSubmit} className="grid gap-2" noValidate>
                <Input
                  placeholder={t("auth.employeeId")}
                  autoComplete="username"
                  value={empIdentifier}
                  onChange={(e) => setEmpIdentifier(e.target.value)}
                  className="h-11"
                  disabled={empLoading}
                  required
                />
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="password"
                    type="password"
                    placeholder={t("auth.employeePassword")}
                    autoComplete="current-password"
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    className="h-11 pl-9"
                    disabled={empLoading}
                    required
                  />
                </div>
                {empError && (
                  <p role="alert" className="text-sm text-red-500">
                    {empError}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 w-full gap-2"
                  disabled={empLoading}
                >
                  {empLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {t("auth.employeeSubmit")}
                </Button>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {t("auth.employeeDesc")}
                </p>
              </form>
            </div>
          )}

          <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
            Secured by{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-primary"
            >
              freebuff.com
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <Auth />
    </Suspense>
  );
}
