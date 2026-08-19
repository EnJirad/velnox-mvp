/**
 * VelShop re-export of the shared multi-language system.
 *
 * The core (provider, hook, dictionaries) lives in `@velnox/shared/lib/i18n`
 * so that shared components (e.g. the auth page) render in the active language
 * too. Shop pages keep importing from `@/lib/i18n` unchanged.
 */
export * from "@velnox/shared/lib/i18n";
