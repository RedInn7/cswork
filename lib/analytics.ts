/**
 * Product events for GA4 and the owner dashboard (POST /api/metrics).
 * Values are strings (max 120 chars), finite numbers and booleans: never code,
 * emails, names or other personal data. Nothing here may break the page.
 */
type Params = Record<string, string | number | boolean | null | undefined>;
let memoryVid = '';

function clean(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') out[key] = value.slice(0, 120);
    else if (
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      out[key] = value;
  }
  return out;
}

/** Random and anonymous; per page load when storage is blocked. */
function visitorId() {
  try {
    let vid = localStorage.getItem('cswork:vid');
    if (!vid) localStorage.setItem('cswork:vid', (vid = crypto.randomUUID()));
    return vid;
  } catch {
    return (memoryVid ||= crypto.randomUUID());
  }
}

/** Owner dashboard only, e.g. page_view, which GA4 already counts itself. */
export function beacon(name: string, params: Params = {}) {
  if (typeof window === 'undefined') return;
  try {
    // A text/plain JSON body: the one sendBeacon type every browser accepts.
    const body = JSON.stringify({
      vid: visitorId(),
      events: [{ name, params: clean(params) }],
    });
    if (!navigator.sendBeacon?.('/api/metrics', body))
      void fetch('/api/metrics', {
        method: 'POST',
        body,
        keepalive: true,
      }).catch(() => {});
  } catch {
    /* Analytics is best effort. */
  }
}

/** GA4 (no-op without the gtag snippet: dev, tests, ad blockers) plus the owner dashboard. */
export function track(name: string, params: Params = {}) {
  beacon(name, params);
  if (typeof window === 'undefined') return;
  try {
    const gtag: unknown = Reflect.get(window, 'gtag');
    // gtag reads `language` as the visitor's UI language (GA4's built-in dimension).
    const { language, ...rest } = clean(params);
    if (typeof gtag === 'function')
      gtag(
        'event',
        name,
        language === undefined ? rest : { ...rest, code_language: language },
      );
  } catch {
    /* Analytics is best effort. */
  }
}
