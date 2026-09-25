// Market feed regions — each Facebook buy/sell group belongs to one, and a
// viewer sees their own region's feed by default.

export const FEED_REGIONS = ['na', 'eu', 'apac'] as const;
export type FeedRegion = (typeof FEED_REGIONS)[number];

export const FEED_REGION_LABELS: Record<FeedRegion, string> = {
  na: 'North America',
  eu: 'Europe',
  apac: 'APAC',
};

/** Cookie that remembers the region a viewer picked on /feed. */
export const FEED_REGION_COOKIE = 'feed_region';

export const isFeedRegion = (v: unknown): v is FeedRegion =>
  typeof v === 'string' && (FEED_REGIONS as readonly string[]).includes(v);

// ISO 3166-1 alpha-2 → feed region. Americas → na; Europe, Middle East and
// Africa → eu (the European groups are the closest market); Asia + Oceania → apac.
const AMERICAS = 'US CA MX GT BZ SV HN NI CR PA CU DO HT JM PR TT BS BB AG DM GD KN LC VC CO VE EC PE BO BR PY UY AR CL GY SR GF AW CW BM KY TC VG VI GP MQ';
const EMEA =
  'GB IE FR DE NL BE LU CH AT IT ES PT DK NO SE FI IS EE LV LT PL CZ SK HU SI HR BA RS ME MK AL GR BG RO MD UA BY RU MT CY AD MC SM VA LI GI JE GG IM FO GL XK ' +
  'TR IL PS JO LB SY IQ IR SA AE QA BH KW OM YE GE AM AZ ' +
  'EG MA DZ TN LY SD ZA NG KE GH ET TZ UG SN CI CM AO ZW ZM MZ NA BW MU RW MG';
const APAC =
  'JP KR KP CN HK MO TW MN SG MY TH VN PH ID KH LA MM BN TL IN PK BD LK NP BT MV AF KZ UZ KG TJ TM ' +
  'AU NZ PG FJ SB VU NC PF WS TO KI FM MH PW NR TV';

const COUNTRY_REGION: Record<string, FeedRegion> = {};
for (const [codes, region] of [[AMERICAS, 'na'], [EMEA, 'eu'], [APAC, 'apac']] as const) {
  for (const cc of codes.split(' ')) COUNTRY_REGION[cc] = region;
}

export function countryToFeedRegion(countryCode: string | null | undefined): FeedRegion | null {
  if (!countryCode) return null;
  return COUNTRY_REGION[countryCode.trim().toUpperCase()] ?? null;
}

/**
 * Which region's feed to show: an explicit ?region choice, then the one the
 * viewer picked before (cookie), then their profile country, then the
 * country Cloudflare reports for the connection, then North America.
 */
export function resolveFeedRegion(input: {
  requested?: string | null;
  remembered?: string | null;
  profileCountry?: string | null;
  ipCountry?: string | null;
}): FeedRegion {
  if (isFeedRegion(input.requested)) return input.requested;
  if (isFeedRegion(input.remembered)) return input.remembered;
  return countryToFeedRegion(input.profileCountry) ?? countryToFeedRegion(input.ipCountry) ?? 'na';
}
