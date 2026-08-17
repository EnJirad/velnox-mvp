import { Logo } from "@velnox/shared/components/Logo";
import { Button } from "@velnox/shared/components/ui/button";
import { useLanguage } from "@velnox/shared/lib/i18n";
import { Compass } from "lucide-react";
import { Link } from "react-router";

/**
 * Shared 404 page (rendered inside each app's router: velshop, velseller,
 * velcenter). Matches the clean slate design system and the app theme tokens
 * so it looks native in every app, in both light and dark mode.
 */
export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Logo />

        <span className="mt-10 flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Compass className="size-7 text-muted-foreground" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          404 — {t("common.notFound")}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {t("common.notFoundDesc")}
        </p>
        <Button className="mt-6 gap-1.5" asChild>
          <Link to="/">{t("common.back")}</Link>
        </Button>
      </div>
    </div>
  );
}
