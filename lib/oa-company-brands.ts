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
  microsoft: '/company-logos/microsoft.svg',
  ibm: '/company-logos/ibm.svg',
  'ibm-frontend': '/company-logos/ibm.svg',
  salesforce: '/company-logos/salesforce.svg',
  'jpmorgan-chase': '/company-logos/jpmorganchase.svg',
  oracle: '/company-logos/oracle.svg',
  openai: '/company-logos/openai.svg',
  linkedin: '/company-logos/linkedin.svg',
  adobe: '/company-logos/adobe.svg',
  twilio: '/company-logos/twilio.svg',
  yahoo: '/company-logos/yahoo.svg',
  braze: '/company-logos/braze.svg',
  epifi: '/company-logos/epifi.svg',
  codeium: '/company-logos/windsurf.svg',
  amazon: '/company-logos/amazon.svg',
  'amazon-mern': '/company-logos/amazon.svg',
  rubrik: '/company-logos/rubrik.svg',
  citadel: '/company-logos/citadel.svg',
  paycom: '/company-logos/paycom.svg',
  'capital-one': '/company-logos/capitalone.svg',
  'pure-storage': '/company-logos/purestorage.svg',
  ziprecruiter: '/company-logos/ziprecruiter.svg',
  'the-d-e-shaw-group': '/company-logos/deshaw.svg',
  flexport: '/company-logos/flexport.svg',
  tradedesk: '/company-logos/tradedesk.svg',
  'hudson-river-trading': '/company-logos/hudsonrivertrading.svg',
  'two-sigma': '/company-logos/twosigma.svg',
  deloitte: '/company-logos/deloitte.svg',
  blackrock: '/company-logos/blackrock.svg',
  bloomberg: '/company-logos/bloomberg.svg',
  walmart: '/company-logos/walmart.svg',
  confluent: '/company-logos/confluent.svg',
  wayfair: '/company-logos/wayfair.svg',
  optiver: '/company-logos/optiver.svg',
  plaid: '/company-logos/plaid.svg',
  ramp: '/company-logos/ramp.svg',
  agoda: '/company-logos/agoda.svg',
  millennium: '/company-logos/millennium.svg',
  'morgan-stanley': '/company-logos/morganstanley.svg',
  'bny-mellon': '/company-logos/bny.svg',
  bnp: '/company-logos/bnpparibas.svg',
  factset: '/company-logos/factset.svg',
  commvault: '/company-logos/commvault.svg',
  'service-now': '/company-logos/servicenow.svg',
  waymo: '/company-logos/waymo.svg',
  'square-point': '/company-logos/squarepoint.svg',
  geico: '/company-logos/geico.svg',
  ukg: '/company-logos/ukg.svg',
  xperi: '/company-logos/xperi.svg',
  wework: '/company-logos/wework.svg',
  'jane-street': '/company-logos/janestreet.svg',
  headlands: '/company-logos/headlands.svg',
  dtcc: '/company-logos/dtcc.svg',
  affirm: '/company-logos/affirm.svg',
  sofi: '/company-logos/sofi.svg',
  'arista-networks': '/company-logos/aristanetworks.svg',
  'ge-vernova': '/company-logos/gevernova.svg',
  whatnot: '/company-logos/whatnot.svg',
  'oscar-health': '/company-logos/oscarhealth.svg',
  'publicis-sapient': '/company-logos/publicissapient.svg',
};

/** Catalog slugs that name the same employer as another slug: listed, linked and counted once. */
export const companyAliases: Readonly<Record<string, string>> = {
  barclay: 'barclays',
  sig: 'susquehanna-international-group',
  'amazon-mern': 'amazon', // Amazon's MERN frontend OA
  'ibm-frontend': 'ibm',
};
export const canonicalCompany = (slug: string) =>
  Object.hasOwn(companyAliases, slug) ? companyAliases[slug] : slug;
/**
 * Content library (and LeetCode map) spellings of an employer known here under another slug.
 * Kept apart from companyAliases: these are not OA catalog slugs and must never fold catalog companies.
 */
export const libraryCompanyAliases: Readonly<Record<string, string>> = {
  bytedance: 'tiktok',
  snap: 'snapchat',
  facebook: 'meta',
  'meta-platforms': 'meta',
  'amazon-web-services': 'amazon',
  akunacapital: 'akuna-capital',
  arista: 'arista-networks',
  deshaw: 'the-d-e-shaw-group',
  'further-ai': 'furtherai',
  generalmotors: 'general-motors',
  'j-p-morgan': 'jpmorgan-chase',
  'jp-morgan-chase': 'jpmorgan-chase',
  'jpmorgan-chase-and': 'jpmorgan-chase',
  jpmorganchase: 'jpmorgan-chase',
  purestorage: 'pure-storage',
  servicenow: 'service-now',
  sigmacomputing: 'sigma-computing',
  squarepoint: 'square-point',
  'walmart-labs': 'walmart',
  'walmart-global-tech': 'walmart',
};
/** The one slug an employer goes by across OA, the content library and the LeetCode map. */
export const employerSlug = (slug: string) =>
  canonicalCompany(
    Object.hasOwn(libraryCompanyAliases, slug) ? libraryCompanyAliases[slug] : slug,
  );
/** Company hub page (/company/<employer>): OA, frequent LeetCode, experiences and questions. */
export const companyHubPath = (slug: string) => `/company/${employerSlug(slug)}`;
/** The catalog files problems it cannot attribute under "unknown": shown as Other, listed last. */
export const OTHER_COMPANY = 'unknown';
export const oaCompanyName = (slug: string, name: string, locale: 'zh' | 'en') =>
  slug === OTHER_COMPANY ? (locale === 'zh' ? '其他' : 'Other') : name;
export const oaCompanyPath = (slug: string) => `/oa/${canonicalCompany(slug)}`;
export const oaProblemPath = (slug: string, id: string) =>
  `${oaCompanyPath(slug)}/${encodeURIComponent(id)}`;

/** Stable per-company hue so a missing logo still reads as an identity mark. */
export function companyHue(slug: string) {
  let hash = 0;
  for (const char of slug || '') hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

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
