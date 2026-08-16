// Display-side mirrors of the server pricing constants (minor units).
export const FLAT_SHIPPING_MINOR = 4500; // ฿45
// The authoritative numbers are computed in src/convex/orders.ts.
export const FREE_SHIPPING_THRESHOLD_MINOR = 100000; // free over ฿1,000

export const formatMoney = (minor: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);

export const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** SVG data-URI placeholder used when a product has no image yet. */
export const placeholderImage = (label: string, from = "#1c1917", to = "#4d7c0f") => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="50%" y="46%" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
