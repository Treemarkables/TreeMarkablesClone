// Course facts verified from public listings (Golf NZ, Hole19, Tairāwhiti
// Gisborne) in August 2026. The scorecard matches the white tees on Hole19;
// have the club sight-check it against the printed card before go-live.

export const COURSE = {
  holes: 18,
  par: 72,
  yards: 5665,
  out: { par: 36, yards: 2828 },
  in: { par: 36, yards: 2837 },
};

export type Hole = {
  hole: number;
  par: number;
  yards: number;
  si: number; // stroke index
};

export const FRONT_NINE: Hole[] = [
  { hole: 1, par: 5, yards: 456, si: 2 },
  { hole: 2, par: 3, yards: 155, si: 16 },
  { hole: 3, par: 4, yards: 331, si: 4 },
  { hole: 4, par: 4, yards: 332, si: 6 },
  { hole: 5, par: 3, yards: 140, si: 18 },
  { hole: 6, par: 4, yards: 358, si: 8 },
  { hole: 7, par: 3, yards: 165, si: 14 },
  { hole: 8, par: 5, yards: 455, si: 12 },
  { hole: 9, par: 5, yards: 436, si: 10 },
];

export const BACK_NINE: Hole[] = [
  { hole: 10, par: 4, yards: 378, si: 1 },
  { hole: 11, par: 4, yards: 326, si: 3 },
  { hole: 12, par: 4, yards: 295, si: 13 },
  { hole: 13, par: 5, yards: 460, si: 9 },
  { hole: 14, par: 3, yards: 112, si: 17 },
  { hole: 15, par: 4, yards: 315, si: 11 },
  { hole: 16, par: 4, yards: 310, si: 7 },
  { hole: 17, par: 4, yards: 326, si: 5 },
  { hole: 18, par: 4, yards: 315, si: 15 },
];

// PLACEHOLDER PRICING. The club has not published fees anywhere public.
// Every price below renders as "$ —" with a "confirm with the club" chip
// until this flag is flipped and real numbers are entered.
export const PRICING_CONFIRMED = false;

export type PriceRow = {
  label: string;
  detail: string;
  price: string | null; // null renders the placeholder treatment
};

export const MEMBERSHIP_TIERS: {
  name: string;
  blurb: string;
  price: string | null;
  per: string;
}[] = [
  {
    name: "Full playing",
    blurb: "Seven-day access, club competitions, an official handicap and full clubhouse privileges.",
    price: null,
    per: "per year",
  },
  {
    name: "Couples",
    blurb: "Two full playing memberships under one roof, at a friendlier rate.",
    price: null,
    per: "per year",
  },
  {
    name: "Junior & student",
    blurb: "Under 18 or studying full time. The cheapest way in golf to fall in love with the game.",
    price: null,
    per: "per year",
  },
  {
    name: "Nine-hole & social",
    blurb: "A relaxed option for shorter rounds, twilight golf and the social side of the club.",
    price: null,
    per: "per year",
  },
];

export const GREEN_FEES: PriceRow[] = [
  { label: "18 holes, affiliated", detail: "Members of another NZ Golf club", price: null },
  { label: "18 holes, non-affiliated", detail: "Casual visitors welcome, no handicap needed", price: null },
  { label: "9 holes", detail: "A quick loop before work or after lunch", price: null },
  { label: "Twilight", detail: "Late afternoon tee-off, seasonal", price: null },
];
