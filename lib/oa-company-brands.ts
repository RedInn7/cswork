/** Explicit mappings to reviewed current-release assets. No guessed logo URLs. */
export const companyLogos: Readonly<Record<string, string>> = {
  google: '/company-logos/google.svg',
  meta: '/company-logos/meta.svg',
  apple: '/company-logos/apple.svg',
  netflix: '/company-logos/netflix.svg',
  nvidia: '/company-logos/nvidia.svg',
  anthropic: '/company-logos/anthropic.svg',
  tesla: '/company-logos/tesla.svg',
  snowflake: '/company-logos/snowflake.svg',
  samsung: '/company-logos/samsung.svg',
  cisco: '/company-logos/cisco.svg',
  dell: '/company-logos/dell.svg',
  uber: '/company-logos/uber.svg',
  airbnb: '/company-logos/airbnb.svg',
  stripe: '/company-logos/stripe.svg',
  databricks: '/company-logos/databricks.svg',
  coinbase: '/company-logos/coinbase.svg',
  github: '/company-logos/github.svg',
  atlassian: '/company-logos/atlassian.svg',
  cloudflare: '/company-logos/cloudflare.svg',
  doordash: '/company-logos/doordash.svg',
  instacart: '/company-logos/instacart.svg',
  pinterest: '/company-logos/pinterest.svg',
  palantir: '/company-logos/palantir.svg',
  roblox: '/company-logos/roblox.svg',
  duolingo: '/company-logos/duolingo.svg',
  datadog: '/company-logos/datadog.svg',
  intuit: '/company-logos/intuit.svg',
  paypal: '/company-logos/paypal.svg',
  visa: '/company-logos/visa.svg',
  ebay: '/company-logos/ebay.svg',
  expedia: '/company-logos/expedia.svg',
  ericsson: '/company-logos/ericsson.svg',
  quora: '/company-logos/quora.svg',
  sentry: '/company-logos/sentry.svg',
  patreon: '/company-logos/patreon.svg',
  'goldman-sachs': '/company-logos/goldmansachs.svg',
  'wells-fargo': '/company-logos/wellsfargo.svg',
  'deutsche-bank': '/company-logos/deutschebank.svg',
  barclays: '/company-logos/barclays.svg',
  barclay: '/company-logos/barclays.svg',
  hsbc: '/company-logos/hsbc.svg',
  circle: '/company-logos/circle.svg',
  nutanix: '/company-logos/nutanix.svg',
  fortinet: '/company-logos/fortinet.svg',
  f5: '/company-logos/f5.svg',
  box: '/company-logos/box.svg',
  'general-motors': '/company-logos/generalmotors.svg',
  'trend-micro': '/company-logos/trendmicro.svg',
  zalando: '/company-logos/zalando.svg',
  airtable: '/company-logos/airtable.svg',
  toshiba: '/company-logos/toshiba.svg',
  accenture: '/company-logos/accenture.svg',
  infosys: '/company-logos/infosys.svg',
  hackerearth: '/company-logos/hackerearth.svg',
};

export function companyInitials(name: string): string {
  if (/^[A-Z0-9]{1,4}$/.test(name.trim())) return name.trim();
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => Array.from(word)[0])
          .join('')
      : Array.from(words[0] || '?')
          .slice(0, 2)
          .join('')
  ).toLocaleUpperCase();
}
