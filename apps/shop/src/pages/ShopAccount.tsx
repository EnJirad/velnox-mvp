import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { Label } from "@velnox/shared/components/ui/label";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { CalendarDays, CheckCircle2, ChevronLeft, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface ProfileData {
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberSince: number | null;
}

export default function ShopAccount() {
  const { t } = useLanguage();
  const myProfile = useAction(api.customer.myProfile);
  const updateProfile = useAction(api.customer.updateProfileAction);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    myProfile()
      .then((res) => {
        if (!alive) return;
        const data = res as {
          name: string | null;
          email: string | null;
          phone: string | null;
          avatarUrl: string | null;
          memberSince: number;
        };
        setProfile({
          name: data.name,
          email: data.email,
          phone: data.phone,
          avatarUrl: data.avatarUrl ?? null,
          memberSince: data.memberSince ?? null,
        });
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
      })
      .catch((err) => {
        console.error("Load profile error:", err);
        if (alive) setProfile(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [myProfile]);

  const dirty = name.trim() !== (profile?.name ?? "") || phone.trim() !== (profile?.phone ?? "");

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      toast.error(t("account.nameError"));
      return;
    }
    if (phone.trim() && !/^[0-9+\-\s()]{6,20}$/.test(phone.trim())) {
      toast.error(t("account.phoneError"));
      return;
    }
    setSaving(true);
    try {
      const res = (await updateProfile({
        name: trimmedName !== (profile?.name ?? "") ? trimmedName : undefined,
        phone: phone.trim() !== (profile?.phone ?? "") ? phone.trim() : undefined,
      })) as {
        name: string | null;
        phone: string | null;
        memberSince: number;
      };
      setProfile({
        name: res.name,
        email: profile?.email ?? null,
        phone: res.phone,
        avatarUrl: profile?.avatarUrl ?? null,
        memberSince: res.memberSince ?? profile?.memberSince ?? null,
      });
      setName(res.name ?? "");
      setPhone(res.phone ?? "");
      toast.success(t("account.saveSuccess"));
    } catch (err) {
      console.error("Update profile error:", err);
      toast.error(err instanceof Error ? err.message : t("account.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const memberSince = profile?.memberSince
    ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(profile.memberSince),
      )
    : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-10 shrink-0 text-slate-500" asChild>
            <Link to="/profile" aria-label={t("account.backToProfile")}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("account.title")}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{t("account.desc")}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Account summary */}
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3.5">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ECFDF5] text-lg font-bold text-[#10B981]">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    (profile?.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                    <UserRound className="size-3.5 shrink-0 text-slate-400" />
                    {profile?.name ?? t("account.unnamed")}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
                    <Mail className="size-3 shrink-0" />
                    {profile?.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  <ShieldCheck className="size-3" />
                  {t("account.statusActive")}
                </span>
                {memberSince && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <CalendarDays className="size-3" />
                    {t("account.memberSince", { date: memberSince })}
                  </span>
                )}
              </div>
            </section>

            {/* Editable profile */}
            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">{t("account.editTitle")}</h2>
              <div className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="acct-name">{t("account.name")}</Label>
                  <Input
                    id="acct-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("account.namePlaceholder")}
                    className="h-11 rounded-[10px] border-slate-200"
                    maxLength={80}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="acct-phone">{t("account.phone")}</Label>
                  <Input
                    id="acct-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("account.phonePlaceholder")}
                    className="h-11 rounded-[10px] border-slate-200"
                  />
                  <p className="text-[11px] text-slate-400">{t("account.phoneHint")}</p>
                </div>
                <div className="grid gap-2">
                  <Label>{t("account.email")}</Label>
                  <div className="flex h-11 items-center rounded-[10px] border border-slate-100 bg-slate-50 px-3 text-sm text-slate-500">
                    {profile?.email ?? "—"}
                  </div>
                  <p className="text-[11px] text-slate-400">{t("account.emailLocked")}</p>
                </div>
              </div>
              <Button
                className="mt-5 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {saving ? t("account.saving") : t("account.save")}
              </Button>
            </section>
          </>
        )}
      </main>

      <ShopFooter />
    </div>
  );
}
