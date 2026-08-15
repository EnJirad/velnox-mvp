/**
 * VelShop SEO helper (spec §44).
 *
 * setSeo() manages title / meta description / canonical / OpenGraph / Twitter
 * cards / JSON-LD structured data on the client. It is intentionally tiny and
 * side-effect free besides the DOM — call it from a page effect.
 */

export interface SeoInput {
  title: string;
  description?: string;
  /** absolute URL for canonical + og:url (defaults to current page URL) */
  canonicalUrl?: string;
  ogType?: "website" | "product";
  ogImage?: string;
  /** structured data (e.g. product schema) injected as JSON-LD */
  jsonLd?: object | object[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  const selector = attr === "name" ? `meta[name="${key}"]` : `meta[property="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(data: object | object[]): void {
  document.head.querySelectorAll('script[data-seo-jsonld="true"]').forEach((s) => s.remove());
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-seo-jsonld", "true");
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function setSeo(input: SeoInput): void {
  const url = input.canonicalUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const siteName = "VelShop — Velnox";

  document.title = input.title;

  if (input.description) {
    upsertMeta("name", "description", input.description);
    upsertMeta("property", "og:description", input.description);
  }
  upsertMeta("property", "og:title", input.title);
  upsertMeta("property", "og:type", input.ogType ?? "website");
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:site_name", siteName);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", input.title);
  if (input.ogImage) {
    upsertMeta("property", "og:image", input.ogImage);
    upsertMeta("name", "twitter:image", input.ogImage);
  }
  upsertCanonical(url.split("?")[0]);
  if (input.jsonLd) upsertJsonLd(input.jsonLd);
}
