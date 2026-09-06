// STAND-IN PHOTOGRAPHY. These are Unsplash stock photos of other golf
// courses, verified to resolve. Swap each `src` for the club's own photos
// before go-live; this file is the only place image URLs live.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const PHOTOS = {
  heroFairway: {
    src: u("photo-1636646220328-61d531af9f31", 2000),
    alt: "A tree-lined fairway running toward a distant flag",
  },
  greenFlag: {
    src: u("photo-1672871583126-ae8dae954c6f"),
    alt: "A well-kept green with the flag in, trees behind",
  },
  walkers: {
    src: u("photo-1629928515074-0a76b71e9954"),
    alt: "Two golfers walking the fairway, trundlers in tow",
  },
  redFlag: {
    src: u("photo-1517074009205-d9ca5d8b4a63"),
    alt: "A red flag leaning in the breeze on an open green",
  },
  drive: {
    src: u("photo-1535131749006-b7f58c99034b"),
    alt: "A golfer at the top of the backswing, driver in hand",
  },
  twilight: {
    src: u("photo-1505794718076-13e166c01a33"),
    alt: "A golfer silhouetted against the last of the evening light",
  },
  pair: {
    src: u("photo-1623113807896-3b3a7fc2aec0"),
    alt: "Two mates sharing a laugh between shots",
  },
  openField: {
    src: u("photo-1538628166020-9c7589dc6913", 2000),
    alt: "A wide, flat stretch of mown fairway under big sky",
  },
};
