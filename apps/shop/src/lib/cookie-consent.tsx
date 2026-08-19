import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@velnox/shared/components/ui/dialog";
import { Switch } from "@velnox/shared/components/ui/switch";
import { Cookie, Settings2 } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * VelShop cookie consent (spec §55–74).
 *
 * - First visit → a compact bottom banner (never blocks shopping/login/cart).
 * - Categories: necessary (always on) · preferences · analytics · marketing.
 * - Consent is persisted to localStorage so the banner doesn't reappear, and
 *   can be changed anytime from the footer ("ตั้งค่าคุกกี้").
 * - Consent version lets us re-ask when the policy changes.
 * - No fake tracking: nothing is loaded for analytics/marketing — the
 *   preferences are recorded as user choice (error monitoring is treated as
 *   necessary infrastructure).
 */

export const COOKIE_CONSENT_VERSION = "1";
const STORAGE_KEY = "velnox_cookie_consent";

export interface CookieConsentState {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  consentVersion: string;
  updatedAt: string;
}

interface CookieConsentContextValue {
  consent: CookieConsentState | null;
  /** Has the visitor answered at least once? */
  hasAnswered: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  saveCustom: (preferences: boolean, analytics: boolean, marketing: boolean) => void;
  openSettings: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readStored(): CookieConsentState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
    if (
      parsed.consentVersion !== COOKIE_CONSENT_VERSION ||
      parsed.necessary !== true ||
      typeof parsed.preferences !== "boolean" ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }
    return parsed as CookieConsentState;
  } catch {
    return null;
  }
}

function writeStored(state: CookieConsentState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode etc.) — banner will re-show next visit
  }
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [consent, setConsent] = useState<CookieConsentState | null>(() => readStored());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState({ preferences: false, analytics: false, marketing: false });

  const commit = useCallback((next: CookieConsentState) => {
    setConsent(next);
    writeStored(next);
  }, []);

  const acceptAll = useCallback(() => {
    commit({
      necessary: true,
      preferences: true,
      analytics: true,
      marketing: true,
      consentVersion: COOKIE_CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
    });
    setSettingsOpen(false);
  }, [commit]);

  const rejectNonEssential = useCallback(() => {
    commit({
      necessary: true,
      preferences: false,
      analytics: false,
      marketing: false,
      consentVersion: COOKIE_CONSENT_VERSION,
      updatedAt: new Date().toISOString(),
    });
    setSettingsOpen(false);
  }, [commit]);

  const saveCustom = useCallback(
    (preferences: boolean, analytics: boolean, marketing: boolean) => {
      commit({
        necessary: true,
        preferences,
        analytics,
        marketing,
        consentVersion: COOKIE_CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
      });
      setSettingsOpen(false);
    },
    [commit],
  );

  const openSettings = useCallback(() => {
    setDraft({
      preferences: consent?.preferences ?? false,
      analytics: consent?.analytics ?? false,
      marketing: consent?.marketing ?? false,
    });
    setSettingsOpen(true);
  }, [consent]);

  const value = useMemo<CookieConsentContextValue>(
    () => ({ consent, hasAnswered: consent !== null, acceptAll, rejectNonEssential, saveCustom, openSettings }),
    [consent, acceptAll, rejectNonEssential, saveCustom, openSettings],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {!consent && <ConsentBanner onAccept={acceptAll} onSettings={openSettings} onReject={rejectNonEssential} />}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Cookie className="size-4 text-[#10B981]" />
              {t("cookies.title")}
            </DialogTitle>
            <DialogDescription>{t("cookies.desc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <CategoryRow
              title={t("cookies.necessary")}
              desc={t("cookies.necessaryDesc")}
              alwaysActive={t("cookies.alwaysActive")}
              checked
              disabled
            />
            <CategoryRow
              title={t("cookies.preferences")}
              desc={t("cookies.preferencesDesc")}
              checked={draft.preferences}
              onChecked={(v) => setDraft((d) => ({ ...d, preferences: v }))}
            />
            <CategoryRow
              title={t("cookies.analytics")}
              desc={t("cookies.analyticsDesc")}
              checked={draft.analytics}
              onChecked={(v) => setDraft((d) => ({ ...d, analytics: v }))}
            />
            <CategoryRow
              title={t("cookies.marketing")}
              desc={t("cookies.marketingDesc")}
              checked={draft.marketing}
              onChecked={(v) => setDraft((d) => ({ ...d, marketing: v }))}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="border-slate-200 text-slate-700" onClick={acceptAll}>
              {t("cookies.acceptAll")}
            </Button>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => saveCustom(draft.preferences, draft.analytics, draft.marketing)}
            >
              <Settings2 className="size-4" />
              {t("cookies.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CookieConsentContext.Provider>
  );
}

function CategoryRow({
  title,
  desc,
  checked,
  onChecked,
  alwaysActive,
  disabled,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChecked?: (v: boolean) => void;
  alwaysActive?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{desc}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        {disabled ? (
          <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            {alwaysActive}
          </span>
        ) : (
          <Switch checked={checked} onCheckedChange={onChecked} aria-label={title} />
        )}
      </div>
    </div>
  );
}

function ConsentBanner({
  onAccept,
  onSettings,
  onReject,
}: {
  onAccept: () => void;
  onSettings: () => void;
  onReject: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="region"
      aria-label={t("cookies.title")}
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_10px_34px_rgba(15,23,42,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-5 text-slate-600 sm:max-w-md">
          <Cookie className="mt-0.5 size-4 shrink-0 text-[#10B981]" />
          {t("cookies.banner")}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 text-slate-500 hover:bg-slate-100" onClick={onReject}>
            {t("cookies.rejectNonEssential")}
          </Button>
          <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700" onClick={onSettings}>
            {t("cookies.settings")}
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-[#10B981] text-white hover:bg-emerald-700" onClick={onAccept}>
            {t("cookies.acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
}

/** Exposed for the cookie policy page + footer — returns the storage key used. */
export const COOKIE_STORAGE_KEY = STORAGE_KEY;
